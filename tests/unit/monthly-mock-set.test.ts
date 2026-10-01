import { describe, it, expect } from "vitest";
import {
  pickMonthlyMockSet,
  MOCK_SIZE,
  type CatalogProblem,
  type LoggedFact,
  type PatternPool,
} from "@/lib/monthly-mock-set";

let n = 0;
const prob = (difficulty: CatalogProblem["difficulty"], extra: Partial<CatalogProblem> = {}): CatalogProblem => ({
  id: `p${++n}`,
  title: `Problem ${n}`,
  number: n,
  url: `https://leetcode.com/problems/p${n}/`,
  platform: "LEETCODE",
  difficulty,
  isPaidOnly: false,
  ...extra,
});

const fact = (problem: CatalogProblem, pattern: string, extra: Partial<LoggedFact> = {}): LoggedFact => ({
  entryId: `e_${problem.id}`,
  problem,
  patterns: [pattern],
  struggle: 0,
  retrievability: 0.9,
  recentlyTouched: false,
  idea: null,
  mistake: null,
  ...extra,
});

/** A pattern with logged problems plus a pool of unseen ones of each difficulty. */
function world() {
  const pools: PatternPool[] = [];
  const facts: LoggedFact[] = [];
  const add = (name: string, family: string, retrievability: number) => {
    const logged = [prob("MEDIUM"), prob("MEDIUM")];
    const unseen = [prob("EASY"), prob("MEDIUM"), prob("MEDIUM"), prob("HARD"), prob("HARD")];
    pools.push({ name, family, problems: [...logged, ...unseen] });
    facts.push(...logged.map((p) => fact(p, name, { retrievability })));
    return { logged, unseen };
  };
  return { pools, facts, add };
}

const diffs = (set: { difficulty: string | null }[]) => set.map((p) => p.difficulty ?? "MEDIUM");

describe("pickMonthlyMockSet", () => {
  it("builds a contest-shaped E·M·M·H set: 2 revisit + 2 new, sorted by difficulty", () => {
    const w = world();
    const a = w.add("Sliding Window", "Window", 0.4);
    w.add("Binary Search", "Search", 0.5);
    w.add("Graphs BFS", "Graphs", 0.6);
    a.logged[0].difficulty = "EASY";
    w.facts[0].struggle = 5;
    w.facts[1].struggle = 3;

    const set = pickMonthlyMockSet(w.facts, w.pools, "seed");
    expect(set).toHaveLength(MOCK_SIZE);
    expect(diffs(set)).toEqual(["EASY", "MEDIUM", "MEDIUM", "HARD"]);
    expect(set.filter((p) => p.kind === "revisit").map((p) => p.id).sort()).toEqual(
      [a.logged[0].id, a.logged[1].id].sort(),
    );
    expect(set.filter((p) => p.kind === "new")).toHaveLength(2);
  });

  it("never takes more than one Hard, even if every struggled problem is Hard", () => {
    const w = world();
    w.add("DP", "DP", 0.3);
    w.add("Graphs", "Graphs", 0.5);
    for (const f of w.facts) {
      f.problem.difficulty = "HARD";
      f.struggle = 4;
    }
    const set = pickMonthlyMockSet(w.facts, w.pools, "seed");
    expect(set.filter((p) => p.difficulty === "HARD")).toHaveLength(1);
  });

  it("skips problems reviewed or logged in the last few days", () => {
    const w = world();
    w.add("Heap", "Heap", 0.4);
    w.add("Trie", "Trie", 0.5);
    w.facts[0].struggle = 9;
    w.facts[0].recentlyTouched = true;
    const set = pickMonthlyMockSet(w.facts, w.pools, "seed");
    expect(set.map((p) => p.id)).not.toContain(w.facts[0].problem.id);
  });

  it("only draws new problems from learned patterns, unseen and free", () => {
    const w = world();
    const learned = w.add("Two Pointers", "Pointers", 0.4);
    learned.unseen[1].isPaidOnly = true;
    const stranger = prob("MEDIUM");
    w.pools.push({ name: "Never Touched", family: "Other", problems: [stranger] });

    const set = pickMonthlyMockSet(w.facts, w.pools, "seed");
    const ids = set.map((p) => p.id);
    expect(ids).not.toContain(stranger.id);
    expect(ids).not.toContain(learned.unseen[1].id);
    for (const p of set.filter((p) => p.kind === "new")) {
      expect(learned.logged.map((l) => l.id)).not.toContain(p.id);
    }
  });

  it("spreads new problems across different families when it can", () => {
    const w = world();
    w.add("Sliding Window", "Window", 0.2);
    w.add("Fixed Window", "Window", 0.3);
    w.add("Union Find", "Graphs", 0.4);
    w.add("Tree DFS", "Trees", 0.5);
    w.add("Top K", "Heap", 0.6);
    const familyOf = new Map(w.pools.map((p) => [p.name, p.family]));
    const set = pickMonthlyMockSet(w.facts, w.pools, "seed");
    const families = set.filter((p) => p.kind === "new").map((p) => familyOf.get(p.patternName));
    expect(families).toHaveLength(MOCK_SIZE);
    expect(new Set(families).size).toBe(families.length);
  });

  it("fills with new problems when the month had no struggles", () => {
    const w = world();
    w.add("Stack", "Stack", 0.5);
    w.add("Queue", "Queue", 0.6);
    const set = pickMonthlyMockSet(w.facts, w.pools, "seed");
    expect(set).toHaveLength(MOCK_SIZE);
    expect(diffs(set).filter((d) => d === "HARD").length).toBeLessThanOrEqual(1);
  });

  it("falls back to Medium when no Hard exists", () => {
    const w = world();
    w.add("Arrays", "Arrays", 0.5);
    w.add("Strings", "Strings", 0.5);
    for (const pool of w.pools) pool.problems = pool.problems.filter((p) => p.difficulty !== "HARD");
    const set = pickMonthlyMockSet(w.facts, w.pools, "seed");
    expect(set).toHaveLength(MOCK_SIZE);
    expect(diffs(set)).not.toContain("HARD");
  });

  it("is stable for the same seed and returns nothing with no history", () => {
    const w = world();
    w.add("Greedy", "Greedy", 0.5);
    w.add("Bits", "Bits", 0.5);
    expect(pickMonthlyMockSet(w.facts, w.pools, "u:2026-10")).toEqual(pickMonthlyMockSet(w.facts, w.pools, "u:2026-10"));
    expect(pickMonthlyMockSet([], w.pools, "u:2026-10")).toEqual([]);
  });
});
