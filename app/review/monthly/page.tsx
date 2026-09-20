import React, { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { calculateRetrievability, type ReviewCardData } from "@/lib/scheduler";
import { MonthlyReviewClient } from "@/components/monthly-review-client";
import type { MonthlyMockProblem } from "@/components/monthly-mock-provider";
import { SheetSection } from "@/components/ui/sheet-section";

export const dynamic = "force-dynamic";

export default function MonthlyMockPage() {
  return (
    <Suspense fallback={<MonthlySkeleton />}>
      <MonthlyMockData />
    </Suspense>
  );
}

async function MonthlyMockData() {
  const user = await getCurrentUser();
  const now = new Date();

  const patterns = await prisma.pattern.findMany({
    include: {
      problems: {
        select: {
          problem: {
            select: {
              id: true,
              title: true,
              number: true,
              url: true,
              platform: true,
              difficulty: true,
              entries: {
                where: { userId: user.id },
                select: { id: true, reviewCard: true },
              },
            },
          },
        },
      },
    },
  });

  const patternScores = patterns.map((p) => {
    const cards = p.problems
      .flatMap((pp) => pp.problem.entries.map((e) => e.reviewCard))
      .filter((c): c is NonNullable<typeof c> => Boolean(c));

    const avgRetrievability = cards.length
      ? cards.reduce((sum, c) => sum + calculateRetrievability(c as ReviewCardData, now), 0) / cards.length
      : 0.5;

    return {
      id: p.id,
      name: p.name,
      family: p.family,
      avgRetrievability,
      problems: p.problems.map((pp) => pp.problem),
    };
  });

  patternScores.sort((a, b) => a.avgRetrievability - b.avgRetrievability);

  const selectedProblems: MonthlyMockProblem[] = [];
  const usedProblemIds = new Set<string>();
  const usedFamilies = new Set<string>();

  for (const pat of patternScores) {
    if (selectedProblems.length >= 5) break;
    if (usedFamilies.has(pat.family)) continue;

    const candidate = pat.problems.find((p) => !usedProblemIds.has(p.id));
    if (candidate) {
      usedProblemIds.add(candidate.id);
      usedFamilies.add(pat.family);
      selectedProblems.push({
        id: candidate.id,
        entryId: candidate.entries[0]?.id,
        title: candidate.title,
        number: candidate.number,
        url: candidate.url,
        platform: candidate.platform,
        patternName: pat.name,
        difficulty: candidate.difficulty as MonthlyMockProblem["difficulty"],
      });
    }
  }

  if (selectedProblems.length < 5) {
    const fillerProblems = await prisma.problem.findMany({
      where: { id: { notIn: Array.from(usedProblemIds) } },
      take: 5 - selectedProblems.length,
      select: {
        id: true,
        title: true,
        number: true,
        url: true,
        platform: true,
        difficulty: true,
        patterns: { select: { pattern: { select: { name: true } } }, take: 1 },
        entries: { where: { userId: user.id }, select: { id: true }, take: 1 },
      },
    });

    for (const fp of fillerProblems) {
      selectedProblems.push({
        id: fp.id,
        entryId: fp.entries[0]?.id,
        title: fp.title,
        number: fp.number,
        url: fp.url,
        platform: fp.platform,
        patternName: fp.patterns[0]?.pattern.name || "General",
        difficulty: fp.difficulty as MonthlyMockProblem["difficulty"],
      });
    }
  }

  return <MonthlyReviewClient initialCatalog={selectedProblems} />;
}

function MonthlySkeleton() {
  return (
    <div className="animate-pulse">
      <SheetSection innerClassName="mx-auto space-y-5 py-8">
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 bg-muted rounded"></div>
            <div className="h-4 w-36 bg-muted rounded"></div>
          </div>

          <div className="h-8 w-96 bg-muted rounded"></div>

          <div className="space-y-2">
            <div className="h-4 w-full bg-muted rounded"></div>
            <div className="h-4 w-5/6 bg-muted rounded"></div>
          </div>

          <div className="h-4 w-4/5 bg-muted/70 rounded"></div>

          <div className="space-y-2.5 border border-border bg-dither-25 p-4">
            <div className="h-4 w-32 bg-muted rounded"></div>
            <div className="space-y-2 pt-1">
              <div className="h-3 w-3/4 bg-muted/60 rounded"></div>
              <div className="h-3 w-5/6 bg-muted/60 rounded"></div>
              <div className="h-3 w-2/3 bg-muted/60 rounded"></div>
              <div className="h-3 w-4/5 bg-muted/60 rounded"></div>
            </div>
          </div>

          <div className="pt-2">
            <div className="h-9 w-36 bg-muted rounded"></div>
          </div>
        </div>
      </SheetSection>
    </div>
  );
}
