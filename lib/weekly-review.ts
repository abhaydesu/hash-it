/**
 * Weekly review: look back → recall check → plan next week.
 *
 * Recall check: the user sees only a problem's title, taps how sure they are
 * (before revealing their own idea/mistake notes), then says whether they had it.
 * A miss pulls the card's due date to tomorrow — the due date only, never stability,
 * so a check can't make the scheduler think the user knows a problem less well.
 */
import { prisma } from "@/lib/prisma";
import { calculateRetrievability, isLeech, type ReviewCardData } from "@/lib/scheduler";
import { addDays, weekStart as localWeekStart } from "@/lib/dates";
import { weeklyWindow } from "@/lib/review-windows";
import { getUserSettingsRow, DEFAULT_TIMEZONE } from "@/lib/user-settings";
import { normalizePatternList } from "@/lib/utils";

export type Confidence = "BLANK" | "HAZY" | "CLEAR";
export type PlanKind = "REDO" | "FRESH" | "REVISIT";
export const PLAN_KINDS: PlanKind[] = ["REDO", "FRESH", "REVISIT"];

/** Cards per weekly recall check. */
export const RECALL_CHECK_SIZE = 8;
/** A solved problem not reviewed for this long is a good "old problem" pick. */
const REVISIT_AFTER_DAYS = 30;
const CANDIDATES_PER_KIND = 3;
const DAY_MS = 86_400_000;

// ── Pure logic ───────────────────────────────────────────────────────────────

export interface CardFacts {
  entryId: string;
  patterns: string[];
  retrievability: number;
  lapses: number;
  lastReview: Date | null;
  lapsedThisWeek: boolean;
}

export type CheckReason = "lapsed" | "weak" | "stale";

/** Patterns ordered weakest first, by their least-remembered problem (an average would hide it). */
export function rankWeakPatterns(cards: CardFacts[], target: number): Array<{ name: string; weakest: CardFacts; belowTarget: number }> {
  const byPattern = new Map<string, CardFacts[]>();
  for (const c of cards) for (const p of c.patterns) byPattern.set(p, [...(byPattern.get(p) ?? []), c]);

  return [...byPattern.entries()]
    .map(([name, list]) => ({
      name,
      weakest: list.reduce((a, b) => (b.retrievability < a.retrievability ? b : a)),
      belowTarget: list.filter((c) => c.retrievability < target).length,
    }))
    .filter((p) => p.weakest.retrievability < target)
    .sort((a, b) => a.weakest.retrievability - b.weakest.retrievability);
}

/**
 * Pick this week's recall check. Anything already checked this week stays (so the
 * session doesn't reshuffle mid-way), then in order:
 *   1. problems forgotten this week
 *   2. the least-remembered problem of each pattern below target
 *   3. one problem from the pattern left longest without a review
 */
export function selectRecallChecks(
  cards: CardFacts[],
  opts: { target: number; alreadyChecked: string[]; limit?: number },
): Array<{ entryId: string; reason: CheckReason }> {
  const limit = opts.limit ?? RECALL_CHECK_SIZE;
  const byId = new Map(cards.map((c) => [c.entryId, c]));
  const picked = new Map<string, CheckReason>();
  const add = (id: string, reason: CheckReason) => {
    if (picked.size < limit && !picked.has(id)) picked.set(id, reason);
  };

  const reasonFor = (c: CardFacts): CheckReason => (c.lapsedThisWeek ? "lapsed" : c.retrievability < opts.target ? "weak" : "stale");
  for (const id of opts.alreadyChecked) {
    const c = byId.get(id);
    if (c) add(id, reasonFor(c));
  }

  [...cards]
    .filter((c) => c.lapsedThisWeek)
    .sort((a, b) => a.retrievability - b.retrievability)
    .forEach((c) => add(c.entryId, "lapsed"));

  for (const p of rankWeakPatterns(cards, opts.target)) add(p.weakest.entryId, "weak");

  // Stale: the pattern whose most recent review is oldest; check its least-remembered problem.
  const lastTouched = new Map<string, { at: number; weakest: CardFacts }>();
  for (const c of cards) {
    const at = c.lastReview?.getTime() ?? 0;
    for (const p of c.patterns) {
      const cur = lastTouched.get(p);
      if (!cur) lastTouched.set(p, { at, weakest: c });
      else
        lastTouched.set(p, {
          at: Math.max(cur.at, at),
          weakest: c.retrievability < cur.weakest.retrievability ? c : cur.weakest,
        });
    }
  }
  const stale = [...lastTouched.values()]
    .sort((a, b) => a.at - b.at)
    .find((p) => !picked.has(p.weakest.entryId));
  if (stale) add(stale.weakest.entryId, "stale");

  return [...picked].map(([entryId, reason]) => ({ entryId, reason }));
}

