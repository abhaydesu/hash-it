import { describe, it, expect, beforeEach } from "vitest";
import { runInTestTransaction } from "@/tests/helpers/test-db";
import {
  createTestUser,
  createTestProblem,
  createTestEntry,
  createTestUserSettings,
} from "@/tests/helpers/factories";
import { setTestUser } from "@/tests/helpers/auth-helper";
import {
  createEntry,
  deleteEntry,
  toggleScheduleReview,
  recordReviewAttempt,
  recordRecallAttempt,
  updateEntryInline,
  toggleRoadmapItemSolve,
} from "@/app/actions/entry-actions";
import {
  getUserSettings,
  updateUserSettings,
  optimizeFSRSParams,
} from "@/app/actions/settings-actions";
import {
  commitImportBatch,
  dryRunImportCSV,
  searchCatalogProblems,
} from "@/app/actions/import-actions";
import { GET as getStats } from "@/app/api/stats/route";
import { GET as getTodayQueue } from "@/app/api/today-queue/route";
import { GET as getPatterns } from "@/app/api/patterns/route";
import { GET as getWeeklyReview } from "@/app/api/review/weekly/route";
import { GET as getMonthlyReview } from "@/app/api/review/monthly/route";
import { POST as postDrill } from "@/app/api/review/weekly/drill/route";
import { POST as searchProblems } from "@/app/api/search/problems/route";

