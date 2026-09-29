import { describe, it, expect } from "vitest";
import { suggestPatterns, canonicalPattern, patternMatchKey } from "@/lib/pattern-match";

const known = ["Sliding Window", "Two Pointers", "Binary Search", "Monotonic Stack", "Dynamic Programming"];

describe("pattern matching", () => {
  it("ignores case, spacing and punctuation in keys", () => {
    expect(patternMatchKey("Two-Pointers")).toBe(patternMatchKey("two  pointers"));
  });

  it("suggests by prefix and substring", () => {
    expect(suggestPatterns("sli", known)[0]).toBe("Sliding Window");
    expect(suggestPatterns("stack", known)).toContain("Monotonic Stack");
  });

  it("tolerates typos and formatting drift", () => {
    expect(suggestPatterns("slidng window", known)[0]).toBe("Sliding Window");
    expect(suggestPatterns("two-pointer", known)[0]).toBe("Two Pointers");
    expect(suggestPatterns("binry search", known)[0]).toBe("Binary Search");
  });

  it("skips already-selected patterns and empty queries", () => {
    expect(suggestPatterns("two", known, ["two pointers"])).toEqual([]);
    expect(suggestPatterns("  ", known)).toEqual([]);
  });

  it("does not suggest unrelated names", () => {
    expect(suggestPatterns("graph", known)).toEqual([]);
  });

  it("keeps caller order on ties (most-used first)", () => {
    expect(suggestPatterns("search", ["Search A", "Search B"])).toEqual(["Search A", "Search B"]);
  });

  it("snaps alternate spellings to the known pattern", () => {
    expect(canonicalPattern("sliding-window", known)).toBe("Sliding Window");
    expect(canonicalPattern("Graphs", known)).toBe("Graphs");
  });
});
