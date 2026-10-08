import {
  fsrs,
  createEmptyCard,
  Rating as FSRSRating,
  State as FSRSState,
  generatorParameters,
  FACTOR,
  DECAY,
  type Card as FSRSCard,
  type Grade,
  type FSRS,
} from "ts-fsrs";

export type ProblemDifficulty = "EASY" | "MEDIUM" | "HARD";
export type SolveStatusType = "SOLVED_UNAIDED" | "SOLVED_WITH_HELP" | "ATTEMPTED_FAILED";
export type AppRating = "AGAIN" | "HARD" | "GOOD" | "EASY";
export type AppCardState = "NEW" | "LEARNING" | "REVIEW" | "RELEARNING";
export type ReviewLane = "RECALL" | "RESOLVE";

export interface TimeBaselines {
  easy: number;   // default 15 min
  medium: number; // default 30 min
  hard: number;   // default 45 min
}

export const DEFAULT_BASELINES: TimeBaselines = {
  easy: 20,
  medium: 40,
  hard: 60,
};

/**
 * Longest gap the scheduler will ever leave between reviews. FSRS defaults this
 * to 100 years, which silently drops mature problems out of rotation; capping it
 * means everything ever logged resurfaces at least once a year.
 */
export const MAX_INTERVAL_DAYS = 365;

/**
 * Shortest a review may be scheduled. Short-term steps are off, and FSRS can
 * otherwise hand back a sub-day interval after Again. This is a floor, not a
 * forced interval — a lapse otherwise follows FSRS.
 */
export const MIN_INTERVAL_DAYS = 2;

export {
  DEFAULT_FIRST_INTERVALS,
  firstIntervalFor,
  firstIntervalForStatus,
  firstIntervalsFrom,
  type FirstIntervals,
} from "./first-intervals";
import { firstIntervalFor, type FirstIntervals } from "./first-intervals";

/**
 * Stability that makes FSRS schedule `intervalDays` at `desiredRetention`.
 *
 * Inverting R = (1 + FACTOR * t / S) ^ DECAY gives
 * S = FACTOR * t / (R ^ (1/DECAY) - 1). FACTOR and DECAY come from the
 * installed ts-fsrs so a learned decay stays consistent with scheduling.
 */
export function stabilityForInterval(intervalDays: number, desiredRetention: number): number {
  return (FACTOR * intervalDays) / (desiredRetention ** (1 / DECAY) - 1);
}

/**
 * Build a scheduler honouring this user's retention and any optimised weights.
 *
 * `enable_short_term` is off deliberately. FSRS's short-term steps are measured
 * in minutes, which suits flashcards but not problems that take 20-60 minutes to
 * re-solve; disabling it keeps every interval at day granularity or longer.
 */
function scheduler(desiredRetention: number, fsrsParams?: number[]) {
  return fsrs(
    generatorParameters({
      request_retention: desiredRetention,
      maximum_interval: MAX_INTERVAL_DAYS,
      enable_short_term: false,
      ...(fsrsParams && fsrsParams.length > 0 ? { w: fsrsParams as any } : {}),
    })
  );
}

export interface DeriveRatingInput {
  status: SolveStatusType;
  minutes?: number | null;
  usedHint?: boolean;
  difficulty?: ProblemDifficulty | null;
  baselines?: TimeBaselines;
  /** The first time this problem is logged: speed shows skill, not retention. */
  firstSolve?: boolean;
  /** Rating of the attempt before this one, if any. */
  previousRating?: AppRating | null;
}

export interface ReviewCardData {
  entryId: string;
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: AppCardState;
  lastReview?: Date | null;
}

export interface QueueItem {
  entryId: string;
  due: Date;
  lapses: number;
  reps: number;
  family?: string | null;
  lane?: ReviewLane;
  lastRating?: AppRating | null;
  revisit?: boolean;
  [key: string]: any;
}

