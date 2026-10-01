import { describe, it, expect } from "vitest";
import { runInTestTransaction } from "@/tests/helpers/test-db";
import {
  createTestUser,
  createTestProblem,
  createTestEntry,
  createTestPattern,
  createTestPatternProblem,
} from "@/tests/helpers/factories";
import { setTestUser } from "@/tests/helpers/auth-helper";
import { GET as getMonthlyReview } from "@/app/api/review/monthly/route";

describe("GET /api/review/monthly", () => {
  it("only draws problems from patterns the user has logged", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({}, tx);
      const learned = await createTestPattern({ name: "Learned Sliding Window", family: "Window" }, tx);
      const unlearned = await createTestPattern({ name: "Unlearned Graphs", family: "Graphs" }, tx);

      const solved = await createTestProblem({ title: "Solved One" }, tx);
      const sibling = await createTestProblem({ title: "Sibling In Learned" }, tx);
      const foreign = await createTestProblem({ title: "Graph Problem" }, tx);
      await createTestPatternProblem(solved.id, learned.id, "SHEET", tx);
      await createTestPatternProblem(sibling.id, learned.id, "SHEET", tx);
      await createTestPatternProblem(foreign.id, unlearned.id, "SHEET", tx);
      await createTestEntry(user.id, solved.id, { createReviewCard: true }, tx);

      setTestUser(user);
      const res = await getMonthlyReview();
      expect(res.status).toBe(200);
      const data = await res.json();
      const ids = data.problems.map((p: { id: string }) => p.id);

      expect(ids).not.toContain(foreign.id);
      expect(ids.length).toBeGreaterThan(0);
      for (const p of data.problems) expect(p.patternName).toBe(learned.name);
      expect(data.problems.length).toBeLessThanOrEqual(4);
    });
  });

  it("returns nothing for a user who hasn't logged anything", async () => {
    await runInTestTransaction(async (tx) => {
      const user = await createTestUser({}, tx);
      const pattern = await createTestPattern({}, tx);
      const problem = await createTestProblem({}, tx);
      await createTestPatternProblem(problem.id, pattern.id, "SHEET", tx);

      setTestUser(user);
      const data = await (await getMonthlyReview()).json();
      expect(data.problems).toEqual([]);
    });
  });
});
