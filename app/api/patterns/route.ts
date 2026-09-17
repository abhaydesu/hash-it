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

    const enriched = patterns.map((pattern) => {
      const problemItems: Array<{
        problemId: string;
        title: string;
        number: number | null;
        url: string;
        difficulty: "EASY" | "MEDIUM" | "HARD" | null;
        platform: string;
        entryId?: string;
        status?: "SOLVED_UNAIDED" | "SOLVED_WITH_HELP" | "ATTEMPTED_FAILED";
        retrievability?: number;
        lapses?: number;
        due?: Date;
        lastReview?: Date | null;
        revisit?: boolean;
      }> = [];

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
            const card = entry.reviewCard as ReviewCardData;
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
          due: entry?.reviewCard?.due,
          lastReview: entry?.reviewCard?.lastReview,
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
        lastDrilledAt: pattern.drills[0]?.at ?? null,
        problems: problemItems,
      };
    });

    return NextResponse.json({ patterns: enriched });
  } catch (err) {
    console.error("[api/patterns]", err);
    return NextResponse.json({ error: "Failed to load patterns" }, { status: 500 });
  }
}
