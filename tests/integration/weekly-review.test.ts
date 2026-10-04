import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runInTestTransaction } from "@/tests/helpers/test-db";
import {
  createTestUser,
  createTestProblem,
  createTestPattern,
  createTestPatternProblem,
  createTestEntry,
} from "@/tests/helpers/factories";
import { setTestUser } from "@/tests/helpers/auth-helper";
import { recordRecallCheck, commitWeeklyPlan } from "@/app/actions/weekly-actions";
import { createEntry } from "@/app/actions/entry-actions";
import { getWeeklyReview, getActivePlan } from "@/lib/weekly-review";

const DAY = 86_400_000;
// Sunday 4 Oct 2026, 11:30 in Asia/Kolkata (the default timezone): the review is open.
const SUNDAY = new Date("2026-10-04T06:00:00Z");

describe("Weekly review (Integration)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SUNDAY);
  });
  afterEach(() => vi.useRealTimers());

  it("picks weak problems, pulls a miss to tomorrow, and leaves a hit alone", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({ email: "weekly1@example.com" }, tx);
      const pattern = await createTestPattern({ name: "Sliding Window Weekly" }, tx);
      const weak = await createTestProblem({ title: "Weak One" }, tx);
      const strong = await createTestProblem({ title: "Strong One" }, tx);
      const unseen = await createTestProblem({ title: "Unseen One", difficulty: "MEDIUM" }, tx);
      for (const p of [weak, strong, unseen]) await createTestPatternProblem(p.id, pattern.id, "SHEET", tx);

      const farDue = new Date(Date.now() + 30 * DAY);
      const { entry: weakEntry } = await createTestEntry(user.id, weak.id, { createReviewCard: true, due: farDue }, tx);
      await createTestEntry(user.id, strong.id, { createReviewCard: true, due: farDue }, tx);
      // Make "Weak One" weak: reviewed long ago with low stability.
      await tx.reviewCard.update({
        where: { entryId: weakEntry.id },
        data: { lastReview: new Date(Date.now() - 60 * DAY), stability: 1, lapses: 3 },
      });

      setTestUser(user);

      const review = await getWeeklyReview(user.id);
      expect(review.checks.map((c) => c.title)).toContain("Weak One");
      expect(review.lookBack.weakestPatterns[0]?.name).toBe("Sliding Window Weekly");
      expect(review.plan.candidates.REDO.map((c) => c.title)).toContain("Weak One");
      expect(review.plan.candidates.FRESH.map((c) => c.title)).toEqual(["Unseen One"]);

      // A confident miss: due moves to tomorrow (earlier), stability untouched.
      const outcome = await recordRecallCheck({ entryId: weakEntry.id, confidence: "CLEAR", recalled: false });
      expect(outcome).toEqual({ dueTomorrow: true, falseConfidence: true });
      const card = await tx.reviewCard.findUnique({ where: { entryId: weakEntry.id } });
      expect(card!.due.getTime()).toBeLessThan(Date.now() + 2 * DAY);
      expect(card!.stability).toBe(1);

      const again = await getWeeklyReview(user.id);
      expect(again.checks.find((c) => c.entryId === weakEntry.id)?.result).toEqual({ confidence: "CLEAR", recalled: false });
    });
  });

  it("commits a plan and marks items done once attempted", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({ email: "weekly2@example.com" }, tx);
      const stuck = await createTestProblem({ title: "Stuck One" }, tx);
      const fresh = await createTestProblem({ title: "Fresh One" }, tx);
      await createTestEntry(user.id, stuck.id, { createReviewCard: true }, tx);

      setTestUser(user);
      await commitWeeklyPlan({
        items: [
          { kind: "REDO", problemId: stuck.id },
          { kind: "FRESH", problemId: fresh.id },
        ],
      });

      let plan = await getActivePlan(user.id);
      expect(plan.items?.map((i) => [i.title, i.done, Boolean(i.entryId)])).toEqual([
        ["Stuck One", false, true],
        ["Fresh One", false, false],
      ]);

      const { recordReviewAttempt } = await import("@/app/actions/entry-actions");
      await recordReviewAttempt({
        entryId: plan.items!.find((i) => i.kind === "REDO")!.entryId!,
        status: "SOLVED_UNAIDED",
        minutes: 25,
      });
      plan = await getActivePlan(user.id);
      expect(plan.items?.find((i) => i.kind === "REDO")?.done).toBe(true);

      // Logging the fresh problem completes it.
      await createEntry({ problemId: fresh.id, status: "SOLVED_UNAIDED", minutes: 30 });
      plan = await getActivePlan(user.id);
      expect(plan.items?.find((i) => i.kind === "FRESH")?.done).toBe(true);
      // Committed on Sunday, so it's next week's plan.
      expect(plan.reviewDone).toBe(true);
      expect(plan.upcoming).toBe(true);
    });
  });

  it("rejects a REDO pick the user never logged", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({ email: "weekly3@example.com" }, tx);
      const p = await createTestProblem({}, tx);
      setTestUser(user);
      await expect(commitWeeklyPlan({ items: [{ kind: "REDO", problemId: p.id }] })).rejects.toThrow();
    });
  });

  it("is read-only between Tuesday and Saturday", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({ email: "weekly4@example.com" }, tx);
      const p = await createTestProblem({}, tx);
      await createTestEntry(user.id, p.id, { createReviewCard: true }, tx);
      setTestUser(user);
      vi.setSystemTime(new Date("2026-09-29T06:00:00Z")); // Tuesday

      const review = await getWeeklyReview(user.id);
      expect(review.open).toBe(false);
      expect(review.weekStart).toBe("2026-09-28");
      await expect(commitWeeklyPlan({ items: [{ kind: "REDO", problemId: p.id }] })).rejects.toThrow(/Sunday/);
    });
  });
});
