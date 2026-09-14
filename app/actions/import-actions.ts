"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Platform, SolveStatus } from "@prisma/client";
import Papa from "papaparse";
import { seedCard, spreadImportDueDates } from "@/lib/scheduler";
import {
  DryRunRow,
  parseSlugFromUrl,
  parseLeadingNumber,
  mapRawStatus,
  mapRawRevisit,
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
  if (!query || query.trim().length < 2) return [];
  const q = query.trim().toLowerCase();
  const num = parseInt(q, 10);

  return await prisma.problem.findMany({
    where: {
      OR: [
        ...(isNaN(num) ? [] : [{ number: num }]),
        { title: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
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

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
  });

  const [allProblems, userEntries] = await Promise.all([
    prisma.problem.findMany(),
    prisma.entry.findMany({
      where: { userId: user.id },
      include: { problem: true },
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

export async function commitImportBatch(params: {
  rows: DryRunRow[];
  filename?: string;
  conflictStrategy?: "SKIP" | "OVERWRITE";
}) {
  const user = await getCurrentUser();
  const { rows, filename = "sheet_import.csv", conflictStrategy = "SKIP" } = params;

  return await prisma.$transaction(
    async (tx) => {
      // 1. Create ImportBatch
      const importBatch = await tx.importBatch.create({
        data: {
          userId: user.id,
          filename,
          entryCount: rows.length,
          status: "COMMITTED",
        },
      });

      // Pre-fetch all user entries in ONE query to eliminate 100+ round trips
      const userExistingEntries = await tx.entry.findMany({
        where: { userId: user.id },
      });
      const existingEntryMap = new Map(userExistingEntries.map((e) => [e.problemId, e]));

      const entriesToSeed: Array<{ id: string; status: SolveStatus; revisit: boolean }> = [];
      const processedProblemIds = new Set<string>();

      // 2. Process rows
      for (const row of rows) {
        // If row was explicitly marked unresolved duplicate, skip
        if (row.isDuplicateInCSV && processedProblemIds.has(row.matchedProblemId || row.rawName)) {
          continue;
        }

        let problemId = row.matchedProblemId;

        // If unmatched, create GFG or OTHER problem preserving spreadsheet data
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
              title: row.rawName || "Untitled Problem",
              url: row.rawLink || "#",
              topicTags: row.rawTopic ? [row.rawTopic] : [],
            },
          });
          problemId = newProb.id;
        }

        processedProblemIds.add(problemId);

        // Check if entry already exists in DB
        const existingEntry = existingEntryMap.get(problemId);

        if (existingEntry) {
          if (conflictStrategy === "SKIP") {
            // Do not overwrite existing entry!
            continue;
          }

          // OVERWRITE mode: update fields
          const updated = await tx.entry.update({
            where: { id: existingEntry.id },
            data: {
              status: row.parsedStatus,
              idea: row.rawIdea || existingEntry.idea,
              mistake: row.rawMistake || existingEntry.mistake,
              topic: row.rawTopic || existingEntry.topic,
              customPattern: row.rawPattern || existingEntry.customPattern,
              patternOverride: row.rawPattern ? [row.rawPattern] : existingEntry.patternOverride,
              customUrl: row.rawLink || existingEntry.customUrl,
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

        // Create brand-new entry preserving all 9 columns
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
            customUrl: row.rawLink,
            sourceList: row.rawSource || "csv-import",
            revisit: row.parsedRevisit,
            firstSolvedAt: new Date(),
            importBatchId: importBatch.id,
          },
        });

        entriesToSeed.push({
          id: entry.id,
          status: entry.status,
          revisit: entry.revisit,
        });
      }

      // 3. 21-Day Import Spread & Card Seeding for all new/updated entries
      const spreadResults = spreadImportDueDates(entriesToSeed, new Date());

      for (const spread of spreadResults) {
        const item = entriesToSeed.find((e) => e.id === spread.id);
        const seeded = seedCard({
          entryId: spread.id,
          status: item?.status || SolveStatus.SOLVED_UNAIDED,
          revisit: item?.revisit || false,
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