/** What a recall-check answer does. A correct answer never changes the schedule. */
export function checkOutcome(confidence: Confidence, recalled: boolean) {
  return {
    dueTomorrow: !recalled,
    /** Sure and wrong: the most useful error to catch. */
    falseConfidence: confidence === "CLEAR" && !recalled,
  };
}

/** Deterministic shuffle seeded by a string, so a week's suggestions don't change on refresh. */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), h | 1);
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Plan candidates that come from the user's own log: a stuck problem to redo, an old one to revisit. */
export function pickLoggedCandidates(cards: CardFacts[], now: Date, seed: string) {
  const byWeakness = (a: CardFacts, b: CardFacts) => a.retrievability - b.retrievability;
  const stuck = cards.filter((c) => isLeech(c)).sort(byWeakness);
  const lapsed = cards.filter((c) => c.lapses > 0 && !isLeech(c)).sort(byWeakness);
  const redo = [...stuck, ...lapsed].slice(0, CANDIDATES_PER_KIND);

  const cutoff = now.getTime() - REVISIT_AFTER_DAYS * DAY_MS;
  const redoIds = new Set(redo.map((c) => c.entryId));
  const old = cards.filter((c) => !redoIds.has(c.entryId) && (c.lastReview?.getTime() ?? 0) < cutoff);
  const revisit = seededShuffle(old, seed).slice(0, CANDIDATES_PER_KIND);

  return { REDO: redo.map((c) => c.entryId), REVISIT: revisit.map((c) => c.entryId) };
}

// ── Loader ───────────────────────────────────────────────────────────────────

export interface ProblemRef {
  problemId: string;
  title: string;
  number: number | null;
  url: string;
  difficulty: "EASY" | "MEDIUM" | "HARD" | null;
}

export interface RecallCheckItem extends ProblemRef {
  entryId: string;
  reason: CheckReason;
  patterns: string[];
  idea: string | null;
  mistake: string | null;
  retrievability: number;
  result: { confidence: Confidence; recalled: boolean } | null;
}

export interface PlanItemView extends ProblemRef {
  kind: PlanKind;
  done: boolean;
  /** Present for REDO / REVISIT (and FRESH once logged). */
  entryId: string | null;
}

export interface WeeklyReviewData {
  /** Monday of the week this review plans. */
  weekStart: string;
  /** Sunday (and Monday, as grace) only; otherwise the page is read-only. */
  open: boolean;
  targetRetention: number;
  lookBack: {
    reviewsDone: number;
    newLogged: number;
    forgotten: number;
    overdueNow: number;
    newlyStuck: ProblemRef[];
    weakestPatterns: Array<{ name: string; belowTarget: number; weakestRecall: number }>;
    /** Last week's plan, if last week's review was done. */
    lastPlan: { done: number; total: number } | null;
    /** The user has done reviews before but not last week's. */
    lastWeekSkipped: boolean;
  };
  /** Epoch ms when the next review window opens (local Sunday). */
  nextReviewAt: number;
  checks: RecallCheckItem[];
  plan: {
    committed: PlanItemView[] | null;
    candidates: Record<PlanKind, ProblemRef[]>;
  };
}

const problemSelect = { id: true, title: true, number: true, url: true, difficulty: true } as const;

type ProblemRow = { id: string; title: string; number: number | null; url: string; difficulty: string | null };
const toRef = (p: ProblemRow, url?: string | null): ProblemRef => ({
  problemId: p.id,
  title: p.title,
  number: p.number,
  url: url || p.url,
  difficulty: p.difficulty as ProblemRef["difficulty"],
});

/**
 * Plan rows plus, per item, the user's latest attempt on that problem, so progress
 * comes back in the same query as the plan.
 */
