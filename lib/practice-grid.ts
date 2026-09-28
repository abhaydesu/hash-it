/** Layout for the Practice pattern grid (pure, so it can be unit-tested). */

const FEATURED_PATTERNS = new Set(["Dynamic Programming", "BFS", "DFS", "Backtracking"]);

export const LG_COLS = 5;

/**
 * Orders tiles for the 5-column layout so every row is full: a wide tile that
 * doesn't fit pulls the next single-width tile forward, and any gap left in a
 * row is closed by widening that row's tiles.
 */
export function packPatternGrid<T extends { name: string }>(patterns: T[]): Array<{ pattern: T; lgSpan: number }> {
  const queue = patterns.map((pattern) => ({ pattern, lgSpan: FEATURED_PATTERNS.has(pattern.name) ? 2 : 1 }));
  const out: typeof queue = [];
  let row: typeof queue = [];
  let free = LG_COLS;

  const closeRow = () => {
    for (let i = 0; free > 0 && row.length > 0; i = (i + 1) % row.length, free--) {
      row[row.length - 1 - i].lgSpan++;
    }
    out.push(...row);
    row = [];
    free = LG_COLS;
  };

  while (queue.length > 0) {
    const idx = queue.findIndex((t) => t.lgSpan <= free);
    if (idx === -1) {
      closeRow();
      continue;
    }
    const [tile] = queue.splice(idx, 1);
    row.push(tile);
    free -= tile.lgSpan;
    if (free === 0) closeRow();
  }
  if (row.length > 0) closeRow();
  return out;
}

/** Span for the last tile so a single-width grid of `count` tiles has no hole. */
export function lastTileSpan(count: number, cols: number) {
  const rem = count % cols;
  return rem === 0 ? 1 : cols - rem + 1;
}
