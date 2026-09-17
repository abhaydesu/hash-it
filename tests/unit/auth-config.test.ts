import { describe, it, expect } from "vitest";
import {
  requireAuthSecret,
  sessionCookieOptions,
  authConfig,
} from "@/lib/auth.config";

describe("auth.config", () => {
  it("fails when AUTH_SECRET is missing", () => {
    expect(() => requireAuthSecret(null, "production")).toThrow(/AUTH_SECRET is required/);
    expect(() => requireAuthSecret("", "development")).toThrow(/AUTH_SECRET is required/);
    expect(() => requireAuthSecret("   ", "test")).toThrow(/AUTH_SECRET is required/);
  });

  it("fails when AUTH_SECRET is too short in production", () => {
    expect(() => requireAuthSecret("short", "production")).toThrow(/at least 16 characters/);
  });

  it("accepts a non-empty secret outside production", () => {
    expect(requireAuthSecret("dev-secret", "development")).toBe("dev-secret");
    expect(requireAuthSecret("sixteen-chars!!!!", "production")).toBe("sixteen-chars!!!!");
  });

  it("pins session cookie to httpOnly + sameSite lax + path /", () => {
    const secure = sessionCookieOptions(true);
    expect(secure).toEqual({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: true,
    });

    const insecure = sessionCookieOptions(false);
    expect(insecure.httpOnly).toBe(true);
    expect(insecure.sameSite).toBe("lax");
    expect(insecure.secure).toBe(false);
  });

  it("exports authConfig with secret and session cookie options", () => {
    expect(authConfig.secret).toBeTruthy();
    expect(authConfig.session?.strategy).toBe("jwt");
    expect(authConfig.cookies?.sessionToken?.options?.httpOnly).toBe(true);
    expect(authConfig.cookies?.sessionToken?.options?.sameSite).toBe("lax");
    expect(authConfig.pages?.signIn).toBe("/auth/signin");
  });

  it("session callback copies token id onto session.user", async () => {
    const session = await authConfig.callbacks!.session!({
      session: { user: { email: "a@b.com" }, expires: "" },
      token: { id: "tok-user", sub: "sub-user" },
    } as never);
    expect(session.user.id).toBe("tok-user");

    const sessionFromSub = await authConfig.callbacks!.session!({
      session: { user: { email: "a@b.com" }, expires: "" },
      token: { sub: "sub-only" },
    } as never);
    expect(sessionFromSub.user.id).toBe("sub-only");
  });
});