/**
 * Choose how a due problem comes back.
 *
 * The revisit flag is checked first: it is an explicit request to re-solve,
 * so it wins over the first-review recall. After that:
 * 1. Never reviewed through the queue → Recall, whatever was logged.
 * 2. Never solved cold (learned from a hint or solution) → Resolve. The first
 *    Recall check confirmed the idea stuck; this is the one real solve.
 * 3. Two or more lapses → Resolve.
 * 4. A failed recall that has not yet been solved cold → Resolve.
 * 5. Otherwise → Recall.
 *
 * Stability is not a lane. A young card's first check is whether the
 * editorial stuck, which is a recall, not a 25-minute re-solve.
 */
export function deriveLane(item: {
  /** At least one attempt was logged from the queue (Attempt.lane set). */
  reviewed?: boolean;
  revisit?: boolean;
  /** No cold solve on record in any source (see neverSolvedCold). */
  neverSolvedCold?: boolean;
  lapses?: number;
  /** Latest failed recall is newer than the latest cold solve. */
  failedRecall?: boolean;
}): ReviewLane {
  if (item.revisit) return "RESOLVE";
  if (!item.reviewed) return "RECALL";
  if (item.neverSolvedCold) return "RESOLVE";
  if ((item.lapses ?? 0) >= 2) return "RESOLVE";
  if (item.failedRecall) return "RESOLVE";
  return "RECALL";
}

export interface LaneAttempt {
  rating: AppRating;
  lane: ReviewLane | null;
  at: Date;
}

/** Queue reviews set Attempt.lane. A log leaves it null, so reps/lastReview cannot mean "reviewed". */
export function hasQueueReview(attempts: Array<{ lane: ReviewLane | null }>): boolean {
  return attempts.some((attempt) => attempt.lane != null);
}

/**
 * True when no attempt outside the recall lane was rated Good/Easy, from any
 * source: an imported SOLVED_UNAIDED row counts as a cold solve, an imported
 * "saw solution" row does not. A Recall pass proves the idea, not the code.
 */
export function neverSolvedCold(attempts: LaneAttempt[]): boolean {
  return !attempts.some(
    (attempt) => attempt.lane !== "RECALL" && (attempt.rating === "GOOD" || attempt.rating === "EASY"),
  );
}

/**
 * The re-solve marker is the failed recall itself: a RECALL attempt rated Again,
 * still ahead of the latest cold solve (Good/Easy outside the recall lane).
 * The next cold solve clears it by being newer.
 */
export function failedRecallPending(attempts: LaneAttempt[]): boolean {
  const ordered = [...attempts].sort((a, b) => b.at.getTime() - a.at.getTime());
  const failed = ordered.find((attempt) => attempt.lane === "RECALL" && attempt.rating === "AGAIN");
  if (!failed) return false;
  const cold = ordered.find(
    (attempt) => attempt.lane !== "RECALL" && (attempt.rating === "GOOD" || attempt.rating === "EASY"),
  );
  return !cold || failed.at.getTime() > cold.at.getTime();
}

export const FSRS_STATE_TO_APP: Record<number, AppCardState> = {
  [FSRSState.New]: "NEW",
  [FSRSState.Learning]: "LEARNING",
  [FSRSState.Review]: "REVIEW",
  [FSRSState.Relearning]: "RELEARNING",
};

export const APP_STATE_TO_FSRS: Record<AppCardState, FSRSState> = {
  NEW: FSRSState.New,
  LEARNING: FSRSState.Learning,
  REVIEW: FSRSState.Review,
  RELEARNING: FSRSState.Relearning,
};

export const APP_RATING_TO_FSRS: Record<AppRating, Grade> = {
  AGAIN: FSRSRating.Again as Grade,
  HARD: FSRSRating.Hard as Grade,
  GOOD: FSRSRating.Good as Grade,
  EASY: FSRSRating.Easy as Grade,
};

export const FSRS_RATING_TO_APP: Record<number, AppRating> = {
  [FSRSRating.Again]: "AGAIN",
  [FSRSRating.Hard]: "HARD",
  [FSRSRating.Good]: "GOOD",
  [FSRSRating.Easy]: "EASY",
};

