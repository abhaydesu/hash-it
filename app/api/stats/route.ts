import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { calculateRetrievability, ReviewCardData } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const now = new Date();

    // Fetch all attempts for user
    const attempts = await prisma.attempt.findMany({
      where: { entry: { userId: user.id } },
      orderBy: { at: "desc" },
      include: {
        entry: {
          include: { problem: true },
        },
      },
    });

    // Fetch all entries for user
    const entries = await prisma.entry.findMany({
      where: { userId: user.id },
      include: {
        problem: {
          include: {
            patterns: { include: { pattern: true } },
          },
        },
        reviewCard: true,
        attempts: true,
      },
    });

    // 1. Headline: Cold-Solve Rate (Good or Easy rating share over total attempts)
    const totalAttemptsCount = attempts.length;
    const coldSolveAttemptsCount = attempts.filter(
      (a) => a.rating === "GOOD" || a.rating === "EASY"
    ).length;
    const coldSolveRate = totalAttemptsCount > 0 ? coldSolveAttemptsCount / totalAttemptsCount : 0;

    // 2. Median minutes to solve by difficulty (EASY, MEDIUM, HARD)
    const minutesByDiff: Record<string, number[]> = { EASY: [], MEDIUM: [], HARD: [] };
    entries.forEach((e) => {
      const diff = e.problem.difficulty || "MEDIUM";
      if (e.minutes != null && e.minutes > 0) {
        minutesByDiff[diff].push(e.minutes);
      }
    });

    const getMedian = (nums: number[]) => {
      if (nums.length === 0) return 0;
      const sorted = [...nums].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    const medianMinutes = {
      EASY: getMedian(minutesByDiff.EASY),
      MEDIUM: getMedian(minutesByDiff.MEDIUM),
      HARD: getMedian(minutesByDiff.HARD),
    };

    // 3. Lapse rate & Current Leech List (lapses >= 3)
    const reviewCards = entries.map((e) => e.reviewCard).filter(Boolean);
    const totalCardsCount = reviewCards.length;
    const totalLapsesCount = reviewCards.reduce((acc, c) => acc + (c?.lapses || 0), 0);
    const lapseRate = totalCardsCount > 0 ? totalLapsesCount / totalCardsCount : 0;

    const leechEntries = entries
      .filter((e) => e.reviewCard && e.reviewCard.lapses >= 3)
      .map((e) => ({
        entryId: e.id,
        problemId: e.problem.id,
        title: e.problem.title,
        number: e.problem.number,
        url: e.problem.url,
        difficulty: e.problem.difficulty,
        platform: e.problem.platform,
        lapses: e.reviewCard!.lapses,
        mistake: e.mistake,
        idea: e.idea,
      }));

    // 4. Solved count breakdown by difficulty & by source list
    const countByDifficulty: Record<string, number> = { EASY: 0, MEDIUM: 0, HARD: 0 };
    const countBySourceList: Record<string, number> = {};

    entries.forEach((e) => {
      const diff = e.problem.difficulty || "UNSPECIFIED";
      countByDifficulty[diff] = (countByDifficulty[diff] || 0) + 1;

      const source = e.sourceList || "Uncategorized";
      countBySourceList[source] = (countBySourceList[source] || 0) + 1;
    });

    // 5. Most frequent words/tags in the mistake column (plain frequency count)
    const mistakeText = entries
      .map((e) => e.mistake)
      .filter(Boolean)
      .join(" ");

    const stopwords = new Set([
      "i", "me", "my", "myself", "we", "our", "ours", "you", "your", "yours", "he", "him",
      "his", "she", "her", "it", "its", "they", "them", "their", "what", "which", "who",
      "whom", "this", "that", "these", "those", "am", "is", "are", "was", "were", "be",
      "been", "being", "have", "has", "had", "having", "do", "does", "did", "doing", "a",
      "an", "the", "and", "but", "if", "or", "because", "as", "until", "while", "of", "at",
      "by", "for", "with", "about", "against", "between", "into", "through", "during", "before",
      "after", "above", "below", "to", "from", "up", "down", "in", "out", "on", "off", "over",
      "under", "again", "further", "then", "once", "here", "there", "when", "where", "why",
      "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such",
      "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "s", "t", "can",
      "will", "just", "don", "should", "now", "forgot", "used", "to", "didnt", "wrong", "use"
    ]);

    const wordFreq: Record<string, number> = {};
    const words = mistakeText.toLowerCase().replace(/[^a-z0-9\s-]/g, "").split(/\s+/);
    words.forEach((w) => {
      if (w.length > 2 && !stopwords.has(w)) {
        wordFreq[w] = (wordFreq[w] || 0) + 1;
      }
    });

    const topMistakeKeywords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([word, count]) => ({ word, count }));

    return NextResponse.json({
      coldSolveRate,
      totalAttempts: totalAttemptsCount,
      coldSolveAttempts: coldSolveAttemptsCount,
      totalEntries: entries.length,
      totalCards: totalCardsCount,
      totalLapses: totalLapsesCount,
      medianMinutes,
      lapseRate,
      leechCount: leechEntries.length,
      leechEntries,
      countByDifficulty,
      countBySourceList,
      topMistakeKeywords,
    });
  } catch (err) {
    console.error("[api/stats]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
