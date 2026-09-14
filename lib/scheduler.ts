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

export interface TimeBaselines {
  easy: number;   // default 15 min
  medium: number; // default 30 min
  hard: number;   // default 45 min
}

export const DEFAULT_BASELINES: TimeBaselines = {
  easy: 15,
  medium: 30,
  hard: 45,
};

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
  [key: string]: any;
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
 * Derive the FSRS rating from the re-solve outcome per spec §7.
 * - failed, or opened the solution -> Again
 * - solved but needed a hint, or took > 2x the difficulty baseline -> Hard
 * - solved cold within baseline -> Good
 * - solved cold, well under baseline (<= 0.6x baseline), clean first submission -> Easy
 * Baselines: Easy 15m, Medium 30m, Hard 45m.
 */
export function deriveRating(input: DeriveRatingInput): AppRating {
  const { status, minutes, usedHint, difficulty, baselines = DEFAULT_BASELINES } = input;

  if (status === "ATTEMPTED_FAILED") {
    return "AGAIN";
  }

  const baselineMinutes =
    difficulty === "EASY"
      ? baselines.easy
      : difficulty === "HARD"
      ? baselines.hard
      : baselines.medium;

  if (usedHint || (minutes != null && minutes > 2 * baselineMinutes)) {
    return "HARD";
  }

  if (minutes != null && minutes <= Math.round(0.6 * baselineMinutes)) {
    return "EASY";
  }

  return "GOOD";
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
 * Seed a review card for a newly logged Entry per spec §7:
 * - SOLVED_UNAIDED -> apply one Good
 * - SOLVED_WITH_HELP -> one Hard
 * - ATTEMPTED_FAILED or revisit: true -> one Again
 */
export function seedCard(params: {
  entryId: string;
  status: SolveStatusType;
  revisit?: boolean;
  now?: Date;
  desiredRetention?: number;
  fsrsParams?: number[];
}): ReviewCardData {
  const {
    entryId,
    status,
    revisit = false,
    now = new Date(),
    desiredRetention = 0.9,
    fsrsParams,
  } = params;

  const f = fsrs(
    generatorParameters({
      request_retention: desiredRetention,
      ...(fsrsParams && fsrsParams.length > 0 ? { w: fsrsParams as any } : {}),
    })
  );

  const initialCard = createEmptyCard(now);
  let grade: Grade = FSRSRating.Good as Grade;

  if (revisit || status === "ATTEMPTED_FAILED") {
    grade = FSRSRating.Again as Grade;
  } else if (status === "SOLVED_WITH_HELP") {
    grade = FSRSRating.Hard as Grade;
  } else {
    grade = FSRSRating.Good as Grade;
  }

  const repeatResult = f.repeat(initialCard, now);
  const scheduled = repeatResult[grade].card;

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
    desiredRetention = 0.9,
    fsrsParams,
  } = params;

  const f = fsrs(
    generatorParameters({
      request_retention: desiredRetention,
      ...(fsrsParams && fsrsParams.length > 0 ? { w: fsrsParams as any } : {}),
    })
  );

  const fsrsCard = toFSRSCard(currentCard);
  const grade = APP_RATING_TO_FSRS[rating];
  const repeatResult = f.repeat(fsrsCard, reviewDate);
  const updatedCard = repeatResult[grade].card;

  return fromFSRSCard(currentCard.entryId, updatedCard);
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

/**
 * Interleaving Algorithm per spec §7:
 * 1. Filter cards due <= now (or process given pool).
 * 2. If pool > dailyReviewCap, select by oldest overdue first, then highest lapses.
 * 3. Reorder the selected set so no more than 2 consecutive cards share a pattern family.
 */
export function interleaveQueue<T extends QueueItem>(
  cards: T[],
  dailyReviewCap: number = 5,
  now: Date = new Date()
): T[] {
  if (cards.length === 0) return [];

  // Filter due cards
  const dueCards = cards.filter((c) => new Date(c.due).getTime() <= now.getTime());
  const pool = dueCards.length > 0 ? dueCards : cards;

  // Sort pool: oldest overdue first (ascending due), then highest lapses descending
  const sorted = [...pool].sort((a, b) => {
    const dueDiff = new Date(a.due).getTime() - new Date(b.due).getTime();
    if (dueDiff !== 0) return dueDiff;
    return (b.lapses || 0) - (a.lapses || 0);
  });

  // Cap at dailyReviewCap
  const selected = sorted.slice(0, dailyReviewCap);
  if (selected.length <= 2) return selected;

  // Reorder so <= 2 consecutive cards share the same pattern family
  const result: T[] = [];
  const remaining = [...selected];

  while (remaining.length > 0) {
    let candidateIndex = -1;

    // Check last two items in result
    const len = result.length;
    const lastFamily = len >= 1 ? result[len - 1].family : null;
    const secondLastFamily = len >= 2 ? result[len - 2].family : null;
    const blockSame = lastFamily != null && lastFamily === secondLastFamily;

    for (let i = 0; i < remaining.length; i++) {
      const itemFamily = remaining[i].family;
      if (blockSame && itemFamily === lastFamily) {
        continue;
      }
      candidateIndex = i;
      break;
    }

    // If all remaining candidates have the blocked family, take the first available
    if (candidateIndex === -1) {
      candidateIndex = 0;
    }

    result.push(remaining.splice(candidateIndex, 1)[0]);
  }

  return result;
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

  const totalDays = 21;
  return sorted.map((row, index) => {
    const dayOffset = Math.floor((index * totalDays) / Math.max(1, sorted.length));
    const due = new Date(startDate);
    due.setDate(due.getDate() + dayOffset);

    // Initial seeded rating
    let seededRating: AppRating = "GOOD";
    if (row.revisit || row.status === "ATTEMPTED_FAILED") {
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
