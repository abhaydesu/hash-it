/**
 * Pure auth environment guards — no NextAuth/Prisma imports.
 * Used by lib/auth.ts and unit-tested without loading the Auth.js runtime.
 */

export type AuthEnv = {
  NODE_ENV?: string;
  AUTH_GOOGLE_ID?: string;
  AUTH_GOOGLE_SECRET?: string;
};

/** Production must have Google OAuth; never fall open to a shared local account. */
export function assertProductionAuthConfigured(env: AuthEnv = process.env): void {
  if (env.NODE_ENV === "production") {
    if (!env.AUTH_GOOGLE_ID?.trim() || !env.AUTH_GOOGLE_SECRET?.trim()) {
      throw new Error(
        "AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are required before a user can sign in."
      );
    }
  }
}

/** Local credentials provider is development/test only. */
export function isDevCredentialsEnabled(env: AuthEnv = process.env): boolean {
  return env.NODE_ENV !== "production";
}

export function hasGoogleAuthConfigured(env: AuthEnv = process.env): boolean {
  return Boolean(env.AUTH_GOOGLE_ID?.trim() && env.AUTH_GOOGLE_SECRET?.trim());
}
