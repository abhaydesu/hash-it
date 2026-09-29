/** Matching helpers for the pattern-tag picker: forgiving about case, spacing, punctuation and typos. */

/** "Two-Pointers", "two pointers" and "twopointers" all collapse to the same key. */
export function patternMatchKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Lower is better; null means "not a match". */
function score(query: string, candidate: string): number | null {
  if (candidate === query) return 0;
  if (candidate.startsWith(query)) return 1;
  if (candidate.includes(query)) return 2;
  // Typos: compare against the whole name and against its prefix of the same length (partial typing).
  const max = query.length <= 4 ? 1 : 2;
  if (query.length < 3) return null;
  const whole = editDistance(query, candidate, max);
  const prefix = editDistance(query, candidate.slice(0, query.length), max);
  const d = Math.min(whole, prefix);
  return d <= max ? 2 + d : null;
}

/**
 * Best existing patterns for what the user has typed, skipping ones already chosen.
 * `known` should be ordered by preference (e.g. most used first) — ties keep that order.
 */
export function suggestPatterns(query: string, known: string[], selected: string[] = [], limit = 6): string[] {
  const q = patternMatchKey(query);
  if (!q) return [];
  const taken = new Set(selected.map(patternMatchKey));
  const scored: { name: string; s: number; i: number }[] = [];
  known.forEach((name, i) => {
    const key = patternMatchKey(name);
    if (!key || taken.has(key)) return;
    const s = score(q, key);
    if (s !== null) scored.push({ name, s, i });
  });
  scored.sort((a, b) => a.s - b.s || a.i - b.i);
  return scored.slice(0, limit).map((x) => x.name);
}

/** If `raw` is just a different spelling of a known pattern, return the known one. */
export function canonicalPattern(raw: string, known: string[]): string {
  const key = patternMatchKey(raw);
  if (!key) return raw;
  return known.find((k) => patternMatchKey(k) === key) ?? raw;
}
