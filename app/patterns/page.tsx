import React, { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { calculateRetrievability, type ReviewCardData } from "@/lib/scheduler";
import { getPatternCue } from "@/lib/cues";
import { PatternsClient, type PatternData } from "@/components/patterns-client";
import { SheetSection } from "@/components/ui/sheet-section";

export const dynamic = "force-dynamic";

export default function PatternsPage() {
  return (
    <Suspense fallback={<PatternsSkeleton />}>
      <PatternsData />
    </Suspense>
  );
}

async function PatternsData() {
  const user = await getCurrentUser();
  const now = new Date();

  const patterns = await prisma.pattern.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      drills: {
        where: { userId: user.id },
        orderBy: { at: "desc" },
        take: 1,
        select: { at: true, correct: true },
      },
      problems: {
        select: {
          problem: {
            select: {
              id: true,
              title: true,
              number: true,
              url: true,
              difficulty: true,
              platform: true,
              entries: {
                where: { userId: user.id },
                select: {
                  id: true,
                  status: true,
                  revisit: true,
                  reviewCard: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const enriched: PatternData[] = patterns.map((pattern) => {
    const problemItems: PatternData["problems"] = [];

    let totalRetrievability = 0;
    let cardCount = 0;
    let leechCount = 0;
    let solvedCount = 0;

    pattern.problems.forEach((pp) => {
      const prob = pp.problem;
      const entry = prob.entries[0];
      let r: number | undefined;

      if (entry) {
        if (entry.status === "SOLVED_UNAIDED" || entry.status === "SOLVED_WITH_HELP") {
          solvedCount++;
        }
        if (entry.reviewCard) {
          const card = entry.reviewCard as unknown as ReviewCardData;
          r = calculateRetrievability(card, now);
          totalRetrievability += r;
          cardCount++;
          if (card.lapses >= 3) leechCount++;
        }
      }

      problemItems.push({
        problemId: prob.id,
        title: prob.title,
        number: prob.number,
        url: prob.url,
        difficulty: prob.difficulty,
        platform: prob.platform,
        entryId: entry?.id,
        status: entry?.status,
        retrievability: r,
        lapses: entry?.reviewCard?.lapses,
        due: entry?.reviewCard?.due?.toISOString() ?? null,
        lastReview: entry?.reviewCard?.lastReview?.toISOString() ?? null,
        revisit: entry?.revisit,
      });
    });

    const meanRetrievability = cardCount > 0 ? totalRetrievability / cardCount : null;

    return {
      id: pattern.id,
      name: pattern.name,
      family: pattern.family,
      sortOrder: pattern.sortOrder,
      cue: getPatternCue(pattern.name),
      totalProblems: pattern.problems.length,
      loggedCount: problemItems.filter((p) => p.entryId).length,
      solvedCount,
      cardCount,
      leechCount,
      meanRetrievability,
      lastDrilledAt: pattern.drills[0]?.at?.toISOString() ?? null,
      problems: problemItems,
    };
  });

  return <PatternsClient patterns={enriched} />;
}

function PatternsSkeleton() {
  return (
    <div className="animate-pulse">
      <SheetSection innerClassName="flex flex-wrap items-center justify-between gap-4 py-6">
        <div>
          <div className="h-7 w-48 bg-muted rounded"></div>
          <div className="mt-2 h-4 w-96 bg-muted rounded"></div>
        </div>
        <div className="flex gap-3">
          <div className="h-4 w-16 bg-muted rounded"></div>
          <div className="h-4 w-16 bg-muted rounded"></div>
          <div className="h-4 w-16 bg-muted rounded"></div>
        </div>
      </SheetSection>

      <SheetSection innerClassName="py-6" band="none">
        <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="h-20 bg-background p-3 flex flex-col justify-between">
              <div className="h-3 w-20 bg-muted rounded"></div>
              <div className="flex justify-between">
                <div className="h-4 w-8 bg-muted rounded"></div>
                <div className="h-3 w-12 bg-muted rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </SheetSection>
    </div>
  );
}
