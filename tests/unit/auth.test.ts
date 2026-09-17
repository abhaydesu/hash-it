import { describe, it, expect } from "vitest";
import {
  assertProductionAuthConfigured,
  isDevCredentialsEnabled,
  hasGoogleAuthConfigured,
} from "@/lib/auth-guards";

describe("auth production fail-closed guards", () => {
  it("throws in production when Google OAuth env vars are missing", () => {
    expect(() =>
      assertProductionAuthConfigured({
        NODE_ENV: "production",
        AUTH_GOOGLE_ID: undefined,
        AUTH_GOOGLE_SECRET: undefined,
      })
    ).toThrow(/AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are required/);

    expect(() =>
      assertProductionAuthConfigured({
        NODE_ENV: "production",
        AUTH_GOOGLE_ID: "gid",
        AUTH_GOOGLE_SECRET: "",
      })
    ).toThrow(/AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are required/);
  });

  it("does not throw when production has Google OAuth configured", () => {
    expect(() =>
      assertProductionAuthConfigured({
        NODE_ENV: "production",
        AUTH_GOOGLE_ID: "gid",
        AUTH_GOOGLE_SECRET: "gsecret",
      })
    ).not.toThrow();
  });

  it("does not throw outside production even without Google", () => {
    expect(() =>
      assertProductionAuthConfigured({
        NODE_ENV: "development",
        AUTH_GOOGLE_ID: undefined,
        AUTH_GOOGLE_SECRET: undefined,
      })
    ).not.toThrow();
  });

  it("enables dev credentials only outside production", () => {
    expect(isDevCredentialsEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(isDevCredentialsEnabled({ NODE_ENV: "test" })).toBe(true);
    expect(isDevCredentialsEnabled({ NODE_ENV: "production" })).toBe(false);
  });

  it("detects Google auth configuration", () => {
    expect(hasGoogleAuthConfigured({ AUTH_GOOGLE_ID: "a", AUTH_GOOGLE_SECRET: "b" })).toBe(true);
    expect(hasGoogleAuthConfigured({ AUTH_GOOGLE_ID: "a", AUTH_GOOGLE_SECRET: "" })).toBe(false);
    expect(hasGoogleAuthConfigured({})).toBe(false);
  });
});
