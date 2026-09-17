import React, { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseSlugFromUrl } from "@/lib/import-utils";
import {
  RoadmapClient,
  RoadmapPatternData,
  RoadmapItemData,
} from "@/components/roadmap/roadmap-client";
import { PageSkeleton } from "@/components/ui/loader";
import { SheetSection } from "@/components/ui/sheet-section";

export const dynamic = "force-dynamic";

export default function RoadmapPage() {
  return (
    <Suspense
      fallback={
        <SheetSection band="none" last>
          <PageSkeleton rows={8} />
        </SheetSection>
      }
    >
      <RoadmapData />
    </Suspense>
  );
}

async function RoadmapData() {
  const user = await getCurrentUser();

  const [patterns, userEntries] = await Promise.all([
    prisma.roadmapPattern.findMany({
      orderBy: { order: "asc" },
      include: {
        items: {
          orderBy: { order: "asc" },
          include: {
            canonicalProblem: { select: { number: true } },
          },
        },
      },
    }),
    prisma.entry.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        status: true,
        customUrl: true,
        problemId: true,
        problem: { select: { slug: true, url: true } },
      },
    }),
  ]);

  const solvedProblemIds = new Set<string>();
  const solvedSlugs = new Set<string>();
  const solvedUrls = new Set<string>();
  const entryByProblemId = new Map<string, (typeof userEntries)[0]>();
  const entryBySlug = new Map<string, (typeof userEntries)[0]>();
  const entryByUrl = new Map<string, (typeof userEntries)[0]>();

  userEntries.forEach((e) => {
    solvedProblemIds.add(e.problemId);
    entryByProblemId.set(e.problemId, e);

    if (e.problem.slug) {
      const s = e.problem.slug.toLowerCase();
      solvedSlugs.add(s);
      entryBySlug.set(s, e);
    }

    const registerUrl = (raw: string) => {
      const clean = raw.trim().toLowerCase().replace(/\/$/, "");
      solvedUrls.add(clean);
      entryByUrl.set(clean, e);
    };

    if (e.problem.url) registerUrl(e.problem.url);
    if (e.customUrl) registerUrl(e.customUrl);
  });

  const checkItemSolved = (item: (typeof patterns)[0]["items"][0]) => {
    if (item.canonicalProblemId && solvedProblemIds.has(item.canonicalProblemId)) {
      return entryByProblemId.get(item.canonicalProblemId);
    }

    if (item.primaryUrl) {
      const cleanUrl = item.primaryUrl.trim().toLowerCase().replace(/\/$/, "");
      if (solvedUrls.has(cleanUrl)) {
        return entryByUrl.get(cleanUrl);
      }

      const slug = parseSlugFromUrl(item.primaryUrl);
      if (slug && solvedSlugs.has(slug.toLowerCase())) {
        return entryBySlug.get(slug.toLowerCase());
      }
    }

    for (const url of item.additionalUrls) {
      const cleanUrl = url.trim().toLowerCase().replace(/\/$/, "");
      if (solvedUrls.has(cleanUrl)) {
        return entryByUrl.get(cleanUrl);
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
