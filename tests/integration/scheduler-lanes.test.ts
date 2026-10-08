import { describe, it, expect } from "vitest";
import { runInTestTransaction } from "@/tests/helpers/test-db";
import { createTestProblem, createTestUser, createTestUserSettings } from "@/tests/helpers/factories";
import { setTestUser } from "@/tests/helpers/auth-helper";
import { createEntry, recordRecallAttempt, recordReviewAttempt, updateEntryInline } from "@/app/actions/entry-actions";
import { getDailyReviewQueue } from "@/lib/dashboard";
import { deriveLane, failedRecallPending, hasQueueReview, type LaneAttempt } from "@/lib/scheduler";

describe("first review then a failed recall", () => {
  it("logs into a recall check, and a failed recall comes back as resolve", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({}, tx);
      // These tests check the base lane rules, so keep the daily re-solve top-up out of the way.
      await createTestUserSettings(user.id, { minDailyResolve: 0 }, tx);
      const problem = await createTestProblem({ difficulty: "MEDIUM" }, tx);
      setTestUser(user);

      const { entryId } = await createEntry({
        problemId: problem.id,
        status: "ATTEMPTED_FAILED",
        minutes: 40,
      });

      const logged = await tx.entry.findUniqueOrThrow({
        where: { id: entryId },
        include: { reviewCard: true, attempts: true },
      });
      expect(logged.attempts).toHaveLength(1);
      expect(logged.attempts[0].lane).toBeNull();
      expect(logged.reviewCard?.scheduledDays).toBe(7);
      expect(logged.reviewCard?.reps).toBe(1);
      expect(hasQueueReview(logged.attempts)).toBe(false);

      const dueNow = new Date();
      await tx.reviewCard.update({ where: { entryId }, data: { due: dueNow } });
      const firstQueue = await getDailyReviewQueue(user.id, dueNow);
      const firstItem = firstQueue.queue.find((item) => item.entryId === entryId);
      expect(firstItem?.lane).toBe("RECALL");

      const failed = await recordRecallAttempt({ entryId, rating: "AGAIN" });
      expect(failed.success).toBe(true);

      const afterFail = await tx.entry.findUniqueOrThrow({
        where: { id: entryId },
        include: { reviewCard: true, attempts: { orderBy: { at: "asc" } } },
      });
      expect(afterFail.attempts[1].lane).toBe("RECALL");
      expect(afterFail.attempts[1].rating).toBe("AGAIN");
      expect(afterFail.reviewCard?.scheduledDays).toBeGreaterThanOrEqual(2);
      expect(afterFail.reviewCard?.lapses).toBe(1);
      const attempts = afterFail.attempts as LaneAttempt[];
      expect(failedRecallPending(attempts)).toBe(true);
      expect(deriveLane({ reviewed: true, lapses: afterFail.reviewCard?.lapses, failedRecall: true })).toBe("RESOLVE");

      const dueAgain = new Date();
      await tx.reviewCard.update({ where: { entryId }, data: { due: dueAgain } });
      const nextQueue = await getDailyReviewQueue(user.id, dueAgain);
      expect(nextQueue.queue.find((item) => item.entryId === entryId)?.lane).toBe("RESOLVE");
    });
  });

  it("clears the revisit flag on the next cold solve", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({}, tx);
      const problem = await createTestProblem({ difficulty: "MEDIUM" }, tx);
      setTestUser(user);

      const { entryId } = await createEntry({
        problemId: problem.id,
        status: "SOLVED_UNAIDED",
        minutes: 30,
        revisit: true,
      });
      const flagged = await tx.entry.findUniqueOrThrow({
        where: { id: entryId },
        include: { reviewCard: true },
      });
      expect(flagged.revisit).toBe(true);
      expect(flagged.reviewCard?.scheduledDays).toBe(4);

      await recordReviewAttempt({ entryId, status: "SOLVED_UNAIDED", minutes: 20, fromQueue: true });
      const cleared = await tx.entry.findUniqueOrThrow({ where: { id: entryId } });
      expect(cleared.revisit).toBe(false);
    });
  });

  it("routes a freshly flagged card to resolve when it comes due", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({}, tx);
      const problem = await createTestProblem({ difficulty: "MEDIUM" }, tx);
      setTestUser(user);

      const { entryId } = await createEntry({ problemId: problem.id, status: "SOLVED_UNAIDED", minutes: 30, revisit: true });
      const dueNow = new Date();
      await tx.reviewCard.update({ where: { entryId }, data: { due: dueNow } });
      const queue = await getDailyReviewQueue(user.id, dueNow);
      expect(queue.queue.find((item) => item.entryId === entryId)?.lane).toBe("RESOLVE");
    });
  });

  it("flagging an existing card pulls its due date in to the flagged interval", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({}, tx);
      const problem = await createTestProblem({ difficulty: "MEDIUM" }, tx);
      setTestUser(user);

      const { entryId } = await createEntry({ problemId: problem.id, status: "SOLVED_UNAIDED", minutes: 30 });
      const before = await tx.reviewCard.findUniqueOrThrow({ where: { entryId } });
      expect(before.scheduledDays).toBe(14);

      await updateEntryInline({ entryId, field: "revisit", value: true });
      const after = await tx.reviewCard.findUniqueOrThrow({ where: { entryId } });
      const days = (after.due.getTime() - Date.now()) / 86_400_000;
      expect(after.scheduledDays).toBe(4);
      expect(days).toBeGreaterThan(3.9);
      expect(days).toBeLessThan(4.1);
    });
  });

  it("flagging never pushes a sooner due date out", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({}, tx);
      const problem = await createTestProblem({ difficulty: "MEDIUM" }, tx);
      setTestUser(user);

      const { entryId } = await createEntry({ problemId: problem.id, status: "SOLVED_UNAIDED", minutes: 30 });
      const soon = new Date(Date.now() + 2 * 86_400_000);
      await tx.reviewCard.update({ where: { entryId }, data: { due: soon, scheduledDays: 2 } });

      await updateEntryInline({ entryId, field: "revisit", value: true });
      const after = await tx.reviewCard.findUniqueOrThrow({ where: { entryId } });
      expect(after.due.getTime()).toBe(soon.getTime());
      expect(after.scheduledDays).toBe(2);
    });
  });

  it("re-logging an existing card with the flag pulls its due date in", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({}, tx);
      const problem = await createTestProblem({ difficulty: "MEDIUM" }, tx);
      setTestUser(user);

      const { entryId } = await createEntry({ problemId: problem.id, status: "SOLVED_UNAIDED", minutes: 30 });
      await createEntry({ problemId: problem.id, status: "SOLVED_UNAIDED", minutes: 30, revisit: true });
      const after = await tx.reviewCard.findUniqueOrThrow({ where: { entryId } });
      expect((after.due.getTime() - Date.now()) / 86_400_000).toBeLessThanOrEqual(4.1);
    });
  });

  it("sends a solution-learned problem to resolve after its first recall pass, and back to recall once solved cold", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({}, tx);
      // These tests check the base lane rules, so keep the daily re-solve top-up out of the way.
      await createTestUserSettings(user.id, { minDailyResolve: 0 }, tx);
      const problem = await createTestProblem({ difficulty: "MEDIUM" }, tx);
      setTestUser(user);

      const { entryId } = await createEntry({ problemId: problem.id, status: "ATTEMPTED_FAILED", minutes: 40 });
      const due = async () => {
        const now = new Date();
        await tx.reviewCard.update({ where: { entryId }, data: { due: now } });
        const { queue } = await getDailyReviewQueue(user.id, now);
        return queue.find((item) => item.entryId === entryId)?.lane;
      };

      expect(await due()).toBe("RECALL");
      await recordRecallAttempt({ entryId, rating: "GOOD" });
      expect(await due()).toBe("RESOLVE");

      await recordReviewAttempt({ entryId, status: "SOLVED_UNAIDED", minutes: 20, fromQueue: true });
      expect(await due()).toBe("RECALL");
    });
  });

  it("keeps a problem first solved cold on recall after a recall pass", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({}, tx);
      const problem = await createTestProblem({ difficulty: "MEDIUM" }, tx);
      setTestUser(user);

      const { entryId } = await createEntry({ problemId: problem.id, status: "SOLVED_UNAIDED", minutes: 30 });
      await recordRecallAttempt({ entryId, rating: "GOOD" });
      const now = new Date();
      await tx.reviewCard.update({ where: { entryId }, data: { due: now } });
      const { queue } = await getDailyReviewQueue(user.id, now);
      expect(queue.find((item) => item.entryId === entryId)?.lane).toBe("RECALL");
    });
  });
});
