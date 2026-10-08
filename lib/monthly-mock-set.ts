import { prisma } from "@/lib/prisma";
import { calculateRetrievability, type ReviewCardData } from "@/lib/scheduler";
import { normalizePatternList } from "@/lib/utils";
import { canonicalPattern } from "@/lib/pattern-match";

/**
 * Monthly mock composition: contest-shaped E·M·M·H.
 * 2 "revisit" problems — the ones you struggled with most this month — and
 * 2 "new" problems from your weakest learned patterns, across distinct families.
 * Never more than one Hard; a slot that can't be filled falls back to Medium.
 */
export const MOCK_SLOTS = { EASY: 1, MEDIUM: 2, HARD: 1 } as const;
export const MOCK_SIZE = 4;
const REVISIT_COUNT = 2;
const STRUGGLE_WINDOW_DAYS = 30;
const RECENT_REVIEW_DAYS = 4;
const MIN_LOGGED_FOR_WEAKNESS = 2;
const DAY_MS = 86_400_000;

type Diff = "EASY" | "MEDIUM" | "HARD";
const DIFF_ORDER: Record<Diff, number> = { EASY: 0, MEDIUM: 1, HARD: 2 };

export interface MockProblem {
  id: string;
  entryId?: string;
  title: string;
  number: number | null;
  url: string;
  platform: string;
  patternName: string; // revealed only after completion
  difficulty: Diff | null; // revealed only after completion
  kind: "revisit" | "new";
  /** Existing notes, so the wrap-up step edits rather than overwrites. */
  idea?: string | null;
  mistake?: string | null;
}

export interface CatalogProblem {
  id: string;
  title: string;
  number: number | null;
  url: string;
  platform: string;
  difficulty: Diff | null;
  isPaidOnly: boolean;
}

export interface LoggedFact {
  entryId: string;
  problem: CatalogProblem;
  /** Canonical pattern names this entry counts toward. */
  patterns: string[];
  /** Trouble this month: Again ratings, hints, and fail/hint first logs. */
  struggle: number;
  retrievability: number;
  /** Reviewed or first logged within the last few days — skip as a revisit. */
  recentlyTouched: boolean;
  idea: string | null;
  mistake: string | null;
}

export interface PatternPool {
  name: string;
  family: string;
  problems: CatalogProblem[];
}

const diffOf = (p: CatalogProblem): Diff => p.difficulty ?? "MEDIUM";

/** Deterministic PRNG so a month's set is stable across reloads. */
function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Pure selection — everything it needs is passed in. */
export function pickMonthlyMockSet(facts: LoggedFact[], pools: PatternPool[], seed: string): MockProblem[] {
  const rand = seededRandom(seed);
  const open: Record<Diff, number> = { ...MOCK_SLOTS };
  const picked: MockProblem[] = [];
  const usedProblems = new Set<string>();
  const usedFamilies = new Set<string>();
  const loggedProblemIds = new Set(facts.map((f) => f.problem.id));
  const poolByName = new Map(pools.map((p) => [p.name, p]));
  const familyOf = (pattern: string) => poolByName.get(pattern)?.family ?? pattern;

  const hardTaken = () => picked.some((p) => p.difficulty === "HARD");
  /** Strict: needs an open slot of that difficulty. Relaxed: anything but a second Hard. */
  const fits = (d: Diff, relaxed: boolean) => (relaxed ? d !== "HARD" || !hardTaken() : open[d] > 0);
  const claim = (d: Diff) => {
    if (open[d] > 0) open[d]--;
    // A relaxed pick stands in for whichever slot is left; Medium is the fallback.
    else if (open.MEDIUM > 0) open.MEDIUM--;
    else if (open.EASY > 0) open.EASY--;
    else open.HARD--;
  };
  const full = () => picked.length >= MOCK_SIZE;

  // ── Revisit: struggled most this month, fading fastest ──
  const revisitPool = facts
    .filter((f) => !f.recentlyTouched)
    .sort((a, b) => b.struggle - a.struggle || a.retrievability - b.retrievability);

  const takeRevisit = (f: LoggedFact, relaxed: boolean) => {
    const d = diffOf(f.problem);
    if (usedProblems.has(f.problem.id) || !fits(d, relaxed)) return false;
    claim(d);
    usedProblems.add(f.problem.id);
    const pattern = f.patterns[0] ?? "General";
    usedFamilies.add(familyOf(pattern));
    picked.push({ ...toMock(f.problem, pattern, "revisit"), entryId: f.entryId, idea: f.idea, mistake: f.mistake });
    return true;
  };

  const revisitTarget = () => picked.filter((p) => p.kind === "revisit").length < REVISIT_COUNT;
  for (const f of revisitPool) {
    if (!revisitTarget()) break;
    if (f.struggle > 0) takeRevisit(f, false);
  }

  // ── New: unseen problems from the weakest learned patterns ──
  const byPattern = new Map<string, LoggedFact[]>();
  for (const f of facts) {
    for (const name of f.patterns) {
      if (!byPattern.has(name)) byPattern.set(name, []);
      byPattern.get(name)!.push(f);
    }
  }
  const weakest = Array.from(byPattern, ([name, fs]) => ({
    name,
    logged: fs.length,
    avg: fs.reduce((s, f) => s + f.retrievability, 0) / fs.length,
  }))
    .filter((p) => poolByName.has(p.name))
    .sort((a, b) => a.avg - b.avg);

  const unseenFor = (name: string) =>
    shuffled(
      poolByName.get(name)!.problems.filter((p) => !p.isPaidOnly && !loggedProblemIds.has(p.id)),
      rand,
    );
  const unseenCache = new Map<string, CatalogProblem[]>();
  const unseen = (name: string) => {
    if (!unseenCache.has(name)) unseenCache.set(name, unseenFor(name));
    return unseenCache.get(name)!;
  };

  const newPass = (opts: { minLogged: number; distinctFamilies: boolean; relaxed: boolean }) => {
    for (const pat of weakest) {
      if (full()) return;
      if (pat.logged < opts.minLogged) continue;
      const family = familyOf(pat.name);
      if (opts.distinctFamilies && usedFamilies.has(family)) continue;
      const candidate = unseen(pat.name).find((p) => !usedProblems.has(p.id) && fits(diffOf(p), opts.relaxed));
      if (!candidate) continue;
      claim(diffOf(candidate));
      usedProblems.add(candidate.id);
      usedFamilies.add(family);
      picked.push(toMock(candidate, pat.name, "new"));
    }
  };

  // Strictest first; each step loosens one rule until the set is full.
  newPass({ minLogged: MIN_LOGGED_FOR_WEAKNESS, distinctFamilies: true, relaxed: false });
  newPass({ minLogged: 1, distinctFamilies: true, relaxed: false });
  // Not enough fresh material: let more revisits fill the shape.
  for (const f of revisitPool) {
    if (full()) break;
    takeRevisit(f, false);
  }
  newPass({ minLogged: 1, distinctFamilies: false, relaxed: false });
  // Shape can't be met (e.g. no Hard anywhere): fall back to Mediums, still ≤1 Hard.
  newPass({ minLogged: 1, distinctFamilies: true, relaxed: true });
  newPass({ minLogged: 1, distinctFamilies: false, relaxed: true });
  for (const f of revisitPool) {
    if (full()) break;
    takeRevisit(f, true);
  }

  // Contest order: Easy → Medium → Hard; familiar ground first within a tier.
  return picked.sort(
    (a, b) =>
      DIFF_ORDER[a.difficulty ?? "MEDIUM"] - DIFF_ORDER[b.difficulty ?? "MEDIUM"] ||
      (a.kind === b.kind ? 0 : a.kind === "revisit" ? -1 : 1),
  );
}

