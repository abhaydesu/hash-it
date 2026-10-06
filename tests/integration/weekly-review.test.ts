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
import { createEntry, recordRecallAttempt } from "@/app/actions/entry-actions";
import { getWeeklyReview, getActivePlan } from "@/lib/weekly-review";
import { getDailyReviewQueue } from "@/lib/dashboard";

const DAY = 86_400_000;
// Sunday 4 Oct 2026, 11:30 in Asia/Kolkata (the default timezone): the review is open.
const SUNDAY = new Date("2026-10-04T06:00:00Z");

describe("Weekly review (Integration)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SUNDAY);
  });
  afterEach(() => vi.useRealTimers());

  it("keeps the daily quick-recall total at three even as passed cards leave the queue", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({ email: "weekly-recall-cap@example.com" }, tx);
      setTestUser(user);
      for (let i = 0; i < 4; i++) {
        const problem = await createTestProblem({ title: `Overdue Recall ${i}` }, tx);
        const { entry } = await createTestEntry(
          user.id,
          problem.id,
          { createAttempt: true, createReviewCard: true, due: new Date("2020-01-01T00:00:00Z") },
          tx,
        );
      }

      const initial = await getDailyReviewQueue(user.id, new Date(SUNDAY.getTime() + 2 * DAY));
      const recallIds = initial.queue.filter((item) => item.lane === "RECALL").map((item) => item.entryId);
      expect(recallIds).toHaveLength(3);

      for (const entryId of recallIds) {
        await recordRecallAttempt({ entryId, rating: "GOOD", retryTomorrow: true });
      }

      const lastRecall = await tx.attempt.findFirstOrThrow({
        where: { lane: "RECALL" },
        orderBy: { at: "desc" },
      });
      const afterPassing = await getDailyReviewQueue(user.id, new Date(lastRecall.at.getTime() + 1000));
      expect(afterPassing.recallCount).toBe(0);
    });
  });

  it("picks weak problems, keeps weekly misses out of the FSRS schedule, and shows a next-day recall", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({ email: "weekly1@example.com" }, tx);
      const pattern = await createTestPattern({ name: "Sliding Window Weekly" }, tx);
      const weak = await createTestProblem({ title: "Weak One" }, tx);
      const strong = await createTestProblem({ title: "Strong One" }, tx);
      const unseen = await createTestProblem({ title: "Unseen One", difficulty: "MEDIUM" }, tx);
      const overdue = await createTestProblem({ title: "Overdue Full Solve" }, tx);
      for (const p of [weak, strong, unseen, overdue]) await createTestPatternProblem(p.id, pattern.id, "SHEET", tx);

      const farDue = new Date(Date.now() + 30 * DAY);
      const { entry: weakEntry } = await createTestEntry(user.id, weak.id, { createReviewCard: true, due: farDue }, tx);
      await createTestEntry(user.id, strong.id, { createReviewCard: true, due: farDue }, tx);
      const { entry: overdueEntry } = await createTestEntry(
        user.id,
        overdue.id,
        { createReviewCard: true, due: new Date(SUNDAY.getTime() - 5 * DAY) },
        tx,
      );
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

      // A confident miss leaves the FSRS date and stability untouched.
      const originalDue = (await tx.reviewCard.findUnique({ where: { entryId: weakEntry.id } }))!.due;
      const outcome = await recordRecallCheck({ entryId: weakEntry.id, confidence: "CLEAR", recalled: false });
      expect(outcome).toEqual({ dueTomorrow: true, falseConfidence: true });
      const card = await tx.reviewCard.findUnique({ where: { entryId: weakEntry.id } });
      expect(card!.due.getTime()).toBe(originalDue.getTime());
      expect(card!.stability).toBe(1);

      const check = await tx.weeklyCheck.findUniqueOrThrow({
        where: { entryId_weekStart: { entryId: weakEntry.id, weekStart: "2026-10-05" } },
      });
      const queue = await getDailyReviewQueue(user.id, new Date(check.at.getTime() + DAY));
      expect(queue.queue.some((item) => item.entryId === weakEntry.id && item.lane === "RECALL")).toBe(true);
      expect(queue.queue.some((item) => item.entryId === overdueEntry.id && item.lane === "RECALL" && item.retryTomorrow)).toBe(true);

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
