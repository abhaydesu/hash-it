import { describe, it, expect } from "vitest";
import { runInTestTransaction } from "@/tests/helpers/test-db";
import { createTestEntry, createTestProblem, createTestUser, createTestUserSettings } from "@/tests/helpers/factories";
import { getDailyReviewQueue } from "@/lib/dashboard";

const DAY = 86_400_000;

/** A due card whose only history is one imported attempt. */
async function dueEntry(
  tx: any,
  userId: string,
  title: string,
  opts: { rating: "GOOD" | "HARD"; daysOverdue: number; revisit?: boolean },
) {
  const problem = await createTestProblem({ title }, tx);
  const now = Date.now();
  const { entry } = await createTestEntry(
    userId,
    problem.id,
    { createReviewCard: true, due: new Date(now - opts.daysOverdue * DAY), revisit: opts.revisit ?? false },
    tx,
  );
  await tx.attempt.create({
    data: { entryId: entry.id, rating: opts.rating, at: new Date(now - 60 * DAY), source: "IMPORT" },
  });
  return entry;
}

const lanes = (queue: Array<{ lane: string; entryId: string }>) => ({
  resolve: queue.filter((i) => i.lane === "RESOLVE").map((i) => i.entryId),
  recall: queue.filter((i) => i.lane === "RECALL").map((i) => i.entryId),
});

describe("minimum daily re-solves", () => {
  it("tops the re-solve lane up from the oldest due card never solved cold", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({}, tx);
      await createTestUserSettings(user.id, {}, tx);
      const cold = await dueEntry(tx, user.id, "Cold old", { rating: "GOOD", daysOverdue: 30 });
      const youngHelp = await dueEntry(tx, user.id, "Help young", { rating: "HARD", daysOverdue: 5 });
      const oldHelp = await dueEntry(tx, user.id, "Help old", { rating: "HARD", daysOverdue: 20 });

      const { queue } = await getDailyReviewQueue(user.id, new Date());
      const { resolve, recall } = lanes(queue);
      expect(resolve).toEqual([oldHelp.id]);
      expect(recall).toContain(youngHelp.id);
      expect(recall).toContain(cold.id); // already solved cold: never pulled in
    });
  });

  it("does nothing when the minimum is 0", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({}, tx);
      await createTestUserSettings(user.id, { minDailyResolve: 0 }, tx);
      await dueEntry(tx, user.id, "Help", { rating: "HARD", daysOverdue: 20 });
      const { queue } = await getDailyReviewQueue(user.id, new Date());
      expect(lanes(queue).resolve).toEqual([]);
    });
  });

  it("pulls in nothing arbitrary when every due card was already solved cold", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({}, tx);
      await createTestUserSettings(user.id, {}, tx);
      await dueEntry(tx, user.id, "Cold A", { rating: "GOOD", daysOverdue: 10 });
      await dueEntry(tx, user.id, "Cold B", { rating: "GOOD", daysOverdue: 12 });
      const { queue } = await getDailyReviewQueue(user.id, new Date());
      expect(lanes(queue).resolve).toEqual([]);
    });
  });

  it("counts a re-solve already done today toward the minimum", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({}, tx);
      await createTestUserSettings(user.id, {}, tx);
      const done = await dueEntry(tx, user.id, "Done today", { rating: "GOOD", daysOverdue: 3 });
      await tx.attempt.create({
        data: { entryId: done.id, rating: "GOOD", at: new Date(), source: "REVIEW", lane: "RESOLVE" },
      });
      await dueEntry(tx, user.id, "Help", { rating: "HARD", daysOverdue: 20 });
      const { queue } = await getDailyReviewQueue(user.id, new Date());
      expect(lanes(queue).resolve).toEqual([]);
    });
  });

  it("keeps a lone overdue flagged card as a re-solve instead of demoting it to recall", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({}, tx);
      await createTestUserSettings(user.id, { minDailyResolve: 0 }, tx);
      const flagged = await dueEntry(tx, user.id, "Flagged", { rating: "GOOD", daysOverdue: 4, revisit: true });
      const { queue } = await getDailyReviewQueue(user.id, new Date());
      expect(lanes(queue).resolve).toEqual([flagged.id]);
    });
  });

  it("still demotes the oldest overdue re-solves beyond the daily cap to a recall check", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({}, tx);
      await createTestUserSettings(user.id, { minDailyResolve: 0 }, tx);
      const oldest = await dueEntry(tx, user.id, "Flagged oldest", { rating: "GOOD", daysOverdue: 9, revisit: true });
      await dueEntry(tx, user.id, "Flagged mid", { rating: "GOOD", daysOverdue: 6, revisit: true });
      await dueEntry(tx, user.id, "Flagged new", { rating: "GOOD", daysOverdue: 3, revisit: true });

      const { queue } = await getDailyReviewQueue(user.id, new Date());
      expect(lanes(queue).resolve).toHaveLength(2);
      const demoted = queue.find((i) => i.entryId === oldest.id);
      expect(demoted?.lane).toBe("RECALL");
      expect(demoted?.retryTomorrow).toBe(true);
    });
  });
});
