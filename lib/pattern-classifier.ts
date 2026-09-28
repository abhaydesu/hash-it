/**
 * Assigns each LeetCode problem exactly one primary pattern from its topic tags.
 *
 * LeetCode tags are unordered and overlapping (most problems carry "Array"), so
 * "has tag X" wildly over-counts generic patterns. Instead, rules run from most
 * specific to most generic and the first match wins: a problem tagged
 * DP + Array + Greedy is a DP problem, not an Array or Greedy one.
 */

interface Rule {
  pattern: string;
  matches: (tags: Set<string>, title: string) => boolean;
}

const has = (tags: Set<string>, ...wanted: string[]) => wanted.some((t) => tags.has(t));

const DP_TAGS = [
  "Dynamic Programming",
  "Memoization",
  "Knapsack Problem",
  "0-1 Knapsack",
  "Complete Knapsack",
  "Longest Increasing Subsequence",
  "Longest Common Subsequence",
  "DP on Trees",
];

const RULES: Rule[] = [
  { pattern: "Trie", matches: (t) => has(t, "Trie") },
  { pattern: "Union Find", matches: (t) => has(t, "Union-Find") },
  { pattern: "Topological Sort", matches: (t) => has(t, "Topological Sort") },
  { pattern: "Monotonic Stack", matches: (t) => has(t, "Monotonic Stack", "Monotonic Queue") },
  { pattern: "Backtracking", matches: (t) => has(t, "Backtracking") },
  // Kadane's has no LeetCode tag; it's the "best subarray" corner of DP.
  {
    pattern: "Kadane's Pattern",
    matches: (t, title) => has(t, ...DP_TAGS) && /\bmax(imum)?\b.*\bsubarray\b/i.test(title),
  },
  { pattern: "Dynamic Programming", matches: (t) => has(t, ...DP_TAGS) },
  { pattern: "Merge Intervals", matches: (t, title) => has(t, "Sweep Line", "Line Sweep") || /\bintervals?\b/i.test(title) },
  { pattern: "Sliding Window", matches: (t) => has(t, "Sliding Window") },
  {
    pattern: "Fast and Slow Pointer",
    matches: (t) => has(t, "Floyd's Cycle Finding Algorithm") || (has(t, "Linked List") && has(t, "Two Pointers")),
  },
  {
    pattern: "In-place Reversal of LinkedList",
    matches: (t, title) => has(t, "Linked List", "Doubly-Linked List") && /\brevers/i.test(title),
  },
  { pattern: "Dummy Node", matches: (t) => has(t, "Linked List", "Doubly-Linked List") },
  { pattern: "Heap", matches: (t) => has(t, "Heap (Priority Queue)") },
  { pattern: "Binary Search", matches: (t) => has(t, "Binary Search") },
  { pattern: "Prefix Sum", matches: (t) => has(t, "Prefix Sum") },
  { pattern: "Two Pointer", matches: (t) => has(t, "Two Pointers") },
  { pattern: "BFS", matches: (t) => has(t, "Breadth-First Search", "Shortest Path", "Dijkstra's Algorithm") },
  {
    pattern: "DFS",
    matches: (t) => has(t, "Depth-First Search", "Tree", "Binary Tree", "Binary Search Tree", "Graph Theory"),
  },
  { pattern: "Matrix Traversal", matches: (t) => has(t, "Matrix") },
  { pattern: "Greedy", matches: (t) => has(t, "Greedy") },
  { pattern: "Bit Manipulation", matches: (t) => has(t, "Bit Manipulation", "Bitmask") },
  { pattern: "Stack", matches: (t) => has(t, "Stack") },
  { pattern: "HashMap", matches: (t) => has(t, "Hash Table", "Counting", "Hash Function") },
  {
    pattern: "Basics",
    matches: (t) => has(t, "Array", "String", "Sorting", "Math", "Simulation", "Enumeration"),
  },
];

/** Tags that mean "not a DSA problem" — never assigned a pattern. */
const EXCLUDED_TAGS = ["Database", "Shell", "Concurrency"];

/** Every pattern name the classifier can return, in rule order. */
export const CLASSIFIED_PATTERNS = RULES.map((r) => r.pattern);

export function primaryPattern(topicTags: string[], title: string): string | null {
  const tags = new Set(topicTags);
  if (has(tags, ...EXCLUDED_TAGS)) return null;
  return RULES.find((r) => r.matches(tags, title))?.pattern ?? null;
}
