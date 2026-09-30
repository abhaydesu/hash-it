import { describe, expect, it } from "vitest";
import { canSeeRoadmap } from "@/lib/roadmap-access";

describe("canSeeRoadmap", () => {
  const list = "Owner@Example.com, second@example.com ,";

  it("allows listed emails, ignoring case and whitespace", () => {
    expect(canSeeRoadmap("owner@example.com", list)).toBe(true);
    expect(canSeeRoadmap("SECOND@example.com", list)).toBe(true);
  });

  it("denies unlisted, missing, and empty-allowlist cases", () => {
    expect(canSeeRoadmap("other@example.com", list)).toBe(false);
    expect(canSeeRoadmap(null, list)).toBe(false);
    expect(canSeeRoadmap("owner@example.com", "")).toBe(false);
  });
});
