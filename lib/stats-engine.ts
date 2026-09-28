import { prisma } from "@/lib/prisma";
import { readCustomFieldDefs } from "@/lib/custom-fields";
import { isLeech } from "@/lib/scheduler";
import { parseISO, differenceInCalendarDays, subDays } from "date-fns";
import { localDay } from "@/lib/dates";

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
  "will", "just", "don", "should", "now", "forgot", "used", "didnt", "wrong", "use",
]);

/** Custom field ids that duplicate a built-in section and so get no section of their own. */
const BUILTIN_STAT_KEYS = new Set(["difficulty", "source", "source_list", "minutes", "mistake", "status", "revisit"]);

type Difficulty = "EASY" | "MEDIUM" | "HARD";

export interface StreakStats {
  current: number;
  longest: number;
  activeDays: number;
  todayDone: boolean;
}

export interface HeadlineStats {
  coldSolveRate: number;
  totalAttempts: number;
  coldSolveAttempts: number;
  totalEntries: number;
  totalCards: number;
  totalLapses: number;
  lapseRate: number;
  medianMinutes: Record<Difficulty, number>;
}

export interface LeechEntry {
  entryId: string;
  title: string;
  url: string;
  difficulty: Difficulty | null;
  lapses: number;
  mistake: string | null;
}

export type Keyword = { word: string; count: number };

type SectionBase = { sectionId: string; label: string };

/** A configurable block on the stats page. Headline, streak and heatmap are fixed and live on AllStats. */
export type StatsSection = SectionBase &
  (
    | { kind: "distribution"; data: { counts: Record<string, number>; total: number; isDifficulty?: boolean } }
    | { kind: "number_summary"; data: { min: number; max: number; median: number; mean: number; count: number } }
    | { kind: "boolean_ratio"; data: { trueCount: number; falseCount: number; total: number } }
    | { kind: "keyword_cloud"; data: { keywords: Keyword[] } }
    | { kind: "leech_list"; data: { leechEntries: LeechEntry[] } }
  );

export interface AllStats {
  headline: HeadlineStats;
  streak: StreakStats;
  /** Local calendar day (YYYY-MM-DD) → review attempts that day. */
  activityMap: Record<string, number>;
  sections: StatsSection[];
}

function median(nums: number[]) {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(nums: number[]) {
  return nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0) / nums.length;
}

function topKeywords(texts: string[], limit = 15): Keyword[] {
  const freq: Record<string, number> = {};
  const words = texts.join(" ").toLowerCase().replace(/[^a-z0-9\s-]/g, "").split(/\s+/);
  for (const w of words) {
    if (w.length > 2 && !STOPWORDS.has(w)) freq[w] = (freq[w] || 0) + 1;
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

function isPresent(v: unknown) {
  return v !== undefined && v !== null && !(typeof v === "string" && v.trim() === "");
}

/** Streaks over the distinct active days (sorted YYYY-MM-DD). A streak stays alive until a full day is missed. */
export function computeStreak(sortedDays: string[], today: string, yesterday: string): StreakStats {
  if (sortedDays.length === 0) return { current: 0, longest: 0, activeDays: 0, todayDone: false };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    run = differenceInCalendarDays(parseISO(sortedDays[i]), parseISO(sortedDays[i - 1])) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  // `run` is now the length of the run ending on the last active day.
  const last = sortedDays[sortedDays.length - 1];
  const current = last === today || last === yesterday ? run : 0;

  return { current, longest, activeDays: sortedDays.length, todayDone: last === today };
}

/** Just the streak (for the navbar), without the rest of the stats work. */
export async function computeStreakForUser(userId: string): Promise<StreakStats> {
  const [userSettings, attempts] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId }, select: { timezone: true } }),
    prisma.attempt.findMany({ where: { entry: { userId } }, select: { at: true } }),
  ]);
  const timezone = userSettings?.timezone || "Asia/Kolkata";
  const toDay = (d: Date) => localDay(d, timezone);
  const days = [...new Set(attempts.map((a) => toDay(a.at)))].sort();
  const now = new Date();
  return computeStreak(days, toDay(now), toDay(subDays(now, 1)));
}