/**
 * Derive the FSRS rating from the re-solve outcome.
 * - failed -> Again
 * - any outside help (hint or solution) -> Hard, however fast it was
 * - solved cold -> Good, however slow it was
 * - solved cold within 0.75x the difficulty baseline -> Easy, except:
 *   - on the first log, where a fast solve shows skill rather than retention, and
 *   - on the first success after a fail or hint, which must earn its way back
 *   both of which stay Good.
 * Baselines: Easy 20m, Medium 40m, Hard 60m.
 */
export function deriveRating(input: DeriveRatingInput): AppRating {
  const { status, minutes, usedHint, difficulty, baselines = DEFAULT_BASELINES, firstSolve, previousRating } = input;

  if (status === "ATTEMPTED_FAILED") {
    return "AGAIN";
  }

  if (usedHint || status === "SOLVED_WITH_HELP") {
    return "HARD";
  }

  // Retrieving the solution unaided is itself the evidence of recall, so a cold
  // solve never rates below GOOD. Time only decides whether it also earns EASY.
  if (minutes == null) {
    return "GOOD";
  }

  const baselineMinutes =
    difficulty === "EASY"
      ? baselines.easy
      : difficulty === "HARD"
      ? baselines.hard
      : baselines.medium;

  if (minutes > Math.round(0.75 * baselineMinutes)) return "GOOD";
  if (firstSolve || previousRating === "AGAIN" || previousRating === "HARD") return "GOOD";
  return "EASY";
}

/**
 * Convert internal App ReviewCardData to ts-fsrs Card
 */
export function toFSRSCard(card: ReviewCardData): FSRSCard {
  return {
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsedDays,
    scheduled_days: card.scheduledDays,
    reps: card.reps,
    lapses: card.lapses,
    state: APP_STATE_TO_FSRS[card.state],
    last_review: card.lastReview ? new Date(card.lastReview) : undefined,
  };
}

/**
 * Convert ts-fsrs Card to internal App ReviewCardData
 */
export function fromFSRSCard(entryId: string, card: FSRSCard): ReviewCardData {
  return {
    entryId,
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: FSRS_STATE_TO_APP[card.state] ?? "LEARNING",
    lastReview: card.last_review ?? null,
  };
}

/**
 * Seed a review card for a newly logged Entry.
 *
 * FSRS supplies difficulty (and reps/state) from the first rating. The interval
 * itself is fixed by outcome — a first log has no review history for FSRS to
 * fit — and stability is set so that same interval is what FSRS would schedule
 * at the user's retention. From the second review, `advanceCard` takes over.
 */
export function seedCard(params: {
  entryId: string;
  rating: AppRating;
  now?: Date;
  desiredRetention?: number;
  fsrsParams?: number[];
  flagged?: boolean;
  intervals?: FirstIntervals;
}): ReviewCardData {
  const {
    entryId,
    rating,
    now = new Date(),
    desiredRetention = 0.80,
    fsrsParams,
    flagged = false,
    intervals,
  } = params;

  const f = scheduler(desiredRetention, fsrsParams);
  const scheduled = f.repeat(createEmptyCard(now), now)[APP_RATING_TO_FSRS[rating]].card;
  const card = fromFSRSCard(entryId, scheduled);
  const days = firstIntervalFor(rating, flagged, intervals);
  applyFixedInterval(card, days, now, desiredRetention, f);
  return card;
}

/** Point due/stability/scheduledDays at a chosen interval, keeping FSRS difficulty. */
function applyFixedInterval(
  card: ReviewCardData,
  days: number,
  now: Date,
  desiredRetention: number,
  f: FSRS,
) {
  const stability = stabilityForInterval(days, desiredRetention);
  const scheduledDays = f.next_interval(stability, 0);
  card.stability = stability;
  card.scheduledDays = scheduledDays;
  card.due = new Date(now.getTime() + scheduledDays * 86_400_000);
}

function applyMinInterval(card: ReviewCardData, reviewDate: Date) {
  const floor = new Date(reviewDate.getTime() + MIN_INTERVAL_DAYS * 86_400_000);
  if (card.due < floor) {
    card.due = floor;
    card.scheduledDays = MIN_INTERVAL_DAYS;
  }
}

/**
 * Advance an existing card following a review attempt.
 */
