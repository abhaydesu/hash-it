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

BEFORE YOU START
- Disable any web search, grounding, browsing, or citations feature you have on. This response must be plain CSV text, nothing else.
- Do NOT wrap URLs or any text in markdown links "[label](url)".
- Do NOT append citation markers such as [1], [source], (source), or utm_source= query parameters.
- Do NOT add code fences (\`\`\`). Do NOT add prose before or after the CSV. Do NOT add a summary row.

OUTPUT
- A single CSV. Nothing else.
- First line MUST be exactly this header, character for character:
${CSV_HEADER}
- One row per solved problem. Do NOT invent problems that are not visible in the screenshots.

COLUMN RULES
1. "Problem Name": format as "<official LeetCode problem number>. <official title>" e.g. "1. Two Sum" or "1512. Number of Good Pairs". The number MUST be the LeetCode problem number (as it appears on leetcode.com/problems/<slug>), NOT the position of the row in the screenshot. If you cannot identify the LeetCode number from the title, omit the row entirely.
2. "Problem Link": the canonical URL "https://leetcode.com/problems/<slug>/". Bare URL only — no brackets, no query parameters, no wrapping. Derive the slug from the official title (lowercase, spaces → hyphens, drop punctuation). Do not guess if you are unsure — omit the row instead.
3. "Pattern": pick EXACTLY ONE value from this whitelist based on the standard, best-known solution to the problem. Copy the value character-for-character — do not invent new pattern names, do not add prefixes or suffixes:
${patternList}
4. "Idea": one short sentence (max 200 chars) describing the core algorithmic idea used to solve it — the kind of hint you would give yourself before re-solving. No code. Avoid commas if possible.
5. "Solved Date": the most recent solved date visible next to the problem on the /progress page, formatted strictly as YYYY-MM-DD. If a date is not shown for that row, leave blank.
6. "Source": always the literal string "leetcode-progress-import".

CSV FORMAT (RFC 4180, strict)
- Wrap EVERY field in double quotes, always. Even fields that contain no commas or quotes. This is non-negotiable.
- Escape any internal double-quote character by doubling it: " becomes "".
- Comma between fields. Newline between rows. No trailing empty rows. No commentary.

Begin now. Output only the CSV.`;
}
