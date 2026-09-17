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
        <div className="animate-pulse">
          <SheetSection innerClassName="space-y-4 py-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="h-7 w-48 bg-muted rounded"></div>
                <div className="mt-2 h-4 w-96 bg-muted rounded"></div>
              </div>

              <div className="flex shrink-0 items-center gap-4 bg-muted/30 px-4 py-3 border border-border">
                <div className="space-y-1">
                  <div className="h-3 w-20 bg-muted rounded"></div>
                  <div className="h-4 w-12 bg-muted rounded"></div>
                </div>
                <div className="space-y-1">
                  <div className="h-3 w-8 bg-muted rounded ml-auto"></div>
                  <div className="h-1.5 w-24 bg-muted rounded"></div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-stretch justify-between gap-3 pt-2 text-xs sm:flex-row sm:items-center">
              <div className="h-8 w-full max-w-md bg-muted/40 border border-border"></div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-44 bg-muted/40 border border-border"></div>
                <div className="h-8 w-24 bg-muted/40 border border-border"></div>
              </div>
            </div>
          </SheetSection>
          
          <SheetSection innerClassName="py-6" last>
            <div className="divide-y divide-border border border-border bg-background">
              <div>
                <div className="flex w-full items-center justify-between bg-muted/30 px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 bg-muted rounded"></div>
                    <div className="h-5 w-5 bg-background border border-border"></div>
                    <div className="h-4 w-40 bg-muted rounded"></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-20 bg-muted rounded"></div>
                    <div className="hidden h-1.5 w-16 bg-muted sm:block"></div>
                  </div>
                </div>
                <div className="divide-y divide-border border-t border-border bg-background">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-3 w-4 bg-muted/60 rounded"></div>
                        <div className="h-4 w-4 rounded-full border border-border"></div>
                        <div className="h-4 w-56 bg-muted rounded"></div>
                      </div>
                      <div className="h-3 w-16 bg-muted/60 rounded"></div>
                    </div>
                  ))}
                </div>
              </div>

              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <div className="flex w-full items-center justify-between bg-muted/30 px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-4 bg-muted rounded"></div>
                      <div className="h-5 w-5 bg-background border border-border"></div>
                      <div className="h-4 w-36 bg-muted rounded"></div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-20 bg-muted rounded"></div>
                      <div className="hidden h-1.5 w-16 bg-muted sm:block"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SheetSection>
        </div>
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
