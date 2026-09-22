/**
 * Canonical pattern taxonomy exposed to the LLM prompt below.
 * Keep in sync with data/patterns.csv — mismatches become "Imported" family patterns
 * (still usable, but not part of the roadmap taxonomy).
 */
export const CANONICAL_PATTERNS = [
  "Basics",
  "Two Pointer",
  "Fast and Slow Pointer",
  "Sliding Window",
  "Merge Intervals",
  "Prefix Sum",
  "Kadane's Pattern",
  "In-place Reversal of LinkedList",
  "Dummy Node",
  "Stack",
  "HashMap",
  "Heap",
  "Binary Search",
  "Backtracking",
  "BFS",
  "DFS",
  "Topological Sort",
  "Dynamic Programming",
  "Greedy",
  "Trie",
  "Union Find",
  "Bit Manipulation",
  "Matrix Traversal",
  "Monotonic Stack",
  "Intervals",
] as const;

export const CSV_HEADER = "Problem Name,Problem Link,Pattern,Idea,Solved Date,Source";

export function buildLeetcodePrompt(): string {
  const patternList = CANONICAL_PATTERNS.map((p) => `  - ${p}`).join("\n");

  return `You are converting LeetCode "Solved Problems" screenshots into a CSV for import into a spaced-repetition tool.

INPUT
- One or more screenshots of a LeetCode /progress page. Each row on the page shows: problem number, problem title, difficulty, and (sometimes) a most-recent solved date.

OUTPUT
- A single CSV. Nothing else. No prose before or after. No code fences.
- First line MUST be exactly this header:
${CSV_HEADER}
- One row per solved problem. Do NOT invent problems that are not visible in the screenshots.

COLUMN RULES
1. "Problem Name": format as "<number>. <official title>" e.g. "1. Two Sum". Number MUST match what the screenshot shows.
2. "Problem Link": the canonical URL "https://leetcode.com/problems/<slug>/". Derive the slug from the official title (lowercase, spaces → hyphens, drop punctuation). Do not guess if you are unsure of the title — omit the row instead.
3. "Pattern": pick EXACTLY ONE value from this whitelist based on the standard, best-known solution to the problem. Do not invent new pattern names. Do not leave blank:
${patternList}
4. "Idea": one short sentence (max 200 chars) describing the core algorithmic idea used to solve it — the kind of hint you'd give yourself before re-solving. No code.
5. "Solved Date": the most recent solved date visible next to the problem on the /progress page, formatted strictly as YYYY-MM-DD. If a date is not shown for that row, leave blank.
6. "Source": always the literal string "leetcode-progress-import".

FORMAT
- Comma-separated. Quote any field that contains a comma, quote, or newline (RFC 4180). Escape internal quotes by doubling them.
- No trailing empty rows. No commentary.

Begin now. Output only the CSV.`;
}
