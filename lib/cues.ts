export const PATTERN_TRIGGER_CUES: Record<string, string> = {
  "Two Pointer": "Sorted array or list, find a pair/triplet with target sum or condition; palindrome verification; partitioned array swapping.",
  "Fast and Slow Pointer": "Cycle detection in linked list or array; finding middle element in one pass; finding cycle entry point.",
  "Sliding Window": "Contiguous subarray/substring satisfying a condition (min/max length, target sum, at most k distinct characters).",
  "Merge Intervals": "Overlapping intervals/ranges, calendar scheduling meetings, merging intersecting boundaries.",
  "Prefix Sum": "Range sum queries in O(1), subarray sum equals k, count of subarrays with given parity or modulo condition.",
  "Kadane's Pattern": "Maximum or minimum contiguous subarray sum in linear time O(n).",
  "In-place Reversal of LinkedList": "Reversing linked list nodes in groups of k or within a range [left, right] with O(1) extra space.",
  "Dummy Node": "Linked list head might be modified or removed, merging sorted lists, removing duplicates from list.",
  "Monotonic Stack": "Next greater/smaller element, daily temperatures, largest rectangle in histogram, trapping rain water.",
  "Stack": "Nested/matching brackets, expression evaluation (RPN), undo operations, simulating recursion.",
  "HashMap": "O(1) lookup of complement, frequency frequency counting, anagram grouping, caching visited states.",
  "Heap": "Top K frequent elements, K-th largest/smallest, streaming median, merge K sorted lists.",
  "Binary Search": "Sorted sequence or monotonic decision predicate f(x) -> boolean, search on answer space (min capacity/speed).",
  "Backtracking": "Generate all permutations, combinations, subsets, constraint satisfaction (Sudoku, N-Queens).",
  "BFS": "Shortest path in unweighted graph or 2D grid, level-order traversal, multi-source spreading (rotting oranges).",
  "DFS": "Exhaustive exploration, connected components/islands, path finding, tree traversals, cycle detection.",
  "Topological Sort": "Task dependencies, course prerequisites, ordering with precedence constraints in a DAG.",
  "Dynamic Programming": "Overlapping subproblems + optimal substructure, min cost path, maximum profit, count of ways, knapsack.",
  "Greedy": "Locally optimal choice leads to global optimum, activity selection, gas station, jump game.",
  "Trie": "Prefix lookups, word autocomplete, dictionary with wildcards, maximum XOR of two numbers.",
  "Union Find": "Dynamic disjoint set connectivity, connected components in undirected graphs, Kruskal's MST, redundant connection.",
  "Bit Manipulation": "Single number lookup without extra memory, counting set bits (Hamming weight), bitmask representation of subsets.",
  "Matrix Traversal": "2D grid traversal, spiral order, flood fill, word search in grid, boundary traversal.",
  "Intervals": "Insert interval, meeting rooms I & II, finding non-overlapping intervals, interval intersection.",
  "Basics": "Direct simulation, array manipulation, string transformations, math formulas.",
};

export function getPatternCue(patternName: string): string {
  return PATTERN_TRIGGER_CUES[patternName] || "Recognize problem structure, constraints, and invariants to choose optimal data structures.";
}
