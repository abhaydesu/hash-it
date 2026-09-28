import { describe, expect, it } from "vitest";
import { primaryPattern } from "@/lib/pattern-classifier";

describe("primaryPattern", () => {
  it("prefers specific patterns over generic Array/Hash Table tags", () => {
    expect(primaryPattern(["Array", "Dynamic Programming"], "House Robber")).toBe("Dynamic Programming");
    expect(primaryPattern(["Array", "Hash Table", "Sliding Window"], "Fruit Into Baskets")).toBe("Sliding Window");
    expect(primaryPattern(["Array", "Hash Table"], "Two Sum")).toBe("HashMap");
    expect(primaryPattern(["Array", "Sorting"], "Sort Colors")).toBe("Basics");
  });

  it("ranks DP above Greedy and Binary Search", () => {
    expect(primaryPattern(["Array", "Greedy", "Dynamic Programming"], "Jump Game")).toBe("Dynamic Programming");
    expect(primaryPattern(["Array", "Binary Search", "Dynamic Programming"], "Longest Increasing Subsequence")).toBe(
      "Dynamic Programming"
    );
  });

  it("carves Kadane's out of DP by title", () => {
    expect(primaryPattern(["Array", "Divide and Conquer", "Dynamic Programming"], "Maximum Subarray")).toBe(
      "Kadane's Pattern"
    );
    expect(primaryPattern(["Array", "Dynamic Programming"], "Maximum Product Subarray")).toBe("Kadane's Pattern");
    // Without the DP tag, a "subarray" title is not Kadane's.
    expect(primaryPattern(["Array", "Sliding Window"], "Maximum Average Subarray I")).toBe("Sliding Window");
  });

  it("splits linked-list problems by technique", () => {
    expect(primaryPattern(["Linked List", "Two Pointers"], "Linked List Cycle II")).toBe("Fast and Slow Pointer");
    expect(primaryPattern(["Linked List", "Recursion"], "Reverse Linked List")).toBe("In-place Reversal of LinkedList");
    expect(primaryPattern(["Linked List", "Math"], "Add Two Numbers")).toBe("Dummy Node");
  });

  it("uses the title for interval problems", () => {
    expect(primaryPattern(["Array", "Sorting"], "Merge Intervals")).toBe("Merge Intervals");
  });

  it("skips non-DSA problems and unknown tags", () => {
    expect(primaryPattern(["Database"], "Combine Two Tables")).toBeNull();
    expect(primaryPattern(["Design"], "LRU-ish")).toBeNull();
    expect(primaryPattern([], "Untagged")).toBeNull();
  });
});
