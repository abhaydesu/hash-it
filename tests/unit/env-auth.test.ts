import { describe, it, expect, vi } from "vitest";

describe("env production auth requirements", () => {
  it("requireAuthSecret fails at startup when secret absent in production", async () => {
    vi.resetModules();
    const { requireAuthSecret } = await import("@/lib/auth.config");
    expect(() => requireAuthSecret(null, "production")).toThrow(/AUTH_SECRET is required/);
  });
});
