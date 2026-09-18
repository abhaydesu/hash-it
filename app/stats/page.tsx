import React, { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { StatsClient, type StatsData } from "@/components/stats-client";
import { SpecGrid, SpecCell } from "@/components/ui/spec-sheet";
import { SheetSection } from "@/components/ui/sheet-section";

export const dynamic = "force-dynamic";

const STOPWORDS = new Set([
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
  "will", "just", "don", "should", "now", "forgot", "used", "to", "didnt", "wrong", "use",
]);

function median(nums: number[]) {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export default function StatsPage() {
  return (
    <Suspense fallback={<StatsSkeleton />}>
      <StatsData />
    </Suspense>
  );
}

async function StatsData() {
  const user = await getCurrentUser();

  const [totalAttemptsCount, coldSolveAttemptsCount, entries, attempts] = await Promise.all([
    prisma.attempt.count({ where: { entry: { userId: user.id } } }),
    prisma.attempt.count({
      where: { entry: { userId: user.id }, rating: { in: ["GOOD", "EASY"] } },
    }),
    prisma.entry.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        minutes: true,
        sourceList: true,
        mistake: true,
        idea: true,
        problem: {
          select: {
            id: true,
            title: true,
            number: true,
            url: true,
            difficulty: true,
            platform: true,
          },
        },
        reviewCard: { select: { lapses: true } },
      },
    }),
    prisma.attempt.findMany({
      where: { entry: { userId: user.id } },
      select: { at: true },
    }),
  ]);

  const activityMap: Record<string, number> = {};
  for (const a of attempts) {
    const dateStr = a.at.toISOString().split("T")[0];
    activityMap[dateStr] = (activityMap[dateStr] || 0) + 1;
  }

  const coldSolveRate = totalAttemptsCount > 0 ? coldSolveAttemptsCount / totalAttemptsCount : 0;

  const minutesByDiff: Record<string, number[]> = { EASY: [], MEDIUM: [], HARD: [] };
  const countByDifficulty: Record<string, number> = { EASY: 0, MEDIUM: 0, HARD: 0 };
  const countBySourceList: Record<string, number> = {};
  const reviewCards: Array<{ lapses: number }> = [];

  for (const e of entries) {
    const diff = e.problem.difficulty || "MEDIUM";
    if (e.minutes != null && e.minutes > 0) {
      (minutesByDiff[diff] ??= []).push(e.minutes);
    }

    const diffKey = e.problem.difficulty || "UNSPECIFIED";
    countByDifficulty[diffKey] = (countByDifficulty[diffKey] || 0) + 1;

    const source = e.sourceList || "Uncategorized";
    countBySourceList[source] = (countBySourceList[source] || 0) + 1;

    if (e.reviewCard) reviewCards.push(e.reviewCard);
  }

  const totalCardsCount = reviewCards.length;
  const totalLapsesCount = reviewCards.reduce((acc, c) => acc + c.lapses, 0);
  const lapseRate = totalCardsCount > 0 ? totalLapsesCount / totalCardsCount : 0;

  const leechEntries = entries
    .filter((e) => e.reviewCard && e.reviewCard.lapses >= 3)
    .map((e) => ({
      entryId: e.id,
      problemId: e.problem.id,
      title: e.problem.title,
      number: e.problem.number,
      url: e.problem.url,
      difficulty: e.problem.difficulty as "EASY" | "MEDIUM" | "HARD" | null,
      platform: e.problem.platform,
      lapses: e.reviewCard!.lapses,
      mistake: e.mistake,
    }));

  const mistakeText = entries
    .map((e) => e.mistake)
    .filter(Boolean)
    .join(" ");

  const wordFreq: Record<string, number> = {};
  const words = mistakeText.toLowerCase().replace(/[^a-z0-9\s-]/g, "").split(/\s+/);
  for (const w of words) {
    if (w.length > 2 && !STOPWORDS.has(w)) {
      wordFreq[w] = (wordFreq[w] || 0) + 1;
    }
  }

  const topMistakeKeywords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word, count]) => ({ word, count }));

  const data: StatsData = {
    coldSolveRate,
    totalAttempts: totalAttemptsCount,
    coldSolveAttempts: coldSolveAttemptsCount,
    totalEntries: entries.length,
    totalCards: totalCardsCount,
    totalLapses: totalLapsesCount,
    medianMinutes: {
      EASY: median(minutesByDiff.EASY),
      MEDIUM: median(minutesByDiff.MEDIUM),
      HARD: median(minutesByDiff.HARD),
    },
    lapseRate,
    leechCount: leechEntries.length,
    leechEntries,
    countByDifficulty,
    countBySourceList,
    topMistakeKeywords,
    activityMap,
  };

  return <StatsClient data={data} />;
}

function StatsSkeleton() {
  return (
    <div className="animate-pulse">
      <SheetSection innerClassName="py-6">
        <div className="h-7 w-64 bg-muted rounded"></div>
        <div className="mt-2 h-4 w-96 bg-muted rounded"></div>
      </SheetSection>

      <SheetSection innerClassName="py-6" band="neutral">
        <SpecGrid columns={4}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SpecCell
              key={i}
              label={<div className="h-3 w-28 bg-muted/60 rounded" />}
              value={<div className="h-6 w-16 bg-muted rounded mt-1" />}
              subvalue={<div className="h-3 w-36 bg-muted/40 rounded mt-1" />}
            />
          ))}
        </SpecGrid>
      </SheetSection>

      <SheetSection innerClassName="space-y-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-5 w-36 bg-muted rounded"></div>
            <div className="mt-1 h-3 w-48 bg-muted rounded"></div>
          </div>
          <div className="h-8 w-32 bg-muted rounded"></div>
        </div>
        <div className="h-36 w-full border border-border bg-muted/10"></div>
      </SheetSection>
    </div>
  );
}
