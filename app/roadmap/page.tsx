import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseSlugFromUrl } from "@/lib/import-utils";
import {
  RoadmapClient,
  RoadmapPatternData,
  RoadmapItemData,
} from "@/components/roadmap/roadmap-client";

export const dynamic = "force-dynamic";

export default async function RoadmapPage() {
  const user = await getCurrentUser();

  const [patterns, userEntries] = await Promise.all([
    prisma.roadmapPattern.findMany({
      orderBy: { order: "asc" },
      include: {
        items: {
          orderBy: { order: "asc" },
          include: {
            canonicalProblem: true,
          },
        },
      },
    }),
    prisma.entry.findMany({
      where: { userId: user.id },
      include: {
        problem: true,
      },
    }),
  ]);

  // Build lookup sets and maps for multi-dimensional matching
  const solvedProblemIds = new Set<string>();
  const solvedSlugs = new Set<string>();
  const solvedUrls = new Set<string>();
  const entryByProblemId = new Map<string, typeof userEntries[0]>();
  const entryBySlug = new Map<string, typeof userEntries[0]>();

  userEntries.forEach((e) => {
    solvedProblemIds.add(e.problemId);
    entryByProblemId.set(e.problemId, e);

    if (e.problem.slug) {
      const s = e.problem.slug.toLowerCase();
      solvedSlugs.add(s);
      entryBySlug.set(s, e);
    }

    if (e.problem.url) {
      solvedUrls.add(e.problem.url.trim().toLowerCase().replace(/\/$/, ""));
    }
    if (e.customUrl) {
      solvedUrls.add(e.customUrl.trim().toLowerCase().replace(/\/$/, ""));
    }
  });

  const checkItemSolved = (item: typeof patterns[0]["items"][0]) => {
    // 1. Direct canonical problem ID match
    if (item.canonicalProblemId && solvedProblemIds.has(item.canonicalProblemId)) {
      return entryByProblemId.get(item.canonicalProblemId);
    }

    // 2. Primary URL direct match or slug match
    if (item.primaryUrl) {
      const cleanUrl = item.primaryUrl.trim().toLowerCase().replace(/\/$/, "");
      if (solvedUrls.has(cleanUrl)) {
        const matchingEntry = userEntries.find(
          (e) => (e.customUrl || e.problem.url).trim().toLowerCase().replace(/\/$/, "") === cleanUrl
        );
        if (matchingEntry) return matchingEntry;
      }

      const slug = parseSlugFromUrl(item.primaryUrl);
      if (slug && solvedSlugs.has(slug.toLowerCase())) {
        return entryBySlug.get(slug.toLowerCase());
      }
    }

    // 3. Additional URLs match
    for (const url of item.additionalUrls) {
      const cleanUrl = url.trim().toLowerCase().replace(/\/$/, "");
      if (solvedUrls.has(cleanUrl)) {
        const matchingEntry = userEntries.find(
          (e) => (e.customUrl || e.problem.url).trim().toLowerCase().replace(/\/$/, "") === cleanUrl
        );
        if (matchingEntry) return matchingEntry;
      }

      const slug = parseSlugFromUrl(url);
      if (slug && solvedSlugs.has(slug.toLowerCase())) {
        return entryBySlug.get(slug.toLowerCase());
      }
    }

    return undefined;
  };

  const initialPatterns: RoadmapPatternData[] = patterns.map((section) => {
    const items: RoadmapItemData[] = section.items.map((item) => {
      const entry = checkItemSolved(item);
      const isSolved = Boolean(entry);

      return {
        id: item.id,
        title: item.title,
        order: item.order,
        primaryUrl: item.primaryUrl,
        additionalUrls: item.additionalUrls,
        canonicalProblemId: item.canonicalProblemId,
        canonicalProblemNumber: item.canonicalProblem?.number,
        isSolved,
        entryId: entry?.id,
        solveStatus: entry?.status,
      };
    });

    return {
      id: section.id,
      name: section.name,
      order: section.order,
      items,
    };
  });

  return <RoadmapClient initialPatterns={initialPatterns} />;
}
