import type { CardState, ReviewCard, UserSettings } from "@prisma/client";
import type { AppCardState, ReviewCardData, TimeBaselines } from "@/lib/scheduler";

/** A stored ReviewCard row as the scheduler's card shape. */
export function toCardData(card: ReviewCard): ReviewCardData {
  return {
    entryId: card.entryId,
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsedDays,
    scheduledDays: card.scheduledDays,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as AppCardState,
    lastReview: card.lastReview,
  };
}

/** Column values for a ReviewCard create/update (entryId is set by the caller). */
export function cardColumns(card: ReviewCardData, reviewedAt: Date) {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsedDays,
    scheduledDays: card.scheduledDays,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as CardState,
    lastReview: reviewedAt,
  };
}

/** Retention and optimiser weights for scheduling, with the defaults for a user without settings. */
export function scheduleSettings(settings: Pick<UserSettings, "desiredRetention" | "fsrsParams"> | null) {
  return {
    desiredRetention: settings?.desiredRetention ?? 0.8,
    fsrsParams: settings?.fsrsParams ?? [],
  };
}

/** The user's time baselines, or undefined to use the scheduler defaults. */
export function baselinesFrom(
  settings: Pick<UserSettings, "easyBaseline" | "mediumBaseline" | "hardBaseline"> | null,
): TimeBaselines | undefined {
  return settings
    ? { easy: settings.easyBaseline, medium: settings.mediumBaseline, hard: settings.hardBaseline }
    : undefined;
}
