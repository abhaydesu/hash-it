import { describe, it, expect } from "vitest";
import {
  formatMinutes,
  formatDifficulty,
  formatStatus,
  formatSolveStatus,
  safeHref,
  patternClayStyle,
  normalizePatternList,
  cn,
} from "@/lib/utils";
import { mapGfgDifficulty } from "@/lib/gfg-metadata";
import { isSafeCallbackPath, secretsEqual, storedHttpUrl } from "@/lib/safe";

describe("Formatters, Helpers & Safe Utilities Unit Tests", () => {
  describe("formatMinutes", () => {
    it("returns '-' when minutes is null or undefined", () => {
      expect(formatMinutes(null)).toBe("-");
      expect(formatMinutes(undefined)).toBe("-");
    });

    it("formats minutes under 1 hour as 'Xm'", () => {
      expect(formatMinutes(0)).toBe("0m");
      expect(formatMinutes(15)).toBe("15m");
      expect(formatMinutes(59)).toBe("59m");
    });

    it("formats exact hour multiples as 'Xh'", () => {
      expect(formatMinutes(60)).toBe("1h");
      expect(formatMinutes(120)).toBe("2h");
    });

    it("formats mixed hours and minutes as 'Xh Ym'", () => {
      expect(formatMinutes(65)).toBe("1h 5m");
      expect(formatMinutes(135)).toBe("2h 15m");
    });
  });

  describe("formatDifficulty", () => {
    it("formats EASY correctly", () => {
      const res = formatDifficulty("EASY");
      expect(res.label).toBe("Easy");
      expect(res.variant).toBe("easy");
    });

    it("formats MEDIUM correctly", () => {
      const res = formatDifficulty("MEDIUM");
      expect(res.label).toBe("Medium");
      expect(res.variant).toBe("medium");
    });

    it("formats HARD correctly", () => {
      const res = formatDifficulty("HARD");
      expect(res.label).toBe("Hard");
      expect(res.variant).toBe("hard");
    });

    it("formats null or unknown difficulty as Unknown", () => {
      expect(formatDifficulty(null).label).toBe("Unknown");
      expect(formatDifficulty("CUSTOM").label).toBe("Unknown");
    });
  });

  describe("formatStatus & formatSolveStatus", () => {
    it("formats unattempted/empty status as Unattempted", () => {
      expect(formatStatus(null).label).toBe("Unattempted");
      expect(formatStatus("").label).toBe("Unattempted");
    });

    it("formats SOLVED_UNAIDED as Unaided", () => {
      const res = formatStatus("SOLVED_UNAIDED");
      expect(res.label).toBe("Unaided");
      expect(res.variant).toBe("status-unaided");
    });

    it("formats SOLVED_WITH_HELP as With help", () => {
      const res = formatStatus("SOLVED_WITH_HELP");
      expect(res.label).toBe("With help");
      expect(res.variant).toBe("status-help");
    });

    it("formats ATTEMPTED_FAILED as Failed", () => {
      const res = formatStatus("ATTEMPTED_FAILED");
      expect(res.label).toBe("Failed");
      expect(res.variant).toBe("status-failed");
    });

    it("formats unknown status strings gracefully", () => {
      const res = formatStatus("IN_PROGRESS");
      expect(res.label).toBe("IN_PROGRESS");
      expect(res.variant).toBe("outline");
    });

    it("verifies formatSolveStatus alias works identically", () => {
      expect(formatSolveStatus("SOLVED_UNAIDED")).toEqual(formatStatus("SOLVED_UNAIDED"));
    });
  });

  describe("safeHref & storedHttpUrl", () => {
    it("returns undefined for empty, hash, or whitespace inputs", () => {
      expect(safeHref("")).toBeUndefined();
      expect(safeHref("   ")).toBeUndefined();
      expect(safeHref("#")).toBeUndefined();
      expect(safeHref(null)).toBeUndefined();
    });

    it("allows valid same-origin relative paths", () => {
      expect(safeHref("/problems")).toBe("/problems");
      expect(safeHref("/problems/two-sum")).toBe("/problems/two-sum");
    });

    it("rejects dangerous protocol-relative URLs", () => {
      expect(safeHref("//attacker.com")).toBeUndefined();
    });

    it("rejects backslash traversal attempts", () => {
      expect(safeHref("/\\attacker.com")).toBeUndefined();
    });

    it("rejects embedded schema tricks in relative paths", () => {
      expect(safeHref("/problems://test")).toBeUndefined();
    });

    it("allows valid http and https URLs", () => {
      expect(safeHref("https://leetcode.com/problems/two-sum/")).toBe("https://leetcode.com/problems/two-sum/");
      expect(safeHref("http://example.com/item")).toBe("http://example.com/item");
    });

    it("rejects javascript: or data: URIs", () => {
      expect(safeHref("javascript:alert(1)")).toBeUndefined();
      expect(safeHref("data:text/html,<script>alert(1)</script>")).toBeUndefined();
    });

    it("rejects excessively long URLs (>2000 chars)", () => {
      const longUrl = "https://example.com/" + "a".repeat(2005);
      expect(safeHref(longUrl)).toBeUndefined();
    });

    it("storedHttpUrl falls back to empty string", () => {
      expect(storedHttpUrl("javascript:alert(1)")).toBe("");
      expect(storedHttpUrl("https://leetcode.com")).toBe("https://leetcode.com/");
    });
  });

  describe("isSafeCallbackPath", () => {
    it("accepts safe relative paths", () => {
      expect(isSafeCallbackPath("/today")).toBe(true);
      expect(isSafeCallbackPath("/problems?page=1")).toBe(true);
    });

    it("rejects open redirects and dangerous characters", () => {
      expect(isSafeCallbackPath("//evil.com")).toBe(false);
      expect(isSafeCallbackPath("https://evil.com")).toBe(false);
      expect(isSafeCallbackPath("/path\\to\\somewhere")).toBe(false);
      expect(isSafeCallbackPath("javascript:alert(1)")).toBe(false);
    });
  });

  describe("secretsEqual (constant-time check)", () => {
    it("returns true for matching secrets", () => {
      expect(secretsEqual("secret-token-12345", "secret-token-12345")).toBe(true);
    });

    it("returns false for mismatched secrets of equal length", () => {
      expect(secretsEqual("secret-token-12344", "secret-token-12345")).toBe(false);
    });

    it("returns false for secrets of different lengths without throwing", () => {
      expect(secretsEqual("short", "secret-token-12345")).toBe(false);
    });

    it("returns false when provided secret is null or empty", () => {
      expect(secretsEqual(null, "secret-token-12345")).toBe(false);
      expect(secretsEqual("", "secret-token-12345")).toBe(false);
    });
  });

  describe("patternClayStyle & normalizePatternList", () => {
    it("returns predictable color swatches for known pattern slots", () => {
      const tp = patternClayStyle("Two Pointers");
      expect(tp.backgroundColor).toBeDefined();
      expect(tp.borderColor).toBeDefined();
      expect(tp.color).toBeDefined();

      const hm = patternClayStyle("Hash Map");
      expect(hm.backgroundColor).toBeDefined();
      // Two Pointers and Hash Map should have different slots
      expect(tp.backgroundColor).not.toBe(hm.backgroundColor);
    });

    it("generates deterministic styling for arbitrary novel pattern names", () => {
      const s1 = patternClayStyle("Unseen Quantum Graph Pattern");
      const s2 = patternClayStyle("Unseen Quantum Graph Pattern");
      expect(s1).toEqual(s2);
    });

    it("splits patterns on commas, semicolons, and pipes while deduplicating", () => {
      const input = ["Two Pointers, Sliding Window; Binary Search | Two Pointers", "  Sliding Window  "];
      const normalized = normalizePatternList(input);
      expect(normalized).toEqual(["Two Pointers", "Sliding Window", "Binary Search"]);
    });
  });

  describe("mapGfgDifficulty", () => {
    it("maps Hard -> HARD", () => {
      expect(mapGfgDifficulty("Hard")).toBe("HARD");
      expect(mapGfgDifficulty("hard")).toBe("HARD");
    });

    it("maps Medium -> MEDIUM", () => {
      expect(mapGfgDifficulty("Medium")).toBe("MEDIUM");
    });

    it("maps Easy, Basic, School -> EASY", () => {
      expect(mapGfgDifficulty("Easy")).toBe("EASY");
      expect(mapGfgDifficulty("Basic")).toBe("EASY");
      expect(mapGfgDifficulty("School")).toBe("EASY");
    });

    it("returns null for unknown difficulty or empty inputs", () => {
      expect(mapGfgDifficulty("Insane")).toBeNull();
      expect(mapGfgDifficulty(null)).toBeNull();
      expect(mapGfgDifficulty("")).toBeNull();
    });
  });

  describe("cn utility", () => {
    it("merges Tailwind classes and resolves conflicts", () => {
      expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
      expect(cn("text-red-500", false && "hidden", null, undefined, "text-blue-500")).toBe("text-blue-500");
    });
  });
});
