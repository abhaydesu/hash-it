import { describe, it, expect } from "vitest";
import { runInTestTransaction } from "@/tests/helpers/test-db";
import { createTestUser, createTestProblem, createTestUserSettings } from "@/tests/helpers/factories";
import { setTestUser } from "@/tests/helpers/auth-helper";
import {
  createEntry,
  recordReviewAttempt,
  recordRecallAttempt,
  updateEntryInline,
} from "@/app/actions/entry-actions";
import {
  getUserSettings,
  updateUserSettings,
} from "@/app/actions/settings-actions";
import { dryRunImportCSV, commitImportBatch } from "@/app/actions/import-actions";
import { CardState, Rating } from "@prisma/client";

describe("User Loops (Integration)", () => {
  it("completes full log problem loop with initial card scheduling and attempt creation", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({ email: "user_loop1@example.com" }, tx);
      const problem = await createTestProblem(
        { title: "Three Sum", difficulty: "MEDIUM" },
        tx
      );

      setTestUser(user);

      // 1. Log solve
      const res = await createEntry({
        problemId: problem.id,
        status: "SOLVED_UNAIDED",
        minutes: 25,
        idea: "Two pointers after sorting",
        mistake: "Forgot duplicate handling",
        revisit: true,
      });

      expect(res.success).toBe(true);
      expect(res.entryId).toBeDefined();

      // Verify entry record in DB
      const entry = await tx.entry.findUnique({
        where: { id: res.entryId },
        include: { reviewCard: true, attempts: true },
      });
      expect(entry).not.toBeNull();
      expect(entry?.userId).toBe(user.id);
      expect(entry?.problemId).toBe(problem.id);
      expect(entry?.minutes).toBe(25);
      expect(entry?.revisit).toBe(true);

      // Verify attempt created
      expect(entry?.attempts.length).toBe(1);
      expect(entry?.attempts[0].minutes).toBe(25);

      // Verify review card initialized with FSRS state
      expect(entry?.reviewCard).not.toBeNull();
      expect(entry?.reviewCard?.state).toBe(CardState.LEARNING);
      expect(entry?.reviewCard?.reps).toBe(1);
      expect(entry?.reviewCard?.lapses).toBe(0);
      expect(entry?.reviewCard?.due.getTime()).toBeGreaterThan(Date.now());
    });
  });

  it("handles review outcome pass and fail transitions", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({ email: "user_loop2@example.com" }, tx);
      const problem = await createTestProblem({ title: "Invert Binary Tree", difficulty: "EASY" }, tx);

      setTestUser(user);

      // 1. Initial solve
      const createRes = await createEntry({
        problemId: problem.id,
        status: "SOLVED_UNAIDED",
        minutes: 10,
        revisit: true,
      });

      const entryId = createRes.entryId!;

      // 2. Record Review Outcome (PASS / Easy because solve time 8m < 0.6 * baseline 15m)
      const passReview = await recordReviewAttempt({
        entryId,
        status: "SOLVED_UNAIDED",
        minutes: 8,
        usedHint: false,
      });

      expect(passReview.success).toBe(true);
      expect(passReview.rating).toBe("EASY");

      let card = await tx.reviewCard.findUnique({ where: { entryId } });
      expect(card?.reps).toBe(2);
      expect(card?.lapses).toBe(0);
      const passDue = card!.due.getTime();
      expect(passDue).toBeGreaterThan(Date.now());

      // 3. Record Review Outcome (FAIL / Again)
      const failReview = await recordReviewAttempt({
        entryId,
        status: "ATTEMPTED_FAILED",
        minutes: 30,
        usedHint: true,
      });

      expect(failReview.success).toBe(true);
      expect(failReview.rating).toBe("AGAIN");

      card = await tx.reviewCard.findUnique({ where: { entryId } });
      expect(card?.lapses).toBe(1);
      expect(card?.state).toBe(CardState.RELEARNING);
      // Scheduled for next review
      expect(card?.scheduledDays).toBeLessThanOrEqual(1);
    });
  });

  it("records quick recall rating and updates card", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({ email: "user_loop3@example.com" }, tx);
      const problem = await createTestProblem({ title: "Binary Search", difficulty: "EASY" }, tx);

      setTestUser(user);

      const createRes = await createEntry({
        problemId: problem.id,
        status: "SOLVED_UNAIDED",
        minutes: 10,
        revisit: true,
      });

      const entryId = createRes.entryId!;

      // Record recall attempt
      const recallRes = await recordRecallAttempt({
        entryId,
        rating: "GOOD",
        wroteApproach: "Divide search space in half with low/high pointers",
      });

      expect(recallRes.success).toBe(true);

      const attempts = await tx.attempt.findMany({ where: { entryId } });
      // Initial solve attempt + recall attempt = 2
      expect(attempts.length).toBe(2);
      const recallAttempt = attempts.find((a: any) => a.note && a.note.startsWith("Recall:"));
      expect(recallAttempt).toBeDefined();
      expect(recallAttempt?.rating).toBe(Rating.GOOD);
      expect(recallAttempt?.note).toContain("Divide search space");
    });
  });

  it("performs end-to-end CSV import with matching, duplicates resolution, and schedule spread", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({ email: "user_csv@example.com" }, tx);
      const catalogProb = await createTestProblem(
        { title: "Trapping Rain Water", url: "https://leetcode.com/problems/trapping-rain-water" },
        tx
      );

      setTestUser(user);

      const csvContent = `Problem Name,Problem Link,Topic,Pattern,Idea,What I did wrong,Status,Revisit?,Source
Trapping Rain Water,https://leetcode.com/problems/trapping-rain-water,Two Pointers,Two Pointers,Two pointer approach,None,Solved (Unaided),Yes,LeetCode
New Custom Problem,https://custom.com/p/1,Graphs,DFS,Search all nodes,Stack overflow,Solved with help,No,Other`;

      // 1. Dry run
      const dryRun = await dryRunImportCSV(csvContent);
      expect(dryRun.rows.length).toBe(2);
      expect(dryRun.rows[0].matchedProblemId).toBe(catalogProb.id);
      expect(dryRun.rows[1].matchedProblemId).toBeFalsy(); // New custom problem

      // 2. Commit batch
      const commitRes = await commitImportBatch({
        rows: dryRun.rows,
        filename: "test_import.csv",
        conflictStrategy: "SKIP",
      });

      expect(commitRes.count).toBe(2);

      // Verify entries and review cards in DB
      const userEntries = await tx.entry.findMany({
        where: { userId: user.id },
        include: { reviewCard: true, problem: true },
      });

      expect(userEntries.length).toBe(2);

      // Review cards scheduled across spread
      for (const entry of userEntries) {
        expect(entry.reviewCard).not.toBeNull();
        expect(entry.reviewCard?.state).toBe(CardState.LEARNING);
      }
    });
  });

  it("updates user settings and retention parameters correctly", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({ email: "user_settings_loop@example.com" }, tx);
      setTestUser(user);

      // Initial settings
      const initial = await getUserSettings();
      expect(initial.dailyResolveCap).toBe(2);

      // Update settings
      await updateUserSettings({
        dailyResolveCap: 10,
        desiredRetention: 0.9,
        timezone: "America/New_York",
        easyBaseline: 12,
        mediumBaseline: 25,
        hardBaseline: 40,
      });

      const updated = await getUserSettings();
      expect(updated.dailyResolveCap).toBe(10);
      expect(updated.desiredRetention).toBe(0.9);
      expect(updated.timezone).toBe("America/New_York");
      expect(updated.easyBaseline).toBe(12);
      expect(updated.mediumBaseline).toBe(25);
      expect(updated.hardBaseline).toBe(40);
    });
  });
});
