import { describe, expect, it } from "vitest";
import { packPatternGrid } from "@/lib/practice-grid";

const PATTERNS = [
  "Basics", "Two Pointer", "Fast and Slow Pointer", "Sliding Window", "Merge Intervals", "Prefix Sum",
  "Kadane's Pattern", "In-place Reversal of LinkedList", "Dummy Node", "Stack", "HashMap", "Heap",
  "Binary Search", "Backtracking", "BFS", "DFS", "Topological Sort", "Dynamic Programming", "Greedy",
  "Trie", "Union Find", "Bit Manipulation", "Matrix Traversal", "Monotonic Stack",
];

/** Splits packed tiles into 5-wide rows; throws if a tile would straddle a row. */
function rows(tiles: ReturnType<typeof packPatternGrid<{ name: string }>>) {
  const out: string[][] = [];
  let row: string[] = [];
  let used = 0;
  for (const t of tiles) {
    used += t.lgSpan;
    if (used > 5) throw new Error(`row overflow at ${t.pattern.name}`);
    row.push(`${t.pattern.name}${t.lgSpan > 1 ? ` ×${t.lgSpan}` : ""}`);
    if (used === 5) {
      out.push(row);
      row = [];
      used = 0;
    }
  }
  if (row.length > 0) throw new Error(`incomplete last row: ${row.join(", ")}`);
  return out;
}

describe("packPatternGrid", () => {
  it("fills every 5-column row with no gaps", () => {
    const packed = packPatternGrid(PATTERNS.map((name) => ({ name })));
    const layout = rows(packed);
    console.log(layout.map((r) => r.join(" | ")).join("\n"));
    expect(packed).toHaveLength(PATTERNS.length);
  });

  it("stays full for any number of tiles", () => {
    for (let n = 1; n <= PATTERNS.length; n++) {
      expect(() => rows(packPatternGrid(PATTERNS.slice(0, n).map((name) => ({ name }))))).not.toThrow();
    }
  });
});
