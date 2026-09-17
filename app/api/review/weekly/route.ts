import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { calculateRetrievability, ReviewCardData } from "@/lib/scheduler";
import { getPatternCue } from "@/lib/cues";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
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
              card: entry.reviewCard as ReviewCardData,
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
        lastDrilledAt,
        sampleProblems: cards.slice(0, 4).map((c) => c.problem),
      };
    });

    const belowTarget = enrichedPatterns.filter((p) => p.hasCards && p.isBelowTarget);
    const untouched14Days = enrichedPatterns.filter((p) => p.hasCards && p.isUntouched14Days && !p.isBelowTarget);
    const healthy = enrichedPatterns.filter((p) => p.hasCards && !p.isBelowTarget && !p.isUntouched14Days);
    const unpracticed = enrichedPatterns.filter((p) => !p.hasCards);

    return NextResponse.json({
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
      unpracticed,
      all: enrichedPatterns,
    });
  } catch (err) {
    console.error("[api/review/weekly]", err);
    return NextResponse.json({ error: "Failed to load weekly review" }, { status: 500 });
  }
}
