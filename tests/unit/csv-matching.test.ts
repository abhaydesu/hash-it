import { describe, it, expect } from "vitest";
import Papa from "papaparse";
import {
  parseLeadingNumber,
  mapRawStatus,
  mapRawRevisit,
  mergeTwoRows,
  type DryRunRow,
} from "@/lib/import-utils";
import {
  parseSlugFromUrl,
  normalizeProblemUrl,
  problemUrlLookupKeys,
  titleFromProblemUrl,
} from "@/lib/problem-url";
import { SolveStatus } from "@prisma/client";

describe("CSV matching and parsing unit tests", () => {
  describe("Slug extraction from URLs (Tier 1)", () => {
    it("extracts LeetCode slugs correctly across various URL patterns", () => {
      expect(parseSlugFromUrl("https://leetcode.com/problems/two-sum/")).toBe("two-sum");
      expect(parseSlugFromUrl("https://leetcode.com/problems/two-sum/description/")).toBe("two-sum");
      expect(parseSlugFromUrl("https://leetcode.com/problems/two-sum/submissions/")).toBe("two-sum");
      expect(parseSlugFromUrl("https://leetcode.com/problems/two-sum/editorial/")).toBe("two-sum");
      expect(parseSlugFromUrl("https://leetcode.com/problems/two-sum")).toBe("two-sum");
      expect(parseSlugFromUrl("leetcode.com/problems/3sum/")).toBe("3sum");
    });

    it("extracts GeeksForGeeks slugs without getting tricked by /1", () => {
      expect(parseSlugFromUrl("https://www.geeksforgeeks.org/problems/reverse-a-linked-list/1")).toBe("reverse-a-linked-list");
      expect(parseSlugFromUrl("https://practice.geeksforgeeks.org/problems/subarray-with-given-sum-1587115621/1")).toBe("subarray-with-given-sum-1587115621");
    });

    it("handles malformed or empty URLs safely", () => {
      expect(parseSlugFromUrl("")).toBeNull();
      expect(parseSlugFromUrl("   ")).toBeNull();
      expect(parseSlugFromUrl("https://example.com/")).toBeNull();
    });
  });

  describe("Leading integer extraction (Tier 2)", () => {
    it("parses leading problem number from title across formats", () => {
      expect(parseLeadingNumber("1. Two Sum")).toBe(1);
      expect(parseLeadingNumber("042. Trapping Rain Water")).toBe(42);
      expect(parseLeadingNumber("200 - Number of Islands")).toBe(200);
      expect(parseLeadingNumber("15 3Sum")).toBe(15);
    });

    it("returns null when no leading number exists", () => {
      expect(parseLeadingNumber("Two Sum")).toBeNull();
      expect(parseLeadingNumber("Problem 1: Two Sum")).toBeNull();
      expect(parseLeadingNumber("")).toBeNull();
    });
  });

  describe("Tiering and Fallthrough Order", () => {
    // Model catalog problem sets for testing the tiering resolution
    const mockCatalog = [
      { id: "p1", platform: "LEETCODE", slug: "two-sum", number: 1, title: "Two Sum" },
      { id: "p2", platform: "LEETCODE", slug: "add-two-numbers", number: 2, title: "Add Two Numbers" },
      { id: "p3", platform: "LEETCODE", slug: "custom-slug-3", number: 3, title: "Old Title Three" },
      { id: "p4", platform: "LEETCODE", slug: "four-sum", number: 18, title: "4Sum" },
    ];

    function matchProblem(rawLink: string, rawName: string) {
      let matchedProblem: any = null;
      let matchMethod: DryRunRow["matchMethod"] = undefined;

      // Tier 1: Slug match
      const slug = parseSlugFromUrl(rawLink);
      if (slug) {
        matchedProblem = mockCatalog.find((p) => p.slug === slug);
        if (matchedProblem) matchMethod = "SLUG";
      }

      // Tier 2: Leading integer match
      if (!matchedProblem) {
        const leadingNum = parseLeadingNumber(rawName);
        if (leadingNum != null) {
          matchedProblem = mockCatalog.find((p) => p.number === leadingNum);
          if (matchedProblem) matchMethod = "NUMBER";
        }
      }

      // Tier 3: Case-insensitive exact title match
      if (!matchedProblem && rawName) {
        const cleanTitle = rawName.replace(/^\d+[\.\s\-]+/, "").trim().toLowerCase();
        matchedProblem = mockCatalog.find(
          (p) => p.title.toLowerCase() === cleanTitle || p.title.toLowerCase() === rawName.toLowerCase()
        );
        if (matchedProblem) matchMethod = "TITLE_EXACT";
      }

      // Tier 4: Fallback
      if (!matchedProblem) {
        if (rawLink.includes("geeksforgeeks.org")) {
          matchMethod = "WILL_CREATE_GFG";
        } else {
          matchMethod = "WILL_CREATE_OTHER";
        }
      }

      return { matchedProblem, matchMethod };
    }

    it("Tier 1 matches on slug in isolation", () => {
      const { matchedProblem, matchMethod } = matchProblem("https://leetcode.com/problems/two-sum/", "Random Name");
      expect(matchMethod).toBe("SLUG");
      expect(matchedProblem?.id).toBe("p1");
    });

    it("Tier 2 matches on leading number in isolation when slug is missing/unmatched", () => {
      const { matchedProblem, matchMethod } = matchProblem("https://unknown.com/problem", "2. Unmatched Slug");
      expect(matchMethod).toBe("NUMBER");
      expect(matchedProblem?.id).toBe("p2");
    });

    it("Tier 3 matches on exact title in isolation when slug and number are missing/unmatched", () => {
      const { matchedProblem, matchMethod } = matchProblem("", "4Sum");
      expect(matchMethod).toBe("TITLE_EXACT");
      expect(matchedProblem?.id).toBe("p4");
    });

    it("Tier 4 falls back to WILL_CREATE_GFG for GFG urls", () => {
      const { matchedProblem, matchMethod } = matchProblem("https://geeksforgeeks.org/problems/unmatched/1", "Unmatched Problem");
      expect(matchedProblem).toBeUndefined();
      expect(matchMethod).toBe("WILL_CREATE_GFG");
    });

    it("Tier 4 falls back to WILL_CREATE_OTHER for other urls", () => {
      const { matchedProblem, matchMethod } = matchProblem("https://codeforces.com/problem/123", "Codeforces 123");
      expect(matchedProblem).toBeUndefined();
      expect(matchMethod).toBe("WILL_CREATE_OTHER");
    });

    it("Tier 1 takes precedence over Tier 2 when both could match different problems", () => {
      // Slug points to p1 (two-sum, #1), but title has "2. Two Sum" which would match #2
      const { matchedProblem, matchMethod } = matchProblem("https://leetcode.com/problems/two-sum/", "2. Two Sum");
      expect(matchMethod).toBe("SLUG");
      expect(matchedProblem?.id).toBe("p1");
    });

    it("Tier 2 takes precedence over Tier 3 when both could match different problems", () => {
      // Leading number is 2 (matches p2), but title is "2. 4Sum" where 4Sum is p4
      const { matchedProblem, matchMethod } = matchProblem("", "2. 4Sum");
      expect(matchMethod).toBe("NUMBER");
      expect(matchedProblem?.id).toBe("p2");
    });
  });

  describe("Status and Revisit Mapping", () => {
    it("maps raw status variants accurately", () => {
      expect(mapRawStatus("Solved Unaided")).toBe(SolveStatus.SOLVED_UNAIDED);
      expect(mapRawStatus("no help")).toBe(SolveStatus.SOLVED_UNAIDED);
      expect(mapRawStatus("Solved with Help")).toBe(SolveStatus.SOLVED_WITH_HELP);
      expect(mapRawStatus("needed a hint")).toBe(SolveStatus.SOLVED_WITH_HELP);
      expect(mapRawStatus("Attempted/Failed")).toBe(SolveStatus.ATTEMPTED_FAILED);
      expect(mapRawStatus("wrong answer")).toBe(SolveStatus.ATTEMPTED_FAILED);
      expect(mapRawStatus("")).toBe(SolveStatus.SOLVED_UNAIDED);
      expect(mapRawStatus(undefined)).toBe(SolveStatus.SOLVED_UNAIDED);
    });

    it("maps revisit flags accurately", () => {
      expect(mapRawRevisit("Yes")).toBe(true);
      expect(mapRawRevisit("yes")).toBe(true);
      expect(mapRawRevisit("Y")).toBe(true);
      expect(mapRawRevisit("true")).toBe(true);
      expect(mapRawRevisit("1")).toBe(true);
      expect(mapRawRevisit("No")).toBe(false);
      expect(mapRawRevisit("")).toBe(false);
      expect(mapRawRevisit(undefined)).toBe(false);
    });
  });

  describe("mergeTwoRows", () => {
    it("merges distinct ideas, mistakes, and keeps highest struggle status", () => {
      const rowA: DryRunRow = {
        rowIndex: 1,
        rawName: "Two Sum",
        rawLink: "https://leetcode.com/problems/two-sum/",
        rawIdea: "Use hash map for complement lookup",
        rawMistake: "Off-by-one index",
        parsedStatus: SolveStatus.SOLVED_UNAIDED,
        parsedRevisit: false,
        needsConfirmation: false,
      };

      const rowB: DryRunRow = {
        rowIndex: 2,
        rawName: "Two Sum",
        rawLink: "https://leetcode.com/problems/two-sum/",
        rawIdea: "Sort and use two pointers",
        rawMistake: "Did not handle negative values",
        parsedStatus: SolveStatus.SOLVED_WITH_HELP,
        parsedRevisit: true,
        needsConfirmation: false,
      };

      const merged = mergeTwoRows(rowA, rowB);

      // Notes merged without data loss
      expect(merged.rawIdea).toContain("Use hash map");
      expect(merged.rawIdea).toContain("Sort and use two pointers");
      expect(merged.rawMistake).toContain("Off-by-one index");
      expect(merged.rawMistake).toContain("Did not handle negative values");

      // Status elevates to more struggling status
      expect(merged.parsedStatus).toBe(SolveStatus.SOLVED_WITH_HELP);
      // Revisit flag is OR'd
      expect(merged.parsedRevisit).toBe(true);
    });

    it("does not duplicate notes if identical", () => {
      const rowA: DryRunRow = {
        rowIndex: 1,
        rawName: "Two Sum",
        rawLink: "https://leetcode.com/problems/two-sum/",
        rawIdea: "Identical Idea",
        rawMistake: "Identical Mistake",
        parsedStatus: SolveStatus.SOLVED_UNAIDED,
        parsedRevisit: false,
        needsConfirmation: false,
      };

      const rowB: DryRunRow = {
        rowIndex: 2,
        rawName: "Two Sum",
        rawLink: "https://leetcode.com/problems/two-sum/",
        rawIdea: "Identical Idea",
        rawMistake: "Identical Mistake",
        parsedStatus: SolveStatus.SOLVED_UNAIDED,
        parsedRevisit: false,
        needsConfirmation: false,
      };

      const merged = mergeTwoRows(rowA, rowB);
      expect(merged.rawIdea).toBe("Identical Idea");
      expect(merged.rawMistake).toBe("Identical Mistake");
    });
  });

  describe("PapaParse CSV parser robust compliance", () => {
    it("handles RFC 4180 quotes, escaped quotes, and newlines in cells", () => {
      const csv = `Problem,Notes,Status\n"Two Sum","Line 1\nLine 2 with ""quotes"" and , commas",Solved`;
      const parsed = Papa.parse<{ Problem: string; Notes: string; Status: string }>(csv, {
        header: true,
        skipEmptyLines: true,
      });

      expect(parsed.data).toHaveLength(1);
      expect(parsed.data[0].Problem).toBe("Two Sum");
      expect(parsed.data[0].Notes).toBe('Line 1\nLine 2 with "quotes" and , commas');
      expect(parsed.data[0].Status).toBe("Solved");
    });
  });
});