export async function computeAllStats(userId: string): Promise<AllStats> {
  const [userSettings, totalAttempts, coldSolveAttempts, entries, attempts] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId }, select: { timezone: true, customFields: true } }),
    prisma.attempt.count({ where: { entry: { userId } } }),
    prisma.attempt.count({ where: { entry: { userId }, rating: { in: ["GOOD", "EASY"] } } }),
    prisma.entry.findMany({
      where: { userId },
      select: {
        id: true,
        minutes: true,
        sourceList: true,
        mistake: true,
        customValues: true,
        problem: { select: { title: true, url: true, difficulty: true } },
        reviewCard: { select: { lapses: true } },
      },
    }),
    prisma.attempt.findMany({ where: { entry: { userId } }, select: { at: true } }),
  ]);

  const timezone = userSettings?.timezone || "Asia/Kolkata";
  const toDay = (d: Date) => localDay(d, timezone);
  const defs = readCustomFieldDefs(userSettings?.customFields);

  // ── Activity + streak ──
  const activityMap: Record<string, number> = {};
  for (const a of attempts) {
    const day = toDay(a.at);
    activityMap[day] = (activityMap[day] || 0) + 1;
  }
  const now = new Date();
  const streak = computeStreak(Object.keys(activityMap).sort(), toDay(now), toDay(subDays(now, 1)));

  // ── Per-entry aggregates ──
  const minutesByDiff: Record<Difficulty, number[]> = { EASY: [], MEDIUM: [], HARD: [] };
  const countByDifficulty: Record<string, number> = { EASY: 0, MEDIUM: 0, HARD: 0 };
  const countBySourceList: Record<string, number> = {};
  let hasSourceList = false;
  let totalCards = 0;
  let totalLapses = 0;

  for (const e of entries) {
    const diff = e.problem.difficulty as Difficulty | null;
    if (e.minutes != null && e.minutes > 0) minutesByDiff[diff ?? "MEDIUM"].push(e.minutes);
    const diffKey = diff ?? "UNSPECIFIED";
    countByDifficulty[diffKey] = (countByDifficulty[diffKey] || 0) + 1;

    hasSourceList ||= isPresent(e.sourceList);
    const source = e.sourceList?.trim() || "Uncategorized";
    countBySourceList[source] = (countBySourceList[source] || 0) + 1;

    if (e.reviewCard) {
      totalCards++;
      totalLapses += e.reviewCard.lapses;
    }
  }

  const headline: HeadlineStats = {
    coldSolveRate: totalAttempts > 0 ? coldSolveAttempts / totalAttempts : 0,
    totalAttempts,
    coldSolveAttempts,
    totalEntries: entries.length,
    totalCards,
    totalLapses,
    lapseRate: totalCards > 0 ? totalLapses / totalCards : 0,
    medianMinutes: {
      EASY: median(minutesByDiff.EASY),
      MEDIUM: median(minutesByDiff.MEDIUM),
      HARD: median(minutesByDiff.HARD),
    },
  };

  // ── Configurable sections ──
  const sections: StatsSection[] = [];

  sections.push({
    sectionId: "leeches",
    label: "Stuck problems",
    kind: "leech_list",
    data: {
      leechEntries: entries
        .filter((e) => e.reviewCard && isLeech(e.reviewCard))
        .map((e) => ({
          entryId: e.id,
          title: e.problem.title,
          url: e.problem.url,
          difficulty: e.problem.difficulty as Difficulty | null,
          lapses: e.reviewCard!.lapses,
          mistake: e.mistake,
        }))
        .sort((a, b) => b.lapses - a.lapses),
    },
  });

  sections.push({
    sectionId: "by_difficulty",
    label: "Problems by difficulty",
    kind: "distribution",
    data: { counts: countByDifficulty, total: entries.length, isDifficulty: true },
  });

  if (hasSourceList) {
    sections.push({
      sectionId: "by_source_list",
      label: "Problems by source list",
      kind: "distribution",
      data: { counts: countBySourceList, total: entries.length },
    });
  }

  const mistakeKeywords = topKeywords(entries.map((e) => e.mistake).filter(isPresent) as string[]);
  if (mistakeKeywords.length > 0) {
    sections.push({
      sectionId: "mistake_keywords",
      label: "Common mistake keywords",
      kind: "keyword_cloud",
      data: { keywords: mistakeKeywords },
    });
  }

  for (const def of defs) {
    if (BUILTIN_STAT_KEYS.has(def.id)) continue;

    const values = entries
      .map((e) => (e.customValues as Record<string, unknown> | null)?.[def.id])
      .filter(isPresent);
    if (values.length === 0) continue;

    const base = { sectionId: `custom_${def.id}`, label: def.label };

    if (def.type === "select") {
      const counts: Record<string, number> = {};
      for (const v of values) counts[String(v)] = (counts[String(v)] || 0) + 1;
      sections.push({ ...base, kind: "distribution", data: { counts, total: values.length } });
    } else if (def.type === "number") {
      const nums = values.map(Number).filter((n) => !Number.isNaN(n));
      if (nums.length === 0) continue;
      sections.push({
        ...base,
        kind: "number_summary",
        data: { min: Math.min(...nums), max: Math.max(...nums), median: median(nums), mean: mean(nums), count: nums.length },
      });
    } else if (def.type === "boolean") {
      const trueCount = values.filter((v) => v === true || v === "true").length;
      sections.push({
        ...base,
        kind: "boolean_ratio",
        data: { trueCount, falseCount: values.length - trueCount, total: values.length },
      });
    } else if (def.type === "text") {
      const keywords = topKeywords(values.map(String));
      if (keywords.length > 0) {
        sections.push({ ...base, label: `Top keywords in ${def.label}`, kind: "keyword_cloud", data: { keywords } });
      }
    }
  }

  return { headline, streak, activityMap, sections };
}
