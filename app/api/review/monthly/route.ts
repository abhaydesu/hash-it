import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { calculateRetrievability, ReviewCardData } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const now = new Date();

    // 1. Fetch patterns with entries for this user
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

    // Score patterns by retrievability
    const patternScores = patterns.map((p) => {
      const cards = p.problems
        .flatMap((pp) => pp.problem.entries.map((e) => e.reviewCard))
        .filter((c): c is NonNullable<typeof c> => Boolean(c));

      const avgRetrievability = cards.length
        ? cards.reduce((sum, c) => sum + calculateRetrievability(c as ReviewCardData, now), 0) / cards.length
        : 0.5; // default moderate score if unpracticed

      const problems = p.problems.map((pp) => pp.problem);

      return {
        id: p.id,
        name: p.name,
        family: p.family,
        avgRetrievability,
        problems,
      };
    });

    // Sort patterns from weakest (lowest retrievability) to strongest
    patternScores.sort((a, b) => a.avgRetrievability - b.avgRetrievability);

    // Pick 5 problems from the weakest patterns, ensuring diverse pattern families
    const selectedProblems: Array<{
      id: string;
      entryId?: string;
      title: string;
      number: number | null;
      url: string;
      platform: string;
      patternName: string; // revealed only after completion
      difficulty: string | null; // revealed only after completion
    }> = [];

    const usedProblemIds = new Set<string>();
    const usedFamilies = new Set<string>();

    // Pass 1: Try to pick 1 problem per weak pattern family
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
          difficulty: candidate.difficulty,
        });
      }
    }

    // Pass 2: If we don't have 5 yet, fill from any remaining problems in the database
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
          difficulty: fp.difficulty,
        });
      }
    }

    return NextResponse.json({
      mockId: `mock_${Date.now()}`,
      problemCount: selectedProblems.length,
      problems: selectedProblems,
    });
  } catch (err) {
    console.error("[api/review/monthly]", err);
    return NextResponse.json({ error: "Failed to load monthly mock" }, { status: 500 });
  }
}
