import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { PrismaClient } from "@prisma/client";
import { parseSlugFromUrl, parseLeadingNumber } from "../lib/import-utils";

const prisma = new PrismaClient();

export async function importRoadmapFromCSV(csvFilePath?: string) {
  const targetPath =
    csvFilePath || path.join(process.cwd(), "data", "youtuber-roadmap.csv");

  if (!fs.existsSync(targetPath)) {
    throw new Error(`Roadmap CSV file not found at ${targetPath}`);
  }

  const fileContent = fs.readFileSync(targetPath, "utf-8");
  const parsed = Papa.parse<string[]>(fileContent, {
    header: false,
    skipEmptyLines: "greedy",
  });

  // Load all problems (both canonical catalog and custom created) for link matching
  const allProblems = await prisma.problem.findMany({
    select: { id: true, platform: true, slug: true, title: true, number: true, url: true },
  });

  const problemBySlug = new Map<string, string>();
  const problemByNumber = new Map<number, string>();
  const problemByExactTitle = new Map<string, string>();
  const problemByUrl = new Map<string, string>();

  allProblems.forEach((p) => {
    problemBySlug.set(`${p.platform}_${p.slug}`, p.id);
    problemBySlug.set(`ANY_${p.slug}`, p.id);
    if (p.number != null) problemByNumber.set(p.number, p.id);
    problemByExactTitle.set(p.title.trim().toLowerCase(), p.id);
    if (p.url) problemByUrl.set(p.url.trim().toLowerCase().replace(/\/$/, ""), p.id);
  });

  console.log(`Loaded ${allProblems.length} catalog/database problems for roadmap matching.`);

  let currentPatternName = "General Roadmap";
  let currentPatternOrder = 0;
  let itemOrderInPattern = 0;

  // Clear existing roadmap data safely (does NOT touch Problem, Entry, or Attempt)
  await prisma.roadmapItem.deleteMany();
  await prisma.roadmapPattern.deleteMany();

  let activePatternRecord: { id: string } | null = null;
  let totalItemsCount = 0;
  let matchedCanonicalCount = 0;

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    if (!row || row.length < 2) continue;

    const col0 = (row[0] || "").trim();
    const col1 = (row[1] || "").trim();
    const link1 = (row[2] || "").trim();
    const link2 = (row[3] || "").trim();
    const link3 = (row[4] || "").trim();

    // Skip the top header row
    if (col0 === "Pattern" && col1 === "Question") continue;
    if (col0.includes("INSTA Channel") || col1.includes("INSTA Channel")) continue;

    // Check if this row is a Pattern Section Heading
    const isHeading =
      (!link1 && !link2 && !link3 && col1.length > 0 && !col1.startsWith("http")) ||
      col1.toLowerCase().includes("pattern:") ||
      col1.toLowerCase() === "tree pattern" ||
      col1.toLowerCase() === "graphs" ||
      col1.toLowerCase().includes("dynamic programming") ||
      col1.toLowerCase().includes("greedy");

    if (isHeading) {
      currentPatternName = col1 || col0;
      currentPatternOrder++;
      itemOrderInPattern = 0;

      activePatternRecord = await prisma.roadmapPattern.create({
        data: {
          name: currentPatternName,
          order: currentPatternOrder,
        },
      });

      console.log(`[Roadmap] Created Pattern Section ${currentPatternOrder}: "${currentPatternName}"`);
      continue;
    }

    // It's a question row!
    if (!col1 && !link1) continue;

    if (!activePatternRecord) {
      currentPatternOrder++;
      activePatternRecord = await prisma.roadmapPattern.create({
        data: {
          name: currentPatternName,
          order: currentPatternOrder,
        },
      });
    }

    itemOrderInPattern++;
    totalItemsCount++;

    const primaryUrl = link1 || undefined;
    const additionalUrls: string[] = [];
    if (link2 && link2.startsWith("http")) additionalUrls.push(link2);
    if (link3 && link3.startsWith("http")) additionalUrls.push(link3);

    const allUrls = [primaryUrl, ...additionalUrls].filter(Boolean) as string[];

    // Match canonical problem:
    let canonicalProblemId: string | null = null;

    // 1. Slug matching from URLs
    for (const url of allUrls) {
      const slug = parseSlugFromUrl(url);
      if (slug) {
        canonicalProblemId =
          problemBySlug.get(`LEETCODE_${slug}`) ||
          problemBySlug.get(`GFG_${slug}`) ||
          problemBySlug.get(`ANY_${slug}`) ||
          null;
        if (canonicalProblemId) break;
      }

      // Exact URL match
      const cleanUrl = url.trim().toLowerCase().replace(/\/$/, "");
      if (problemByUrl.has(cleanUrl)) {
        canonicalProblemId = problemByUrl.get(cleanUrl)!;
        break;
      }
    }

    // 2. Leading number match
    if (!canonicalProblemId) {
      const leadingNum = parseLeadingNumber(col1);
      if (leadingNum != null && problemByNumber.has(leadingNum)) {
        canonicalProblemId = problemByNumber.get(leadingNum)!;
      }
    }

    // 3. Exact title match
    if (!canonicalProblemId && col1) {
      const cleanTitle = col1.replace(/^\d+[\.\s\-]+/, "").trim().toLowerCase();
      if (problemByExactTitle.has(cleanTitle)) {
        canonicalProblemId = problemByExactTitle.get(cleanTitle)!;
      }
    }

    if (canonicalProblemId) {
      matchedCanonicalCount++;
    }

    await prisma.roadmapItem.create({
      data: {
        roadmapPatternId: activePatternRecord.id,
        title: col1 || "Untitled Question",
        primaryUrl,
        additionalUrls,
        order: itemOrderInPattern,
        canonicalProblemId,
      },
    });
  }

  console.log(
    `[Roadmap Complete] Ingested ${currentPatternOrder} pattern sections and ${totalItemsCount} items (${matchedCanonicalCount} matched to canonical catalog).`
  );
}

importRoadmapFromCSV()
  .then(() => {
    console.log("Roadmap import finished successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Roadmap import failed:", err);
    process.exit(1);
  });
