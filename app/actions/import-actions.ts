"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Platform, SolveStatus } from "@prisma/client";
import Papa from "papaparse";
import { z } from "zod";
import { seedCard, spreadImportDueDates } from "@/lib/scheduler";
import { LIMITS, storedHttpUrl } from "@/lib/safe";
import {
  DryRunRow,
  parseSlugFromUrl,
  parseLeadingNumber,
  mapRawStatus,
  mapRawRevisit,
  parseSolvedDate,
  sanitizeCsvText,
  mergeTwoRows,
} from "@/lib/import-utils";

export type { DryRunRow };
export { mergeTwoRows };

export interface DuplicateGroup {
  groupId: string;
  matchedKey: string;
  matchedProblemTitle?: string;
  rows: DryRunRow[];
  suggestedFixes: Array<{
    rowIndex: number;
    reason: string;
    suggestedProblemId: string;
    suggestedTitle: string;
    suggestedNumber?: number | null;
    suggestedPlatform: Platform;
    suggestedUrl: string;
    suggestedMethod: "NUMBER" | "TITLE_EXACT";
  }>;
}

export interface DryRunSummary {
  totalRows: number;
  matchedCatalogCount: number;
  newProblemsCount: number;
  existingEntryConflictCount: number;
  duplicateInCSVCount: number;
  duplicateGroups: DuplicateGroup[];
  rows: DryRunRow[];
}

export async function searchCatalogProblems(query: string) {
  await getCurrentUser();
  if (!query || query.trim().length < 2) return [];
  const q = query.trim().slice(0, LIMITS.searchQuery).toLowerCase();
  const num = parseInt(q, 10);

  return await prisma.problem.findMany({
    where: {
      OR: [
        ...(Number.isInteger(num) && num >= 0 && num <= 100_000 && /^\d+$/.test(q) ? [{ number: num }] : []),
        { title: { contains: q, mode: "insensitive" as const } },
        { slug: { contains: q, mode: "insensitive" as const } },
      ],
    },
    take: 10,
    select: {
      id: true,
      title: true,
      number: true,
      slug: true,
      platform: true,
      url: true,
      difficulty: true,
    },
  });
}

