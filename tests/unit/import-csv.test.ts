import { describe, it, expect } from "vitest";
import Papa from "papaparse";
import {
  parseSlugFromUrl,
  parseLeadingNumber,
  mapRawStatus,
  mapRawRevisit,
  mergeTwoRows,
  parseSolvedDate,
  sanitizeCsvText,
  DryRunRow,
} from "@/lib/import-utils";
import { mapGfgDifficulty } from "@/lib/gfg-metadata";
import { SolveStatus } from "@prisma/client";

describe("CSV Solved-Sheet Import - Robustness & Note Preservation", () => {
  it("correctly parses complex CSV cells with commas, quotes, and multiline newlines", () => {
    const csvContent = `Problem Name,Problem Link,Topic,Pattern,Idea,What I did wrong,Status,Revisit?,Source
"26. Remove Duplicates from Array",https://leetcode.com/problems/remove-duplicates-from-sorted-array/description/,Arrays,Two Pointer,"one pointer stays at place where unique elements need to be assigned, the other pointer traverses.
Line 2 of intuition.","i did not store unique elements separately, was returning value of i",Solved (with help),No,Patterns Sheet
"209. Minimum Size Subarray Sum",https://leetcode.com/problems/minimum-size-subarray-sum/description/,Arrays,Sliding Window,"classic sliding window, keep shrinking window",,Solved (No help),Yes,Patterns Sheet
`;

    const parsed = Papa.parse<Record<string, string>>(csvContent, {
      header: true,
      skipEmptyLines: "greedy",
      dynamicTyping: false,
    });

    expect(parsed.data).toHaveLength(2);

    const row1 = parsed.data[0];
    expect(row1["Problem Name"]).toBe("26. Remove Duplicates from Array");
    expect(row1["Idea"]).toContain("Line 2 of intuition.");
    expect(row1["Idea"]).toContain("the other pointer traverses.");
    expect(row1["What I did wrong"]).toBe("i did not store unique elements separately, was returning value of i");
    expect(row1["Status"]).toBe("Solved (with help)");
    expect(row1["Revisit?"]).toBe("No");
    expect(row1["Source"]).toBe("Patterns Sheet");
  });

  it("extracts exact slugs from LeetCode and GeeksForGeeks URLs without getting tricked by /description/ or /1", () => {
    // LeetCode URLs
    expect(parseSlugFromUrl("https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/description/")).toBe(
      "two-sum-ii-input-array-is-sorted"
    );
    expect(parseSlugFromUrl("https://leetcode.com/problems/remove-duplicates-from-sorted-array-ii/submissions/2088160257/")).toBe(
      "remove-duplicates-from-sorted-array-ii"
    );
    expect(parseSlugFromUrl("https://leetcode.com/problems/squares-of-a-sorted-array/")).toBe(
      "squares-of-a-sorted-array"
    );

    // GeeksForGeeks URLs
    expect(parseSlugFromUrl("https://www.geeksforgeeks.org/problems/count-total-digits-in-a-number/1")).toBe(
      "count-total-digits-in-a-number"
    );
    expect(parseSlugFromUrl("https://www.geeksforgeeks.org/problems/gcd-of-two-numbers3459/1")).toBe(
      "gcd-of-two-numbers3459"
    );
    expect(parseSlugFromUrl("http://geeksforgeeks.org/problems/count-triplets-with-sum-smaller-than-x5549/1")).toBe(
      "count-triplets-with-sum-smaller-than-x5549"
    );
  });

  it("maps GFG difficulty labels into app difficulty enums", () => {
    expect(mapGfgDifficulty("Easy")).toBe("EASY");
    expect(mapGfgDifficulty("basic")).toBe("EASY");
    expect(mapGfgDifficulty("School")).toBe("EASY");
    expect(mapGfgDifficulty("Medium")).toBe("MEDIUM");
    expect(mapGfgDifficulty("Hard")).toBe("HARD");
    expect(mapGfgDifficulty("unknown")).toBeNull();
  });

  it("parses leading problem numbers accurately", () => {
    expect(parseLeadingNumber("167. Two sum II")).toBe(167);
    expect(parseLeadingNumber("26. Remove Duplicates from Array")).toBe(26);
    expect(parseLeadingNumber("80. Remove Duplicatr from Sorted Array II")).toBe(80);
    expect(parseLeadingNumber("1337. The K Weakest Rows in a Matrix")).toBe(1337);
    expect(parseLeadingNumber("Count Digits in a Number")).toBeNull();
    expect(parseLeadingNumber("Smallest Subarray with a given sum")).toBeNull();
  });

  it("maps solve status and revisit flags reliably", () => {
    expect(mapRawStatus("Solved (No help)")).toBe(SolveStatus.SOLVED_UNAIDED);
    expect(mapRawStatus("Solved (with help)")).toBe(SolveStatus.SOLVED_WITH_HELP);
    expect(mapRawStatus("Attempted Failed")).toBe(SolveStatus.ATTEMPTED_FAILED);

    expect(mapRawRevisit("Yes")).toBe(true);
    expect(mapRawRevisit("yes")).toBe(true);
    expect(mapRawRevisit("Y")).toBe(true);
    expect(mapRawRevisit("No")).toBe(false);
    expect(mapRawRevisit(undefined)).toBe(false);
  });

  it("merges two conflicting duplicate rows without losing notes from either row", () => {
    const rowA: DryRunRow = {
      rowIndex: 20,
      rawName: "Smallest Subarray with a given sum",
      rawLink: "https://leetcode.com/problems/minimum-size-subarray-sum/submissions/2100530726/",
      rawTopic: "Arrays",
      rawPattern: "Sliding Window",
      rawIdea: "Analogy by Pratyush: company hires people till work starts, then fires until work is happening.",
      rawMistake: undefined,
      rawStatus: "Solved (with help)",
      rawRevisit: "No",
      rawSource: "Patterns Sheet",
      parsedStatus: SolveStatus.SOLVED_WITH_HELP,
      parsedRevisit: false,
      needsConfirmation: false,
    };

    const rowB: DryRunRow = {
      rowIndex: 26,
      rawName: "209. Minimum Size Subarray Sum",
      rawLink: "https://leetcode.com/problems/minimum-size-subarray-sum/description/",
      rawTopic: "Arrays",
      rawPattern: "Sliding Window",
      rawIdea: "Classic variable sliding window template with low and high pointers.",
      rawMistake: "Forgot to reset sum when shrinking beyond high",
      rawStatus: "Solved (No help)",
      rawRevisit: "Yes",
      rawSource: "Patterns Sheet",
      parsedStatus: SolveStatus.SOLVED_UNAIDED,
      parsedRevisit: true,
      needsConfirmation: false,
    };

    const merged = mergeTwoRows(rowA, rowB);

    // Verify both ideas are preserved
    expect(merged.rawIdea).toContain("Analogy by Pratyush");
    expect(merged.rawIdea).toContain("Classic variable sliding window template");
    expect(merged.rawIdea).toContain("[Note from Row 26]");

    // Verify mistake from row B is preserved
    expect(merged.rawMistake).toContain("Forgot to reset sum when shrinking beyond high");

    // Verify revisit flag is combined (true if either was true)
    expect(merged.parsedRevisit).toBe(true);

    // Verify status prioritizes help needed if logged
    expect(merged.parsedStatus).toBe(SolveStatus.SOLVED_WITH_HELP);

    // Verify row is cleared of duplicate flags
    expect(merged.isDuplicateInCSV).toBe(false);
  });
});

