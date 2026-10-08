import { describe, it, expect } from "vitest";
import { runInTestTransaction } from "@/tests/helpers/test-db";
import { createTestEntry, createTestProblem, createTestUser } from "@/tests/helpers/factories";
import { getDailyReviewQueue } from "@/lib/dashboard";
import { computeAllStats } from "@/lib/stats-engine";

const DAY = 86_400_000;

describe("imported attempt history", () => {
  it("routes an entry whose only attempt is IMPORT to Recall, not Resolve", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({}, tx);
      const problem = await createTestProblem({}, tx);
      const now = new Date();
      const { entry } = await createTestEntry(
        user.id,
        problem.id,
        { createReviewCard: true, due: new Date(now.getTime() - DAY) },
        tx,
      );
      await tx.attempt.create({
        data: { entryId: entry.id, rating: "GOOD", at: new Date(now.getTime() - 90 * DAY), source: "IMPORT", lane: null },
      });

      const { queue } = await getDailyReviewQueue(user.id, now);
      expect(queue.find((item) => item.entryId === entry.id)?.lane).toBe("RECALL");
    });
  });

  it("still sends a recall failed today to Resolve when an older IMPORT Good exists", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({}, tx);
      const problem = await createTestProblem({}, tx);
      const now = new Date();
      const { entry } = await createTestEntry(
        user.id,
        problem.id,
        { createReviewCard: true, due: now }, // exactly now: strictly-overdue cards are promoted to Recall
        tx,
      );
      await tx.attempt.create({
        data: { entryId: entry.id, rating: "GOOD", at: new Date(now.getTime() - 90 * DAY), source: "IMPORT", lane: null },
      });
      await tx.attempt.create({
        data: { entryId: entry.id, rating: "AGAIN", at: new Date(now.getTime() - 3600_000), source: "REVIEW", lane: "RECALL" },
      });

      const { queue } = await getDailyReviewQueue(user.id, now);
      expect(queue.find((item) => item.entryId === entry.id)?.lane).toBe("RESOLVE");
    });
  });

  it("counts imports toward never-solved-without-help but not the cold-solve rate or median time", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({}, tx);
      const mk = async (opts: { minutes: number | null }) => {
        const problem = await createTestProblem({ difficulty: "MEDIUM" }, tx);
        return (await createTestEntry(user.id, problem.id, { minutes: opts.minutes, createReviewCard: true }, tx)).entry;
      };
      const at = new Date(Date.now() - 30 * DAY);

      // A: imported cold solve. B: imported with help. C: logged failure, later passed a recall check.
      const a = await mk({ minutes: null });
      const b = await mk({ minutes: 30 });
      const c = await mk({ minutes: null });
      await tx.attempt.createMany({
        data: [
          { entryId: a.id, rating: "GOOD", at, source: "IMPORT" },
          { entryId: b.id, rating: "HARD", at, source: "IMPORT" },
          { entryId: c.id, rating: "AGAIN", at, source: "LOG" },
          { entryId: c.id, rating: "GOOD", at: new Date(), source: "REVIEW", lane: "RECALL" },
          { entryId: a.id, rating: "GOOD", at: new Date(), source: "REVIEW", lane: "RESOLVE" },
        ],
      });

      const { headline } = await computeAllStats(user.id);
      expect(headline.neverSolvedWithoutHelp).toBe(2); // B and C; A's imported Good counts as cold
      expect(headline.totalAttempts).toBe(1); // the one Resolve-lane re-solve; recall checks, logs and imports excluded
      expect(headline.coldSolveAttempts).toBe(1);
      expect(headline.medianMinutes.MEDIUM).toBe(30); // null-minute imports drop out
    });
  });
});