export async function dryRunImportCSV(csvText: string): Promise<DryRunSummary> {
  const user = await getCurrentUser();
  if (typeof csvText !== "string" || csvText.length > LIMITS.csvChars) {
    throw new Error("CSV is too large to import.");
  }

  const { cleaned: cleanedCsv } = sanitizeCsvText(csvText);

  const parsed = Papa.parse<Record<string, string>>(cleanedCsv, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
  });

  if (parsed.data.length > LIMITS.importRows) {
    throw new Error(`CSV has too many rows (max ${LIMITS.importRows}).`);
  }

  const [allProblems, userEntries] = await Promise.all([
    prisma.problem.findMany({
      select: { id: true, title: true, number: true, slug: true, platform: true, url: true },
    }),
    prisma.entry.findMany({
      where: { userId: user.id },
      select: {
        problemId: true,
        status: true,
        firstSolvedAt: true,
      },
    }),
  ]);

  const existingEntryMap = new Map<string, typeof userEntries[0]>();
  userEntries.forEach((e) => {
    existingEntryMap.set(e.problemId, e);
  });

  const problemBySlug = new Map<string, typeof allProblems[0]>();
  const problemByNumber = new Map<number, typeof allProblems[0]>();
  const problemByExactTitle = new Map<string, typeof allProblems[0]>();

  allProblems.forEach((p) => {
    problemBySlug.set(`${p.platform}_${p.slug}`, p);
    if (p.number != null) problemByNumber.set(p.number, p);
    problemByExactTitle.set(p.title.trim().toLowerCase(), p);
  });

  const rawRows: DryRunRow[] = [];
  const groupMap = new Map<string, DryRunRow[]>();

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    const rawName = (row["Problem Name"] || row["title"] || row["Name"] || "").trim();
    const rawLink = (row["Problem Link font"] || row["Problem Link"] || row["link"] || row["URL"] || "").trim();
    const rawTopic = (row["Topic"] || "").trim() || undefined;
    const rawPattern = (row["Pattern"] || "").trim() || undefined;
    const rawIdea = (row["Idea"] || "").trim() || undefined;
    const rawMistake = (row["What I did wrong"] || row["Mistake"] || "").trim() || undefined;
    const rawStatus = (row["Status"] || "").trim() || undefined;
    const rawRevisit = (row["Revisit?"] || row["Revisit"] || "").trim() || undefined;
    const rawSource = (row["Source"] || "").trim() || undefined;
    const rawSolvedDate =
      (row["Solved Date"] || row["Solved date"] || row["solved_date"] || "")
        .trim()
        .slice(0, 120) || undefined;

    if (!rawName && !rawLink) continue;

    let matchedProblem = null;
    let matchMethod: DryRunRow["matchMethod"] = undefined;
    const needsConfirmation = false;

    // 1. Slug match
    const slug = parseSlugFromUrl(rawLink);
    if (slug) {
      matchedProblem = problemBySlug.get(`LEETCODE_${slug}`) || problemBySlug.get(`GFG_${slug}`);
      if (matchedProblem) matchMethod = "SLUG";
    }

    // 2. Leading integer match (LeetCode numbers)
    if (!matchedProblem) {
      const leadingNum = parseLeadingNumber(rawName);
      if (leadingNum != null) {
        matchedProblem = problemByNumber.get(leadingNum);
        if (matchedProblem) matchMethod = "NUMBER";
      }
    }

    // 3. Case-insensitive exact title match
    if (!matchedProblem && rawName) {
      const cleanTitle = rawName.replace(/^\d+[\.\s\-]+/, "").trim().toLowerCase();
      matchedProblem = problemByExactTitle.get(cleanTitle) || problemByExactTitle.get(rawName.toLowerCase());
      if (matchedProblem) matchMethod = "TITLE_EXACT";
    }

    // 4. Unmatched handling: Check whether URL is GFG or Other
    if (!matchedProblem) {
      if (rawLink.includes("geeksforgeeks.org")) {
        matchMethod = "WILL_CREATE_GFG";
      } else {
        matchMethod = "WILL_CREATE_OTHER";
      }
    }

    // Existing entry conflict check
    let alreadyExistsInDB = false;
    let existingEntrySummary: string | undefined = undefined;
    if (matchedProblem && existingEntryMap.has(matchedProblem.id)) {
      alreadyExistsInDB = true;
      const existing = existingEntryMap.get(matchedProblem.id)!;
      existingEntrySummary = `Already logged as ${existing.status} on ${existing.firstSolvedAt.toISOString().slice(0, 10)}`;
    }

    const parsedStatus = mapRawStatus(rawStatus);
    const parsedRevisit = mapRawRevisit(rawRevisit);

    const rowObj: DryRunRow = {
      rowIndex: i + 1,
      rawName,
      rawLink,
      rawTopic,
      rawPattern,
      rawIdea,
      rawMistake,
      rawStatus,
      rawRevisit,
      rawSource,
      rawSolvedDate,
      matchedProblemId: matchedProblem?.id,
      matchedTitle: matchedProblem?.title || rawName,
      matchedNumber: matchedProblem?.number,
      matchedPlatform: matchedProblem?.platform || (matchMethod === "WILL_CREATE_GFG" ? Platform.GFG : Platform.OTHER),
      matchMethod,
      parsedStatus,
      parsedRevisit,
      needsConfirmation,
      alreadyExistsInDB,
      existingEntrySummary,
    };

    rawRows.push(rowObj);

    // Group key for duplicate detection
    const groupKey = matchedProblem ? matchedProblem.id : (slug ? `slug_${slug}` : `name_${rawName.toLowerCase()}`);
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, []);
    }
    groupMap.get(groupKey)!.push(rowObj);
  }

  // Process duplicate groups
  const duplicateGroups: DuplicateGroup[] = [];
  let duplicateInCSVCount = 0;
  let matchedCatalogCount = 0;
  let newProblemsCount = 0;
  let existingEntryConflictCount = 0;

  groupMap.forEach((rowsInGroup, groupKey) => {
    if (rowsInGroup.length > 1) {
      const suggestedFixes: DuplicateGroup["suggestedFixes"] = [];

      // Check each row in the group to see if its title/number indicates a mismatched URL
      rowsInGroup.forEach((r, idx) => {
        if (idx > 0) {
          r.isDuplicateInCSV = true;
          duplicateInCSVCount++;
        }
        r.duplicateGroupId = groupKey;

        // Detect title/number vs matched problem discrepancy
        const leadingNum = parseLeadingNumber(r.rawName);
        if (leadingNum != null && r.matchedNumber != null && leadingNum !== r.matchedNumber) {
          const actualProb = problemByNumber.get(leadingNum);
          if (actualProb) {
            suggestedFixes.push({
              rowIndex: r.rowIndex,
              reason: `Problem name starts with #${leadingNum} (${r.rawName}), but URL pointed to #${r.matchedNumber} (${r.matchedTitle}).`,
              suggestedProblemId: actualProb.id,
              suggestedTitle: actualProb.title,
              suggestedNumber: actualProb.number,
              suggestedPlatform: actualProb.platform,
              suggestedUrl: actualProb.url,
              suggestedMethod: "NUMBER",
            });
          }
        }
      });

      duplicateGroups.push({
        groupId: groupKey,
        matchedKey: groupKey,
        matchedProblemTitle: rowsInGroup[0].matchedTitle,
        rows: rowsInGroup,
        suggestedFixes,
      });
    }
  });

  // Calculate stats
  rawRows.forEach((r) => {
    if (r.matchedProblemId) {
      matchedCatalogCount++;
    } else {
      newProblemsCount++;
    }
    if (r.alreadyExistsInDB) {
      existingEntryConflictCount++;
    }
  });

  return {
    totalRows: rawRows.length,
    matchedCatalogCount,
    newProblemsCount,
    existingEntryConflictCount,
    duplicateInCSVCount,
    duplicateGroups,
    rows: rawRows,
  };
}

