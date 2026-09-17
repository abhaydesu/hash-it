import { describe, it, expect, vi, beforeAll } from "vitest";

vi.mock("next-auth", () => ({
  default: () => ({
    auth: (handler: (req: unknown) => unknown) => handler,
  }),
}));

vi.mock("@/lib/auth.config", () => ({
  authConfig: {
    trustHost: true,
    secret: "test-secret-at-least-16-chars",
    session: { strategy: "jwt" },
    pages: { signIn: "/auth/signin" },
    providers: [],
    callbacks: {},
  },
}));

let isPublicPath: typeof import("@/middleware").isPublicPath;
let authorizeRequest: typeof import("@/middleware").authorizeRequest;
let PUBLIC_PATHS: typeof import("@/middleware").PUBLIC_PATHS;

beforeAll(async () => {
  const mod = await import("@/middleware");
  isPublicPath = mod.isPublicPath;
  authorizeRequest = mod.authorizeRequest;
  PUBLIC_PATHS = mod.PUBLIC_PATHS;
});

describe("middleware auth gate", () => {
  it("treats only the documented public paths as public", () => {
    expect(PUBLIC_PATHS).toEqual([
      "/",
      "/auth/signin",
      "/api/auth",
      "/api/cron",
      "/favicon.ico",
      "/icon.svg",
      "/logo-1.svg",
      "/logo-2.svg",
    ]);

    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/auth/signin")).toBe(true);
    expect(isPublicPath("/api/auth/callback/google")).toBe(true);
    expect(isPublicPath("/api/cron/sync-leetcode")).toBe(true);
    expect(isPublicPath("/favicon.ico")).toBe(true);

    expect(isPublicPath("/today")).toBe(false);
    expect(isPublicPath("/problems")).toBe(false);
    expect(isPublicPath("/problems/abc")).toBe(false);
    expect(isPublicPath("/api/stats")).toBe(false);
    expect(isPublicPath("/api/today-queue")).toBe(false);
    expect(isPublicPath("/settings")).toBe(false);
    expect(isPublicPath("/import")).toBe(false);
  });

  it("rejects unauthenticated requests to protected pages with a sign-in redirect", () => {
    const res = authorizeRequest({
      pathname: "/today",
      hasUser: false,
      requestUrl: "http://localhost:3000/today",
    });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/signin");
    expect(res.headers.get("location")).toContain("callbackUrl=%2Ftoday");
  });

  it("rejects unauthenticated requests to protected API routes with 401", () => {
    for (const pathname of [
      "/api/stats",
      "/api/today-queue",
      "/api/patterns",
      "/api/review/weekly",
      "/api/review/monthly",
      "/api/review/weekly/drill",
      "/api/search/problems",
    ]) {
      const res = authorizeRequest({
        pathname,
        hasUser: false,
        requestUrl: `http://localhost:3000${pathname}`,
      });
      expect(res.status).toBe(401);
    }
  });

  it("allows authenticated users through protected routes", () => {
    const res = authorizeRequest({
      pathname: "/problems",
      hasUser: true,
      requestUrl: "http://localhost:3000/problems",
    });
    expect(res.status).toBe(200);
  });

  it("allows unauthenticated access only on public paths", () => {
    const res = authorizeRequest({
      pathname: "/auth/signin",
      hasUser: false,
      requestUrl: "http://localhost:3000/auth/signin",
    });
    expect(res.status).toBe(200);
  });
});
