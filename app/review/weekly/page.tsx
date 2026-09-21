import React, { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { calculateRetrievability, type ReviewCardData } from "@/lib/scheduler";
import { getPatternCue } from "@/lib/cues";
import { WeeklyReviewClient, type WeeklyData } from "@/components/weekly-review-client";
import { SheetSection } from "@/components/ui/sheet-section";
import { SpecGrid, SpecCell } from "@/components/ui/spec-sheet";

export const dynamic = "force-dynamic";

export default function WeeklyReviewPage() {
  return (
    <Suspense fallback={<WeeklySkeleton />}>
      <WeeklyReviewData />
    </Suspense>
  );
}

async function WeeklyReviewData() {
  const user = await getCurrentUser();
  const now = new Date();

  const settings = await prisma.userSettings.findUnique({
    where: { userId: user.id },
  });
  const targetRetention = settings?.desiredRetention ?? 0.80;

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
        where: {
          problem: {
            entries: { some: { userId: user.id } },
          },
        },
        select: {
          problem: {
            select: {
              id: true,
              title: true,
              number: true,
              url: true,
              difficulty: true,
              entries: {
                where: { userId: user.id },
                select: { reviewCard: true },
              },
            },
          },
        },
      },
    },
  });

  const enrichedPatterns = patterns.map((p) => {
    const cards: Array<{
      card: ReviewCardData;
      problem: { id: string; title: string; number: number | null; url: string; difficulty: string | null };
    }> = [];

    p.problems.forEach((pp) => {
      pp.problem.entries.forEach((entry) => {
        if (entry.reviewCard) {
          cards.push({
            card: entry.reviewCard as unknown as ReviewCardData,
            problem: {
              id: pp.problem.id,
              title: pp.problem.title,
              number: pp.problem.number,
              url: pp.problem.url,
              difficulty: pp.problem.difficulty,
            },
          });
        }
      });
    });

    const avgRetrievability = cards.length
      ? cards.reduce((sum, item) => sum + calculateRetrievability(item.card, now), 0) / cards.length
      : null;

    const reviewDates = cards
      .map((c) => (c.card.lastReview ? new Date(c.card.lastReview).getTime() : 0))
      .filter((t) => t > 0);
    const latestReview = reviewDates.length ? Math.max(...reviewDates) : null;
    const daysSinceReview = latestReview
      ? Math.floor((now.getTime() - latestReview) / (1000 * 60 * 60 * 24))
      : null;
    const lastDrilledAt = p.drills[0]?.at ?? null;
    const daysSinceDrill = lastDrilledAt
      ? Math.floor((now.getTime() - lastDrilledAt.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      id: p.id,
      name: p.name,
      family: p.family,
      sortOrder: p.sortOrder,
      cue: getPatternCue(p.name),
      avgRetrievability: avgRetrievability ?? 1.0,
      hasCards: cards.length > 0,
      cardCount: cards.length,
      daysSinceReview,
      isBelowTarget: avgRetrievability != null && avgRetrievability < targetRetention && p.drills[0]?.correct !== true,
      isUntouched14Days: daysSinceDrill == null || daysSinceDrill >= 14,
      lastDrilledAt: lastDrilledAt?.toISOString() ?? null,
      sampleProblems: cards.slice(0, 4).map((c) => c.problem),
    };
  });

  const belowTarget = enrichedPatterns.filter((p) => p.hasCards && p.isBelowTarget);
  const untouched14Days = enrichedPatterns.filter((p) => p.hasCards && p.isUntouched14Days && !p.isBelowTarget);
  const healthy = enrichedPatterns.filter((p) => p.hasCards && !p.isBelowTarget && !p.isUntouched14Days);
  const unpracticed = enrichedPatterns.filter((p) => !p.hasCards);

  const data: WeeklyData = {
    targetRetention,
    summary: {
      belowTargetCount: belowTarget.length,
      untouchedCount: untouched14Days.length,
      healthyCount: healthy.length,
      unpracticedCount: unpracticed.length,
    },
    belowTarget,
    untouched14Days,
    healthy,
    all: enrichedPatterns,
  };

  return <WeeklyReviewClient data={data} />;
}

function WeeklySkeleton() {
  return (
    <div className="animate-pulse">
      <SheetSection innerClassName="py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="h-7 w-64 bg-muted rounded"></div>
            <div className="mt-2 h-4 w-96 bg-muted rounded"></div>
          </div>
          <div className="flex gap-3">
            <div className="h-8 w-32 bg-muted rounded"></div>
            <div className="h-8 w-24 bg-muted rounded"></div>
          </div>
        </div>
      </SheetSection>

      <SheetSection innerClassName="py-6" band="neutral">
        <SpecGrid columns={4}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SpecCell
              key={i}
              label={<div className="h-3 w-24 bg-muted/60 rounded" />}
              value={<div className="h-6 w-12 bg-muted rounded mt-1" />}
            />
          ))}
        </SpecGrid>
      </SheetSection>

      <SheetSection innerClassName="space-y-4 py-6">
        <div className="flex items-center justify-between">
          <div className="h-5 w-48 bg-muted rounded"></div>
          <div className="h-4 w-20 bg-muted rounded"></div>
        </div>
        <div className="divide-y divide-border border border-border bg-background">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-4 space-y-3">
              <div className="h-4 w-3/4 bg-muted rounded"></div>
              <div className="h-4 w-1/2 bg-muted rounded"></div>
            </div>
          ))}
        </div>
      </SheetSection>
    </div>
  );
}
