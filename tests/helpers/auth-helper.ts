import { vi } from "vitest";

let currentTestUser: { id: string; name?: string | null; email?: string | null; image?: string | null } | null = null;

export function setTestUser(user: { id: string; name?: string | null; email?: string | null; image?: string | null } | null) {
  currentTestUser = user;
}

export function getTestUser() {
  return currentTestUser;
}

// Complete mock for @/lib/auth without importing next-auth
vi.mock("@/lib/auth", () => {
  return {
    handlers: { GET: vi.fn(), POST: vi.fn() },
    signIn: vi.fn(),
    signOut: vi.fn(),
    auth: vi.fn(async () => {
      if (!currentTestUser) return null;
      return {
        user: currentTestUser,
        expires: new Date(Date.now() + 86400000).toISOString(),
      };
    }),
    getCurrentUser: vi.fn(async () => {
      if (!currentTestUser) {
        throw new Error("Unauthorized: no active session");
      }
      return currentTestUser;
    }),
  };
});