describe("parseSolvedDate", () => {
  const now = new Date("2026-09-22T00:00:00Z");

  it("parses ISO YYYY-MM-DD as UTC", () => {
    const d = parseSolvedDate("2025-03-14", now);
    expect(d?.toISOString()).toBe("2025-03-14T00:00:00.000Z");
  });

  it("parses full ISO timestamps by taking the date portion", () => {
    const d = parseSolvedDate("2024-11-05T14:22:00Z", now);
    expect(d?.toISOString()).toBe("2024-11-05T00:00:00.000Z");
  });

  it("accepts MM/DD/YYYY (LeetCode display default)", () => {
    const d = parseSolvedDate("03/14/2025", now);
    expect(d?.toISOString()).toBe("2025-03-14T00:00:00.000Z");
  });

  it("auto-swaps to DD/MM/YYYY when the first field can't be a month", () => {
    const d = parseSolvedDate("31/12/2024", now);
    expect(d?.toISOString()).toBe("2024-12-31T00:00:00.000Z");
  });

  it("returns undefined for empty, blank, or nonsense", () => {
    expect(parseSolvedDate(undefined, now)).toBeUndefined();
    expect(parseSolvedDate("", now)).toBeUndefined();
    expect(parseSolvedDate("   ", now)).toBeUndefined();
    expect(parseSolvedDate("last tuesday", now)).toBeUndefined();
  });

  it("rejects impossible calendar dates like Feb 31", () => {
    expect(parseSolvedDate("2025-02-31", now)).toBeUndefined();
  });

  it("rejects clearly-future dates", () => {
    expect(parseSolvedDate("2099-01-01", now)).toBeUndefined();
  });

  it("rejects dates before LeetCode existed", () => {
    expect(parseSolvedDate("2010-06-01", now)).toBeUndefined();
  });
});