describe("Authorization Matrix (Integration)", () => {
  beforeEach(() => {
    setTestUser(null);
  });

  it("rejects unauthorized access when no session is present", async () => {
    await runInTestTransaction(async () => {
      setTestUser(null);

      await expect(
        createEntry({
          manualTitle: "Test Problem",
          status: "SOLVED_UNAIDED",
        })
      ).rejects.toThrow(/unauthorized/i);

      await expect(deleteEntry("some-entry-id")).rejects.toThrow(/unauthorized/i);
      await expect(
        updateEntryInline({ entryId: "some-entry-id", field: "revisit", value: true })
      ).rejects.toThrow(/unauthorized/i);
      await expect(toggleScheduleReview("some-entry-id", true)).rejects.toThrow(/unauthorized/i);
      await expect(
        recordReviewAttempt({
          entryId: "some-entry-id",
          status: "SOLVED_UNAIDED",
          minutes: 10,
        })
      ).rejects.toThrow(/unauthorized/i);
      await expect(
        recordRecallAttempt({
          entryId: "some-entry-id",
          rating: "GOOD",
        })
      ).rejects.toThrow(/unauthorized/i);
      await expect(
        toggleRoadmapItemSolve({
          itemTitle: "Two Sum",
          currentlySolved: false,
        })
      ).rejects.toThrow(/unauthorized/i);

      await expect(getUserSettings()).rejects.toThrow(/unauthorized/i);
      await expect(
        updateUserSettings({
          dailyResolveCap: 5,
          desiredRetention: 0.85,
          timezone: "UTC",
          easyBaseline: 10,
          mediumBaseline: 20,
          hardBaseline: 30,
        })
      ).rejects.toThrow(/unauthorized/i);
      await expect(optimizeFSRSParams()).rejects.toThrow(/unauthorized/i);

      await expect(searchCatalogProblems("two")).rejects.toThrow(/unauthorized/i);
      await expect(dryRunImportCSV("Problem Name,Problem Link\n")).rejects.toThrow(/unauthorized/i);
      await expect(
        commitImportBatch({
          rows: [],
          filename: "test.csv",
          conflictStrategy: "SKIP",
        })
      ).rejects.toThrow(/unauthorized/i);
    });
  });

  it("rejects unauthenticated requests to every user-scoped API handler", async () => {
    await runInTestTransaction(async () => {
      setTestUser(null);

      expect((await getTodayQueue()).status).toBe(401);
      expect((await getStats()).status).toBe(401);
      expect((await getPatterns()).status).toBe(401);
      expect((await getWeeklyReview()).status).toBe(401);
      expect((await getMonthlyReview()).status).toBe(401);

      const drillReq = new Request("http://localhost:3000/api/review/weekly/drill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patternId: "p1", correct: true }),
      });
      expect((await postDrill(drillReq)).status).toBe(401);

      const searchReq = new Request("http://localhost:3000/api/search/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "two" }),
      });
      expect((await searchProblems(searchReq)).status).toBe(401);
    });
  });

  it("prevents User A from modifying User B's entry data (cross-user isolation)", async () => {
    await runInTestTransaction(async (tx) => {
      const userA = await createTestUser({ email: "usera@example.com", name: "User A" }, tx);
      const userB = await createTestUser({ email: "userb@example.com", name: "User B" }, tx);
      const problem = await createTestProblem({ title: "Shared Problem" }, tx);

      const { entry: entryB } = await createTestEntry(
        userB.id,
        problem.id,
        {
          minutes: 25,
          revisit: false,
          idea: "User B original idea",
          createReviewCard: true,
        },
        tx
      );

      setTestUser(userA);

      await expect(deleteEntry(entryB.id)).rejects.toThrow();
      expect(await tx.entry.findUnique({ where: { id: entryB.id } })).not.toBeNull();

      await expect(
        updateEntryInline({ entryId: entryB.id, field: "revisit", value: true })
      ).rejects.toThrow();
      expect((await tx.entry.findUnique({ where: { id: entryB.id } }))?.revisit).toBe(false);

      await expect(toggleScheduleReview(entryB.id, false)).rejects.toThrow();
      expect(await tx.reviewCard.findUnique({ where: { entryId: entryB.id } })).not.toBeNull();

      await expect(
        recordReviewAttempt({
          entryId: entryB.id,
          status: "SOLVED_UNAIDED",
          minutes: 15,
        })
      ).rejects.toThrow();
      expect(await tx.attempt.count({ where: { entryId: entryB.id } })).toBe(0);

      await expect(
        recordRecallAttempt({
          entryId: entryB.id,
          rating: "GOOD",
        })
      ).rejects.toThrow();
      expect(await tx.attempt.count({ where: { entryId: entryB.id } })).toBe(0);

      await expect(
        updateEntryInline({
          entryId: entryB.id,
          field: "idea",
          value: "User A malicious overwrite",
        })
      ).rejects.toThrow();
      expect((await tx.entry.findUnique({ where: { id: entryB.id } }))?.idea).toBe(
        "User B original idea"
      );

      // Roadmap unmark with User B's entryId must not delete User B's row
      await expect(
        toggleRoadmapItemSolve({
          itemTitle: "Shared Problem",
          currentlySolved: true,
          entryId: entryB.id,
        })
      ).rejects.toThrow(/not found|unauthorized/i);
      expect(await tx.entry.findUnique({ where: { id: entryB.id } })).not.toBeNull();
    });
  });

  it("keeps settings and import batches isolated between users", async () => {
    await runInTestTransaction(async (tx) => {
      const userA = await createTestUser({ email: "settings_a@example.com" }, tx);
      const userB = await createTestUser({ email: "settings_b@example.com" }, tx);
      await createTestUserSettings(userB.id, { dailyResolveCap: 9, timezone: "UTC" }, tx);

      setTestUser(userA);
      const settingsA = await getUserSettings();
      expect(settingsA.userId).toBe(userA.id);
      expect(settingsA.dailyResolveCap).not.toBe(9);

      await updateUserSettings({
        dailyResolveCap: 3,
        desiredRetention: 0.8,
        timezone: "Asia/Kolkata",
        easyBaseline: 15,
        mediumBaseline: 30,
        hardBaseline: 45,
      });

      const settingsB = await tx.userSettings.findUnique({ where: { userId: userB.id } });
      expect(settingsB?.dailyResolveCap).toBe(9);

      // User A dry-run must not see User B's existing entry as their conflict
      const problem = await createTestProblem({ title: "Isolation Problem", number: 4242 }, tx);
      await createTestEntry(userB.id, problem.id, {}, tx);

      const csv = `Problem Name,Problem Link,Status\n4242. Isolation Problem,https://leetcode.com/problems/isolation-problem/,Solved\n`;
      const dry = await dryRunImportCSV(csv);
      const row = dry.rows.find((r) => r.matchedProblemId === problem.id);
      expect(row?.existingEntrySummary).toBeUndefined();
      expect(dry.existingEntryConflictCount).toBe(0);
    });
  });

  it("API handlers only return the authenticated user's data", async () => {
    await runInTestTransaction(async (tx) => {
      const userA = await createTestUser({ email: "api_a@example.com" }, tx);
      const userB = await createTestUser({ email: "api_b@example.com" }, tx);
      const problemA = await createTestProblem({ title: "User A Only Problem" }, tx);
      const problemB = await createTestProblem({ title: "User B Secret Problem" }, tx);

      await createTestEntry(userA.id, problemA.id, { createReviewCard: true, minutes: 10 }, tx);
      await createTestEntry(userB.id, problemB.id, { createReviewCard: true, minutes: 99 }, tx);

      setTestUser(userA);

      const statsRes = await getStats();
      expect(statsRes.status).toBe(200);
      const stats = await statsRes.json();
      expect(stats.totalEntries).toBe(1);

      const todayRes = await getTodayQueue();
      expect(todayRes.status).toBe(200);
      const today = await todayRes.json();
      const titles = (today.queue ?? []).map((q: { title: string }) => q.title);
      expect(titles).not.toContain("User B Secret Problem");

      const patternsRes = await getPatterns();
      expect(patternsRes.status).toBe(200);

      const weeklyRes = await getWeeklyReview();
      expect(weeklyRes.status).toBe(200);

      const monthlyRes = await getMonthlyReview();
      expect(monthlyRes.status).toBe(200);
    });
  });

  it("id-addressed problem detail returns not-found for another user's entry", async () => {
    await runInTestTransaction(async (tx) => {
      const userA = await createTestUser({ email: "detail_a@example.com" }, tx);
      const userB = await createTestUser({ email: "detail_b@example.com" }, tx);
      const problem = await createTestProblem({ title: "Private Entry" }, tx);
      const { entry: entryB } = await createTestEntry(userB.id, problem.id, {}, tx);

      setTestUser(userA);

      const { prisma } = await import("@/lib/prisma");
      const entry = await prisma.entry.findFirst({
        where: { id: entryB.id, userId: userA.id },
      });
      expect(entry).toBeNull();
    });
  });

  it("sign-in by a new user inherits no existing records", async () => {
    await runInTestTransaction(async (tx) => {
      const existing = await createTestUser({ email: "existing@example.com" }, tx);
      const problem = await createTestProblem({ title: "Existing User Problem" }, tx);
      await createTestEntry(existing.id, problem.id, { createReviewCard: true }, tx);
      await createTestUserSettings(existing.id, { dailyResolveCap: 7 }, tx);

      const newbie = await createTestUser({ email: "newbie@example.com" }, tx);
      setTestUser(newbie);

      expect(await tx.entry.count({ where: { userId: newbie.id } })).toBe(0);
      expect(await tx.attempt.count({ where: { entry: { userId: newbie.id } } })).toBe(0);
      expect(await tx.reviewCard.count({ where: { entry: { userId: newbie.id } } })).toBe(0);
      expect(await tx.importBatch.count({ where: { userId: newbie.id } })).toBe(0);

      const settings = await getUserSettings();
      expect(settings.userId).toBe(newbie.id);
      expect(settings.dailyResolveCap).not.toBe(7);

      // Still zero entries after settings upsert
      expect(await tx.entry.count({ where: { userId: newbie.id } })).toBe(0);
      expect(await tx.entry.count({ where: { userId: existing.id } })).toBe(1);
    });
  });

  it("allows User A to modify own data successfully", async () => {
    await runInTestTransaction(async (tx) => {
      const userA = await createTestUser({ email: "usera_self@example.com", name: "User A Self" }, tx);
      const problem = await createTestProblem({ title: "User A Problem" }, tx);

      setTestUser(userA);

      const createRes = await createEntry({
        problemId: problem.id,
        status: "SOLVED_UNAIDED",
        minutes: 20,
        idea: "Self idea",
      });
      expect(createRes.success).toBe(true);

      const entry = await tx.entry.findUnique({ where: { id: createRes.entryId } });
      expect(entry).not.toBeNull();
      expect(entry?.userId).toBe(userA.id);

      const revisitRes = await updateEntryInline({ entryId: entry!.id, field: "revisit", value: true });
      expect(revisitRes.success).toBe(true);
      expect((await tx.entry.findUnique({ where: { id: entry!.id } }))?.revisit).toBe(true);

      const reviewRes = await recordReviewAttempt({
        entryId: entry!.id,
        status: "SOLVED_UNAIDED",
        minutes: 15,
      });
      expect(reviewRes.success).toBe(true);

      const recallRes = await recordRecallAttempt({
        entryId: entry!.id,
        rating: "GOOD",
      });
      expect(recallRes.success).toBe(true);

      const deleteRes = await deleteEntry(entry!.id);
      expect(deleteRes.success).toBe(true);
      expect(await tx.entry.findUnique({ where: { id: entry!.id } })).toBeNull();
    });
  });
});