const CommitRowSchema = z.object({
  rowIndex: z.number().int(),
  rawName: z.string().max(LIMITS.title),
  rawLink: z.string().max(LIMITS.url),
  rawTopic: z.string().max(200).optional(),
  rawPattern: z.string().max(120).optional(),
  rawIdea: z.string().max(LIMITS.note).optional(),
  rawMistake: z.string().max(LIMITS.note).optional(),
  rawStatus: z.string().max(80).optional(),
  rawRevisit: z.string().max(20).optional(),
  rawSource: z.string().max(200).optional(),
  rawSolvedDate: z.string().max(120).optional(),
  matchedProblemId: z.string().max(64).optional(),
  parsedStatus: z.nativeEnum(SolveStatus),
  parsedRevisit: z.boolean(),
  isDuplicateInCSV: z.boolean().optional(),
});

export async function commitImportBatch(params: {
  rows: DryRunRow[];
  filename?: string;
  conflictStrategy?: "SKIP" | "OVERWRITE";
}) {
  const user = await getCurrentUser();
  const filename = z.string().max(255).optional().parse(params.filename) ?? "sheet_import.csv";
  const conflictStrategy = z.enum(["SKIP", "OVERWRITE"]).parse(params.conflictStrategy ?? "SKIP");
  if (!Array.isArray(params.rows) || params.rows.length > LIMITS.importRows) {
    throw new Error(`Too many rows to import (max ${LIMITS.importRows}).`);
  }
  const rows = params.rows.map((row) => CommitRowSchema.parse(row));

  const claimedIds = [...new Set(rows.map((r) => r.matchedProblemId).filter(Boolean))] as string[];
  const existingProblems =
    claimedIds.length > 0
      ? await prisma.problem.findMany({
          where: { id: { in: claimedIds } },
          select: { id: true },
        })
      : [];
  const validProblemIds = new Set(existingProblems.map((p) => p.id));

  const existingPatterns = await prisma.pattern.findMany({ select: { id: true, name: true } });
  const patternLookup = new Map<string, (typeof existingPatterns)[0]>();
  for (const p of existingPatterns) {
    patternLookup.set(p.name.trim().toLowerCase().replace(/\s+/g, " "), p);
  }

  for (const row of rows) {
    if (row.rawPattern) {
      const normalizedName = row.rawPattern.trim().replace(/\s+/g, " ").slice(0, 120);
      if (normalizedName) {
        const key = normalizedName.toLowerCase();
        let matched = patternLookup.get(key);
        if (!matched) {
          matched = await prisma.pattern.upsert({
            where: { name: normalizedName },
            update: {},
            create: {
              name: normalizedName,
              family: "Imported",
              sortOrder: 999,
            },
          });
          patternLookup.set(key, matched);
        }
        row.rawPattern = matched.name;
      }
    }
  }

  return await prisma.$transaction(
    async (tx) => {
      const importBatch = await tx.importBatch.create({
        data: {
          userId: user.id,
          filename,
          entryCount: rows.length,
          status: "COMMITTED",
        },
      });

      const userExistingEntries = await tx.entry.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          problemId: true,
          idea: true,
          mistake: true,
          topic: true,
          customPattern: true,
          patternOverride: true,
          customUrl: true,
          sourceList: true,
        },
      });
      const existingEntryMap = new Map(userExistingEntries.map((e) => [e.problemId, e]));

      const entriesToSeed: Array<{ id: string; status: SolveStatus; revisit: boolean }> = [];
      const processedProblemIds = new Set<string>();

      for (const row of rows) {
        if (row.isDuplicateInCSV && processedProblemIds.has(row.matchedProblemId || row.rawName)) {
          continue;
        }

        let problemId = row.matchedProblemId;
        if (problemId && !validProblemIds.has(problemId)) {
          problemId = undefined;
        }

        if (!problemId) {
          const cleanSlug = (row.rawName || "unnamed")
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, "-")
            .replace(/-+/g, "-")
            .slice(0, 50);

          const platform = row.rawLink.includes("geeksforgeeks.org") ? Platform.GFG : Platform.OTHER;

          const newProb = await tx.problem.create({
            data: {
              platform,
              slug: `${cleanSlug}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
              title: (row.rawName || "Untitled Problem").slice(0, LIMITS.title),
              url: storedHttpUrl(row.rawLink) || "",
              topicTags: row.rawTopic ? [row.rawTopic.slice(0, 80)] : [],
            },
          });
          problemId = newProb.id;
        }

        processedProblemIds.add(problemId);

        const existingEntry = existingEntryMap.get(problemId);
        const safeLink = storedHttpUrl(row.rawLink) || undefined;

        if (existingEntry) {
          if (conflictStrategy === "SKIP") {
            continue;
          }

          const updated = await tx.entry.update({
            where: { id: existingEntry.id },
            data: {
              status: row.parsedStatus,
              idea: row.rawIdea || existingEntry.idea,
              mistake: row.rawMistake || existingEntry.mistake,
              topic: row.rawTopic || existingEntry.topic,
              customPattern: row.rawPattern || existingEntry.customPattern,
              patternOverride: row.rawPattern ? [row.rawPattern] : existingEntry.patternOverride,
              customUrl: safeLink || existingEntry.customUrl,
              sourceList: row.rawSource || existingEntry.sourceList,
              revisit: row.parsedRevisit,
              importBatchId: importBatch.id,
            },
          });

          entriesToSeed.push({
            id: updated.id,
            status: updated.status,
            revisit: updated.revisit,
          });
          continue;
        }

        const solvedAt = parseSolvedDate(row.rawSolvedDate) ?? new Date();

        const entry = await tx.entry.create({
          data: {
            userId: user.id,
            problemId,
            status: row.parsedStatus,
            idea: row.rawIdea,
            mistake: row.rawMistake,
            topic: row.rawTopic,
            customPattern: row.rawPattern,
            patternOverride: row.rawPattern ? [row.rawPattern] : [],
            customUrl: safeLink,
            sourceList: row.rawSource || "csv-import",
            revisit: row.parsedRevisit,
            firstSolvedAt: solvedAt,
            importBatchId: importBatch.id,
          },
        });

        entriesToSeed.push({
          id: entry.id,
          status: entry.status,
          revisit: entry.revisit,
        });
      }

      const spreadResults = spreadImportDueDates(entriesToSeed, new Date());
      const seedById = new Map(entriesToSeed.map((e) => [e.id, e]));

      for (const spread of spreadResults) {
        const seeded = seedCard({
          entryId: spread.id,
          rating: spread.seededRating,
          now: new Date(),
        });

        await tx.reviewCard.upsert({
          where: { entryId: spread.id },
          update: {
            due: spread.due,
            stability: seeded.stability,
            difficulty: seeded.difficulty,
            elapsedDays: seeded.elapsedDays,
            scheduledDays: seeded.scheduledDays,
            reps: seeded.reps,
            lapses: seeded.lapses,
            state: seeded.state,
            lastReview: new Date(),
          },
          create: {
            entryId: spread.id,
            due: spread.due,
            stability: seeded.stability,
            difficulty: seeded.difficulty,
            elapsedDays: seeded.elapsedDays,
            scheduledDays: seeded.scheduledDays,
            reps: seeded.reps,
            lapses: seeded.lapses,
            state: seeded.state,
            lastReview: new Date(),
          },
        });
      }

      return {
        batchId: importBatch.id,
        count: entriesToSeed.length,
      };
    },
    {
      maxWait: 20000,
      timeout: 120000,
    }
  );
}