describe("sanitizeCsvText", () => {
  it("returns input unchanged when there are no artefacts", () => {
    const csv = 'Problem Name,Problem Link,Pattern,Idea,Solved Date,Source\n"1. Two Sum",https://leetcode.com/problems/two-sum/,HashMap,"Hash for complement",2026-08-27,leetcode-progress-import\n';
    const { cleaned, artefactCount } = sanitizeCsvText(csv);
    expect(cleaned).toBe(csv);
    expect(artefactCount).toBe(0);
  });

  it("strips markdown link wrappers around URLs (Gemini grounding shape)", () => {
    const row =
      "130. Surrounded Regions,[https://leetcode.com/problems/surrounded-regions/,BFS,Traverse](https://www.google.com/search?q=https://leetcode.com/problems/surrounded-regions/,BFS,Traverse&utm_source=gemini) from boundary Os to mark connected non-surrounded regions.,2026-09-17,leetcode-progress-import";
    const { cleaned, artefactCount } = sanitizeCsvText(row);
    expect(artefactCount).toBeGreaterThan(0);
    expect(cleaned).not.toContain("](https://");
    expect(cleaned).not.toContain("utm_source=gemini");
    // After unwrap, the row parses to 6 columns aligned with the header.
    const parsed = Papa.parse<string[]>(cleaned, { header: false });
    expect(parsed.data[0]).toEqual([
      "130. Surrounded Regions",
      "https://leetcode.com/problems/surrounded-regions/",
      "BFS",
      "Traverse from boundary Os to mark connected non-surrounded regions.",
      "2026-09-17",
      "leetcode-progress-import",
    ]);
  });

  it("strips surrounding triple-backtick code fences", () => {
    const csv = "```csv\nProblem Name,Problem Link\n\"1. Two Sum\",https://leetcode.com/problems/two-sum/\n```";
    const { cleaned, artefactCount } = sanitizeCsvText(csv);
    expect(cleaned.startsWith("Problem Name")).toBe(true);
    expect(cleaned).not.toContain("```");
    expect(artefactCount).toBeGreaterThan(0);
  });

  it("strips citation footnotes like [1] and [source]", () => {
    const csv = 'Problem Name,Idea\n"1. Two Sum","Hash for complement [1][source]"';
    const { cleaned, artefactCount } = sanitizeCsvText(csv);
    expect(cleaned).not.toContain("[1]");
    expect(cleaned).not.toContain("[source]");
    expect(artefactCount).toBeGreaterThan(0);
  });

  it("leaves non-link bracketed text (e.g. `[key, val]` inside Idea) alone", () => {
    const csv = 'Problem Name,Idea\n"98. Validate BST","Pass valid range limits [min, max] down"';
    const { cleaned, artefactCount } = sanitizeCsvText(csv);
    expect(cleaned).toContain("[min, max]");
    expect(artefactCount).toBe(0);
  });

  it("strips a leading BOM", () => {
    const csv = "﻿Problem Name\n\"1. Two Sum\"";
    const { cleaned } = sanitizeCsvText(csv);
    expect(cleaned.charCodeAt(0)).not.toBe(0xfeff);
  });

  it("handles empty / missing input safely", () => {
    expect(sanitizeCsvText("").cleaned).toBe("");
    // @ts-expect-error - guarding non-string
    expect(sanitizeCsvText(undefined).cleaned).toBe("");
  });
});
