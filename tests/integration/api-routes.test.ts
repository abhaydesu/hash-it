import { describe, it, expect, vi } from "vitest";
import { runInTestTransaction } from "@/tests/helpers/test-db";
import { createTestUser, createTestProblem, createTestEntry } from "@/tests/helpers/factories";
import { setTestUser } from "@/tests/helpers/auth-helper";
import { GET as getTodayQueue } from "@/app/api/today-queue/route";
import { GET as getStats } from "@/app/api/stats/route";
import { GET as getWeeklyReview } from "@/app/api/review/weekly/route";
import { GET as getMonthlyReview } from "@/app/api/review/monthly/route";
import { POST as searchProblems } from "@/app/api/search/problems/route";
import { POST as syncLeetcodeCron } from "@/app/api/cron/sync-leetcode/route";

// Mock syncLeetCode script for cron
vi.mock("@/scripts/sync-leetcode", () => ({
  syncLeetCode: vi.fn(async () => ({ totalInserted: 5, totalUpdated: 0 })),
}));

describe("API Routes (Integration)", () => {
  it("enforces authentication on all user-scoped API endpoints", async () => {
    await runInTestTransaction(async () => {
      setTestUser(null);

      const resToday = await getTodayQueue();
      expect(resToday.status).toBe(401);

      const resStats = await getStats();
      expect(resStats.status).toBe(401);

      const resWeekly = await getWeeklyReview();
      expect(resWeekly.status).toBe(401);

      const resMonthly = await getMonthlyReview();
      expect(resMonthly.status).toBe(401);

      const searchReq = new Request("http://localhost:3000/api/search/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "two" }),
      });
      const resSearch = await searchProblems(searchReq);
      expect(resSearch.status).toBe(401);
    });
  });

  it("returns user-scoped dashboard and review data when authenticated", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({ email: "api_user@example.com" }, tx);
      const problem = await createTestProblem({ title: "Contains Duplicate" }, tx);
      await createTestEntry(user.id, problem.id, { createReviewCard: true, revisit: true }, tx);

      setTestUser(user);

      // 1. /api/today-queue
      const resToday = await getTodayQueue();
      expect(resToday.status).toBe(200);
      const todayData = await resToday.json();
      expect(todayData).toHaveProperty("queue");
      expect(todayData).toHaveProperty("snapshot");

      // 2. /api/stats
      const resStats = await getStats();
      expect(resStats.status).toBe(200);
      const statsData = await resStats.json();
      expect(statsData).toHaveProperty("totalEntries");
      expect(statsData).toHaveProperty("coldSolveRate");

      // 3. /api/search/problems
      const searchReq = new Request("http://localhost:3000/api/search/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "Contains" }),
      });
      const resSearch = await searchProblems(searchReq);
      expect(resSearch.status).toBe(200);
      const searchData = await resSearch.json();
      expect(searchData.results.length).toBeGreaterThan(0);
      expect(searchData.results[0].title).toBe("Contains Duplicate");
    });
  });

  it("enforces cron secret on /api/cron/sync-leetcode", async () => {
    const originalSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test_cron_secret_123";

    try {
      // Missing secret
      const reqNoSecret = new Request("http://localhost:3000/api/cron/sync-leetcode", { method: "POST" });
      const resNoSecret = await syncLeetcodeCron(reqNoSecret);
      expect(resNoSecret.status).toBe(401);

      // Invalid secret
      const reqInvalidSecret = new Request("http://localhost:3000/api/cron/sync-leetcode", {
        method: "POST",
        headers: { "x-cron-secret": "wrong_secret" },
      });
      const resInvalidSecret = await syncLeetcodeCron(reqInvalidSecret);
      expect(resInvalidSecret.status).toBe(401);

      // Valid secret
      const reqValidSecret = new Request("http://localhost:3000/api/cron/sync-leetcode", {
        method: "POST",
        headers: { "x-cron-secret": "test_cron_secret_123" },
      });
      const resValidSecret = await syncLeetcodeCron(reqValidSecret);
      expect(resValidSecret.status).toBe(200);
      const data = await resValidSecret.json();
      expect(data.ok).toBe(true);
      expect(data.totalInserted).toBe(5);
    } finally {
      process.env.CRON_SECRET = originalSecret;
    }
  });
});