export function advanceCard(params: {
  currentCard: ReviewCardData;
  rating: AppRating;
  reviewDate?: Date;
  desiredRetention?: number;
  fsrsParams?: number[];
}): ReviewCardData {
  const {
    currentCard,
    rating,
    reviewDate = new Date(),
    desiredRetention = 0.80,
    fsrsParams,
  } = params;

  const f = scheduler(desiredRetention, fsrsParams);

  const fsrsCard = toFSRSCard(currentCard);
  const grade = APP_RATING_TO_FSRS[rating];
  const repeatResult = f.repeat(fsrsCard, reviewDate);
  const card = fromFSRSCard(currentCard.entryId, repeatResult[grade].card);

  if (rating === "AGAIN") {
    applyMinInterval(card, reviewDate);
  }

  return card;
}

/** Move a small number of the oldest overdue full solves into the cheaper recall lane. */
export function promoteOverdueToRecall<T extends QueueItem>(items: T[], limit = 3): T[] {
  const overdueResolve = items
    .filter((item) => (item.lane ?? deriveLane(item)) === "RESOLVE")
    .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime())
    .slice(0, Math.max(0, limit));
  const promoted = new Set(overdueResolve.map((item) => item.entryId));
  return items.map((item) => promoted.has(item.entryId) ? { ...item, lane: "RECALL" } : item);
}

/**
 * Top the re-solve lane up to a daily minimum. Only due Recall cards that show a real reason
 * to write the code qualify, in this order: never solved cold (oldest due first), then cards
 * with lapses. Follow-ups that are retrying tomorrow are left alone. Nothing arbitrary is
 * ever pulled in, so with no qualifying card the lane simply stays short.
 */
export function fillResolveMinimum<T extends QueueItem>(items: T[], need: number): T[] {
  if (need <= 0) return items;
  const tier = (item: T) => (item.neverSolvedCold ? 0 : (item.lapses ?? 0) > 0 ? 1 : 2);
  const picked = items
    .filter((item) => (item.lane ?? deriveLane(item)) === "RECALL" && !item.retryTomorrow && tier(item) < 2)
    .sort(
      (a, b) =>
        tier(a) - tier(b) ||
        new Date(a.due).getTime() - new Date(b.due).getTime() ||
        (b.lapses ?? 0) - (a.lapses ?? 0),
    )
    .slice(0, need)
    .map((item) => item.entryId);
  const chosen = new Set(picked);
  return items.map((item) => (chosen.has(item.entryId) ? { ...item, lane: "RESOLVE" as const } : item));
}

/**
 * Calculate current retrievability (R) of a card based on stability and elapsed time.
 * R = (1 + factor * t / S)^decay
 */
export function calculateRetrievability(card: ReviewCardData, now: Date = new Date()): number {
  if (card.stability <= 0) return 0;
  if (!card.lastReview) return 1.0;

  const elapsedDays = Math.max(0, (now.getTime() - new Date(card.lastReview).getTime()) / (1000 * 60 * 60 * 24));
  if (elapsedDays === 0) return 1.0;

  // FSRS forgetting curve: R = (1 + FACTOR * t / S) ^ DECAY, constants from ts-fsrs.
  const retrievability = Math.pow(1 + FACTOR * (elapsedDays / card.stability), DECAY);

  return Math.min(1.0, Math.max(0.0, retrievability));
}

/** Lapses at which a card becomes a leech (spec §7). */
export const LEECH_LAPSES = 3;

export function isLeech(card: { lapses: number }): boolean {
  return card.lapses >= LEECH_LAPSES;
}

export function interleaveLane<T extends QueueItem>(items: T[], cap: number): T[] {
  const sorted = [...items].sort((a, b) => {
    const dueDiff = new Date(a.due).getTime() - new Date(b.due).getTime();
    if (dueDiff !== 0) return dueDiff;
    return (b.lapses || 0) - (a.lapses || 0);
  });
  const selected = sorted.slice(0, Math.max(0, cap));
  if (selected.length <= 2) return selected;

  const result: T[] = [];
  const remaining = [...selected];

  while (remaining.length > 0) {
    let candidateIndex = -1;
    const len = result.length;
    const lastFamily = len >= 1 ? result[len - 1].family : null;
    const secondLastFamily = len >= 2 ? result[len - 2].family : null;
    const blockSame = lastFamily != null && lastFamily === secondLastFamily;

    for (let i = 0; i < remaining.length; i++) {
      const itemFamily = remaining[i].family;
      if (blockSame && itemFamily === lastFamily) continue;
      candidateIndex = i;
      break;
    }

    if (candidateIndex === -1) candidateIndex = 0;
    result.push(remaining.splice(candidateIndex, 1)[0]);
  }

  return result;
}