function planSelect(userId: string) {
  return {
    weekStart: true,
    createdAt: true,
    items: {
      select: {
        kind: true,
        problem: {
          select: {
            ...problemSelect,
            entries: {
              where: { userId },
              select: { id: true, attempts: { where: { source: { not: "IMPORT" as const } }, orderBy: { at: "desc" as const }, take: 1, select: { at: true } } },
            },
          },
        },
      },
    },
  };
}

type PlanRow = {
  createdAt: Date;
  items: Array<{
    kind: PlanKind;
    problem: ProblemRow & { entries: Array<{ id: string; attempts: Array<{ at: Date }> }> };
  }>;
};

/** A plan item counts as done once the user logs any attempt on that problem after committing. */
function planWithProgress(plan: PlanRow) {
  return plan.items
    .sort((a, b) => PLAN_KINDS.indexOf(a.kind) - PLAN_KINDS.indexOf(b.kind))
    .map(({ kind, problem: { entries, ...problem } }) => ({
      ...toRef(problem),
      kind,
      entryId: entries[0]?.id ?? null,
      // Latest attempt at/after commit ⇔ some attempt at/after commit.
      done: entries.some((e) => e.attempts[0] != null && e.attempts[0].at >= plan.createdAt),
    }));
}

export async function getWeeklyReview(userId: string, now: Date = new Date()): Promise<WeeklyReviewData> {
  const settings = await getUserSettingsRow(userId);
  const timezone = settings?.timezone || DEFAULT_TIMEZONE;
  const target = settings?.desiredRetention ?? 0.8;
  const window = weeklyWindow(now, timezone);
  const week = window.planWeek;
  const since = new Date(now.getTime() - 7 * DAY_MS);

  const [entries, reviewsDone, newLogged, overdueNow, checks, plans] = await Promise.all([
    prisma.entry.findMany({
      where: { userId, reviewCard: { isNot: null } },
      select: {
        id: true,
        idea: true,
        mistake: true,
        customUrl: true,
        customPattern: true,
        patternOverride: true,
        reviewCard: true,
        problem: { select: { ...problemSelect, patterns: { select: { pattern: { select: { name: true } } } } } },
        attempts: { where: { at: { gte: since }, rating: "AGAIN", source: { not: "IMPORT" } }, select: { id: true } },
      },
    }),
    prisma.attempt.count({ where: { entry: { userId }, at: { gte: since }, source: { not: "IMPORT" } } }),
    prisma.entry.count({ where: { userId, firstSolvedAt: { gte: since } } }),
    prisma.reviewCard.count({ where: { entry: { userId }, due: { lt: now } } }),
    prisma.weeklyCheck.findMany({
      where: { userId, weekStart: week },
      orderBy: { at: "asc" },
      select: { entryId: true, confidence: true, recalled: true },
    }),
    prisma.weeklyPlan.findMany({
      where: { userId, weekStart: { lte: week } },
      orderBy: { weekStart: "desc" },
      take: 2,
      select: planSelect(userId),
    }),
  ]);

  const facts: CardFacts[] = entries.map((e) => {
    const sheet = e.problem.patterns.map((pp) => pp.pattern.name);
    const raw = e.customPattern ? [e.customPattern] : e.patternOverride.length > 0 ? e.patternOverride : sheet;
    return {
      entryId: e.id,
      patterns: normalizePatternList(raw),
      retrievability: calculateRetrievability(e.reviewCard as unknown as ReviewCardData, now),
      lapses: e.reviewCard!.lapses,
      lastReview: e.reviewCard!.lastReview,
      lapsedThisWeek: e.attempts.length > 0,
    };
  });
  const factsById = new Map(facts.map((f) => [f.entryId, f]));
  const entryById = new Map(entries.map((e) => [e.id, e]));
  const refFor = (entryId: string) => {
    const e = entryById.get(entryId)!;
    return toRef(e.problem, e.customUrl);
  };

  // ── Step 1: look back ──
  const weak = rankWeakPatterns(facts, target);
  const newlyStuck = entries
    .filter((e) => isLeech(e.reviewCard!) && !isLeech({ lapses: e.reviewCard!.lapses - e.attempts.length }))
    .map((e) => refFor(e.id));
  const current = plans.find((p) => p.weekStart === week) ?? null;
  const previous = plans.find((p) => p.weekStart < week) ?? null;
  const lastWeek = addDays(week, -7);
  const previousItems = previous?.weekStart === lastWeek ? planWithProgress(previous) : null;

  // ── Step 2: recall check ──
  const resultById = new Map(checks.map((c) => [c.entryId, { confidence: c.confidence, recalled: c.recalled }]));
  const selected = selectRecallChecks(facts, { target, alreadyChecked: checks.map((c) => c.entryId) });
  const checkItems: RecallCheckItem[] = selected.map(({ entryId, reason }) => {
    const e = entryById.get(entryId)!;
    const f = factsById.get(entryId)!;
    return {
      ...refFor(entryId),
      entryId,
      reason,
      patterns: f.patterns,
      idea: e.idea,
      mistake: e.mistake,
      retrievability: f.retrievability,
      result: resultById.get(entryId) ?? null,
    };
  });

  // ── Step 3: plan ──
  const logged = pickLoggedCandidates(facts, now, `${userId}:${week}`);
  const weakPatternNames = weak.slice(0, 3).map((p) => p.name);
  const freshPool = weakPatternNames.length
    ? await prisma.problem.findMany({
        where: {
          isPaidOnly: false,
          entries: { none: { userId } },
          // A user's pattern may be a catalog pattern ("HashMap") or a LeetCode topic ("Hash Table").
          OR: [
            { patterns: { some: { pattern: { name: { in: weakPatternNames, mode: "insensitive" } } } } },
            { topicTags: { hasSome: weakPatternNames } },
          ],
        },
        orderBy: [{ acRate: { sort: "desc", nulls: "last" } }],
        take: 30,
        select: { ...problemSelect, topicTags: true, patterns: { select: { pattern: { select: { name: true } } } } },
      })
    : [];
  // One unseen problem per weak pattern (weakest first), mediums preferred: hard enough to test transfer.
  const fresh = weakPatternNames
    .map((name) => {
      const key = name.toLowerCase();
      const inPattern = freshPool.filter(
        (p) => p.patterns.some((pp) => pp.pattern.name.toLowerCase() === key) || p.topicTags.some((t) => t.toLowerCase() === key),
      );
      return inPattern.find((p) => p.difficulty === "MEDIUM") ?? inPattern[0];
    })
    .filter((p): p is (typeof freshPool)[number] => !!p)
    .filter((p, i, arr) => arr.findIndex((q) => q.id === p.id) === i)
    .map((p) => toRef(p));

  return {
    weekStart: week,
    open: window.open,
    targetRetention: target,
    lookBack: {
      reviewsDone,
      newLogged,
      forgotten: facts.filter((f) => f.lapsedThisWeek).length,
      overdueNow,
      newlyStuck,
      weakestPatterns: weak.slice(0, 3).map((p) => ({
        name: p.name,
        belowTarget: p.belowTarget,
        weakestRecall: p.weakest.retrievability,
      })),
      lastPlan: previousItems ? { done: previousItems.filter((i) => i.done).length, total: previousItems.length } : null,
      lastWeekSkipped: previous != null && previous.weekStart < lastWeek,
    },
    nextReviewAt: window.nextOpensAt,
    checks: checkItems,
    plan: {
      committed: current ? planWithProgress(current) : null,
      candidates: {
        REDO: logged.REDO.map(refFor),
        FRESH: fresh,
        REVISIT: logged.REVISIT.map(refFor),
      },
    },
  };
}

/**
 * The Today tile: the plan for the week the review window targets if it's committed
 * (on Sunday, that's next week's), else the one running this week.
 */
export async function getActivePlan(userId: string, now: Date = new Date()) {
  const settings = await getUserSettingsRow(userId);
  const timezone = settings?.timezone || DEFAULT_TIMEZONE;
  const window = weeklyWindow(now, timezone);
  const thisWeek = localWeekStart(now, timezone);
  const plans = await prisma.weeklyPlan.findMany({
    where: { userId, weekStart: { in: [window.planWeek, thisWeek] } },
    select: planSelect(userId),
  });
  const plan = plans.find((p) => p.weekStart === window.planWeek) ?? plans.find((p) => p.weekStart === thisWeek);
  return {
    items: plan ? planWithProgress(plan) : null,
    /** The plan shown is for next week (committed on Sunday). */
    upcoming: plan != null && plan.weekStart > thisWeek,
    reviewDone: plans.some((p) => p.weekStart === window.planWeek),
    reviewOpen: window.open,
    nextReviewAt: window.nextOpensAt,
  };
}
