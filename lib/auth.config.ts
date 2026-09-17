import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible NextAuth configuration.
 * Contains no database adapters, Prisma clients, or Node-only libraries
 * to keep Edge Function middleware bundles small (< 1 MB).
 */

/** Fail closed when AUTH_SECRET is missing (especially production). */
export function requireAuthSecret(
  secret: string | null | undefined = process.env.AUTH_SECRET,
  nodeEnv: string | null | undefined = process.env.NODE_ENV
): string {
  // Use null to mean "explicitly missing" in tests; undefined alone would
  // fall through to the default parameter (process.env.AUTH_SECRET).
  const raw = secret === null ? "" : secret ?? process.env.AUTH_SECRET;
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) {
    throw new Error("AUTH_SECRET is required");
  }
  if (nodeEnv === "production" && value.length < 16) {
    throw new Error("AUTH_SECRET must be at least 16 characters in production");
  }
  return value;
}

/** Explicit session-cookie flags (Auth.js defaults, pinned for auditability). */
export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    secure,
  };
}

const useSecureCookies =
  process.env.NODE_ENV === "production" ||
  Boolean(process.env.AUTH_URL?.startsWith("https://")) ||
  Boolean(process.env.NEXTAUTH_URL?.startsWith("https://"));

export const authConfig = {
  trustHost: true,
  secret: requireAuthSecret(),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
  },
  providers: [],
  cookies: {
    sessionToken: {
      options: sessionCookieOptions(useSecureCookies),
    },
  },
  callbacks: {
    async session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      else if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