/**
 * Interleaving Algorithm per spec §1 and §7:
 * Compose two review lanes:
 * - At most dailyResolveCap (default 2) RESOLVE cards
 * - Up to recallCap (default 5) RECALL cards
 * - Resolve cards render first, followed by recall cards
 * - Overdue cards sort ahead of due-today within their lane
 * - Pattern-family interleaving applies within each lane
 */
export function interleaveQueue<T extends QueueItem>(
  cards: T[],
  dailyResolveCapOrNow?: number | Date,
  maybeNow?: Date,
  maybeRecallCap?: number
): T[] {
  const legacyMode = dailyResolveCapOrNow instanceof Date || typeof dailyResolveCapOrNow === "undefined";
  const resolveCap = legacyMode ? 2 : Number.isFinite(Number(dailyResolveCapOrNow)) ? Number(dailyResolveCapOrNow) : 2;
  const now = legacyMode ? (dailyResolveCapOrNow instanceof Date ? dailyResolveCapOrNow : new Date()) : (maybeNow ?? new Date());
  const recallCap = typeof maybeRecallCap === "number" ? maybeRecallCap : 5;

  if (cards.length === 0) return [];

  const dueCards = cards.filter((c) => new Date(c.due).getTime() <= now.getTime());
  const pool = dueCards.length > 0 ? dueCards : cards;

  const resolved = pool.filter((card) => (card.lane ?? deriveLane(card)) === "RESOLVE");
  const recalled = pool.filter((card) => (card.lane ?? deriveLane(card)) === "RECALL");

  const interleavedResolve = interleaveLane(resolved, resolveCap);
  const interleavedRecall = interleaveLane(recalled, recallCap);

  return [...interleavedResolve, ...interleavedRecall];
}

export interface ImportedRowInput {
  id: string;
  status: SolveStatusType;
  revisit: boolean;
  firstSolvedAt?: Date;
}

/** Rating for an imported row: seeds its card and is the rating of its IMPORT attempt. */
export function importedRating(status: SolveStatusType): AppRating {
  if (status === "ATTEMPTED_FAILED") return "AGAIN";
  if (status === "SOLVED_WITH_HELP") return "HARD";
  return "GOOD";
}

/**
 * 21-Day Import Spread per spec §6 and §7:
 * Spreads imported entries over the next 21 days.
 * Ordered so that revisit: true and SOLVED_WITH_HELP rows come first.
 */
export function spreadImportDueDates(
  rows: ImportedRowInput[],
  startDate: Date = new Date()
): Array<{ id: string; due: Date; seededRating: AppRating }> {
  // Sort rows: revisit === true first, then SOLVED_WITH_HELP, then others
  const sorted = [...rows].sort((a, b) => {
    if (a.revisit !== b.revisit) return a.revisit ? -1 : 1;
    if (a.status === "SOLVED_WITH_HELP" && b.status !== "SOLVED_WITH_HELP") return -1;
    if (b.status === "SOLVED_WITH_HELP" && a.status !== "SOLVED_WITH_HELP") return 1;
    return 0;
  });

  const totalDays = 60;
  return sorted.map((row, index) => {
    const dayOffset = Math.floor((index * totalDays) / Math.max(1, sorted.length));
    const due = new Date(startDate);
    due.setDate(due.getDate() + dayOffset);

    // Initial seeded rating. `revisit` only moves a row earlier in the queue
    // (via the sort above) — it is a "practice this someday" marker, not
    // evidence of weak recall, so it must not depress the seeded strength.
    return {
      id: row.id,
      due,
      seededRating: importedRating(row.status),
    };
  });
}
