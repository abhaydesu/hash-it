import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { findOrCreateLocalUser } from "@/lib/local-auth";
import { authConfig } from "@/lib/auth.config";
import {
  assertProductionAuthConfigured,
  hasGoogleAuthConfigured,
  isDevCredentialsEnabled,
  type AuthEnv,
} from "@/lib/auth-guards";
import type { NextAuthConfig } from "next-auth";

export {
  assertProductionAuthConfigured,
  hasGoogleAuthConfigured,
  isDevCredentialsEnabled,
} from "@/lib/auth-guards";
export type { AuthEnv } from "@/lib/auth-guards";

/** Build providers for the given env (testable without NextAuth init). */
export function buildAuthProviders(env: AuthEnv = process.env): NextAuthConfig["providers"] {
  const providers: NextAuthConfig["providers"] = [];

  if (hasGoogleAuthConfigured(env)) {
    providers.push(
      Google({
        clientId: env.AUTH_GOOGLE_ID!,
        clientSecret: env.AUTH_GOOGLE_SECRET!,
      })
    );
  }

  if (isDevCredentialsEnabled(env)) {
    providers.push(
      Credentials({
        name: "Local Dev",
        credentials: {
          email: { label: "Email", type: "email" },
          name: { label: "Name", type: "text" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          const emailRaw = String(credentials?.email ?? "dev-user-local@example.com").trim().toLowerCase();
          const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)
            ? emailRaw.slice(0, 254)
            : "dev-user-local@example.com";
          const name =
            String(credentials?.name ?? email.split("@")[0] ?? "Local Dev").trim().slice(0, 80) ||
            "Local Dev";
          const user = await findOrCreateLocalUser(email, name);
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
          };
        },
      })
    );
  }

  return providers;
}

/** Post-login hooks: settings upsert only — never migrate rows between users. */
export async function ensureUserSettings(userId: string): Promise<void> {
  await prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      dailyResolveCap: 2,
      desiredRetention: 0.8,
      fsrsParams: [],
      timezone: "Asia/Kolkata",
      easyBaseline: 20,
      mediumBaseline: 40,
      hardBaseline: 60,
    },
  });
}

export const authCallbacks: NonNullable<NextAuthConfig["callbacks"]> = {
  async jwt({ token, user }) {
    if (user) {
      token.id = user.id;
      token.sub = user.id;
    }
    if (user?.id) {
      try {
        await ensureUserSettings(user.id);
      } catch (err) {
        console.error("[Auth] Failed during post-login setup:", err);
      }
    }
    return token;
  },
  async session({ session, token }) {
    if (token.id) session.user.id = token.id as string;
    else if (token.sub) session.user.id = token.sub;
    return session;
  },
  async signIn() {
    return true;
  },
};

/**
 * Post-sign-in profile sync. Runs as an event (not a callback) so a DB failure
 * cannot turn into a NextAuth Configuration error and break the login flow.
 */
export const authEvents: NonNullable<NextAuthConfig["events"]> = {
  async signIn({ user, account, profile }) {
    if (account?.provider !== "google" || !profile?.email || !user?.id) return;
    try {
      const picture = (profile as Record<string, unknown>).picture as string | undefined;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          name: profile.name ?? user.name,
          email: profile.email,
          ...(picture && { image: picture }),
        },
      });
    } catch (err) {
      console.error("[Auth] Google profile sync failed:", err);
    }
  },
};

// Fail closed at module load in a misconfigured production deploy.
assertProductionAuthConfigured();

const config: NextAuthConfig = {
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: buildAuthProviders(),
  callbacks: authCallbacks,
  events: authEvents,
  pages: {
    ...authConfig.pages,
    error: "/auth/error",
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);

/**
 * Gets the current authenticated user from the session.
 * Development mode allows the local credentials bypass; production requires real Google auth.
 */
export async function getCurrentUser(): Promise<{
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}> {
  assertProductionAuthConfigured();

  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized: no active session");
  }

  return session.user as {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}