function toMock(p: CatalogProblem, patternName: string, kind: MockProblem["kind"]): MockProblem {
  return {
    id: p.id,
    title: p.title,
    number: p.number,
    url: p.url,
    platform: p.platform,
    patternName,
    difficulty: p.difficulty,
    kind,
  };
}

const catalogSelect = {
  id: true,
  title: true,
  number: true,
  url: true,
  platform: true,
  difficulty: true,
  isPaidOnly: true,
} as const;

/**
 * Load the user's history + pattern catalog and pick this month's set.
 * Seeded by calendar month so reloads don't reshuffle the new problems.
 */
export async function buildMonthlyMockSet(userId: string, now: Date = new Date()): Promise<MockProblem[]> {
  const windowStart = new Date(now.getTime() - STRUGGLE_WINDOW_DAYS * DAY_MS);
  const recentCutoff = now.getTime() - RECENT_REVIEW_DAYS * DAY_MS;

  const [entries, patterns] = await Promise.all([
    prisma.entry.findMany({
      where: { userId },
      select: {
        id: true,
        status: true,
        firstSolvedAt: true,
        idea: true,
        mistake: true,
        customPattern: true,
        patternOverride: true,
        reviewCard: true,
        problem: { select: { ...catalogSelect, patterns: { select: { pattern: { select: { name: true } } } } } },
        attempts: { where: { at: { gte: windowStart }, source: { not: "IMPORT" } }, select: { rating: true, usedHint: true, at: true } },
      },
    }),
    prisma.pattern.findMany({
      select: { name: true, family: true, problems: { select: { problem: { select: catalogSelect } } } },
    }),
  ]);

  const known = patterns.map((p) => p.name);
  const facts: LoggedFact[] = entries.map((e) => {
    const sheet = e.problem.patterns.map((pp) => pp.pattern.name);
    const raw = e.customPattern ? [e.customPattern] : e.patternOverride.length > 0 ? e.patternOverride : sheet;
    const loggedThisMonth = e.firstSolvedAt >= windowStart;
    const struggle =
      e.attempts.reduce((s, a) => s + (a.rating === "AGAIN" ? 2 : 0) + (a.usedHint ? 1 : 0), 0) +
      (loggedThisMonth ? (e.status === "ATTEMPTED_FAILED" ? 2 : e.status === "SOLVED_WITH_HELP" ? 1 : 0) : 0);
    const lastTouched = Math.max(e.firstSolvedAt.getTime(), e.reviewCard?.lastReview?.getTime() ?? 0);
    const { patterns: _p, ...problem } = e.problem;
    return {
      entryId: e.id,
      problem,
      patterns: Array.from(new Set(normalizePatternList(raw).map((n) => canonicalPattern(n, known)))),
      struggle,
      retrievability: e.reviewCard ? calculateRetrievability(e.reviewCard as unknown as ReviewCardData, now) : 0.5,
      recentlyTouched: lastTouched >= recentCutoff,
      idea: e.idea,
      mistake: e.mistake,
    };
  });

  const pools: PatternPool[] = patterns.map((p) => ({
    name: p.name,
    family: p.family,
    problems: p.problems.map((pp) => pp.problem),
  }));

  return pickMonthlyMockSet(facts, pools, `${userId}:${now.toISOString().slice(0, 7)}`);
}
