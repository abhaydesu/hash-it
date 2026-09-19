import {
  fsrs,
  createEmptyCard,
  Rating as FSRSRating,
  State as FSRSState,
  generatorParameters,
  type Card as FSRSCard,
  type Grade,
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
 * Stability (in days) at which a memory is treated as durable. Below this a due
 * problem is written out in full; above it a quick recall check is enough to
 * maintain it. ~30 days means "I would still recall this a month from now".
 */
export const DURABLE_STABILITY_DAYS = 30;

/**
 * Longest a just-failed problem may be put off. FSRS carries much of a mature
 * card's stability through a lapse, which can push a problem you just failed a
 * week out. With short-term steps disabled this restores the "fail it, see it
 * tomorrow" guarantee those steps normally provide.
 */
export const LAPSE_INTERVAL_DAYS = 1;

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
  stability?: number;
  [key: string]: any;
}

/**
 * Choose how a due problem comes back: written out in full, or checked quickly.
 *
 * Maturity decides. A problem is re-solved while the memory is still fragile —
 * recognising an approach is not the same as being able to produce the code —
 * and switches to cheap recall checks once FSRS considers it durable. Struggling
 * on the last attempt always forces a re-solve, however durable it looked.
 */
export function deriveLane(item: {
  lastRating?: AppRating | null;
  lapses?: number;
  stability?: number;
}): ReviewLane {
  if (item.lastRating === "AGAIN" || item.lastRating === "HARD") return "RESOLVE";
  return (item.stability ?? 0) < DURABLE_STABILITY_DAYS ? "RESOLVE" : "RECALL";
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
 * - solved cold within 0.75x the difficulty baseline -> Easy
 * Baselines: Easy 20m, Medium 40m, Hard 60m.
 */
export function deriveRating(input: DeriveRatingInput): AppRating {
  const { status, minutes, usedHint, difficulty, baselines = DEFAULT_BASELINES } = input;

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

  return minutes <= Math.round(0.75 * baselineMinutes) ? "EASY" : "GOOD";
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
 * Seed a review card for a newly logged Entry by applying its first rating.
 *
 * The rating comes from `deriveRating`, so how the problem was actually solved —
 * including how quickly — shapes the very first interval rather than only
 * kicking in from the second review onward.
 */
export function seedCard(params: {
  entryId: string;
  rating: AppRating;
  now?: Date;
  desiredRetention?: number;
  fsrsParams?: number[];
}): ReviewCardData {
  const { entryId, rating, now = new Date(), desiredRetention = 0.80, fsrsParams } = params;

  const f = scheduler(desiredRetention, fsrsParams);
  const scheduled = f.repeat(createEmptyCard(now), now)[APP_RATING_TO_FSRS[rating]].card;

  return fromFSRSCard(entryId, scheduled);
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
    // Only the due date is pulled in; FSRS keeps its own stability estimate, and
    // reviewing early is something it already accounts for.
    const soonest = new Date(reviewDate.getTime() + LAPSE_INTERVAL_DAYS * 86_400_000);
    if (card.due > soonest) {
      card.due = soonest;
      card.scheduledDays = LAPSE_INTERVAL_DAYS;
    }
  }

  return card;
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

  // FSRS forgetting curve formula: R = (1 + 19/81 * (t / S))^-0.5 (standard decay)
  const factor = 19 / 81;
  const power = -0.5;
  const retrievability = Math.pow(1 + factor * (elapsedDays / card.stability), power);

  return Math.min(1.0, Math.max(0.0, retrievability));
}

/**
 * Check if a card is a leech per spec §7:
 * lapses >= 3
 */
export function isLeech(card: { lapses: number }): boolean {
  return card.lapses >= 3;
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
 * - Up to recallCap (default 6) RECALL cards
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
  const resolveCap = legacyMode ? 2 : Number(dailyResolveCapOrNow) || 2;
  const now = legacyMode ? (dailyResolveCapOrNow instanceof Date ? dailyResolveCapOrNow : new Date()) : (maybeNow ?? new Date());
  const recallCap = typeof maybeRecallCap === "number" ? maybeRecallCap : 6;

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
    let seededRating: AppRating = "GOOD";
    if (row.status === "ATTEMPTED_FAILED") {
      seededRating = "AGAIN";
    } else if (row.status === "SOLVED_WITH_HELP") {
      seededRating = "HARD";
    }

    return {
      id: row.id,
      due,
      seededRating,
    };
  });
}
