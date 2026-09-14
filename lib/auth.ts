import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import type { NextAuthConfig } from "next-auth";

export const DEV_USER = {
  id: "dev-user-local",
  name: "Dev User",
  email: "dev@hashit.local",
  image: null,
};

const hasGoogleAuth = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

const config: NextAuthConfig = {
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin",
  },
  providers: [
    ...(hasGoogleAuth
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID!,
            clientSecret: process.env.AUTH_GOOGLE_SECRET!,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.sub = user.id;
      }
      // Ensure UserSettings exist and migrate dev entries on first sign-in (jwt fires after adapter commits user to DB)
      if (user?.id) {
        try {
          await prisma.userSettings.upsert({
            where: { userId: user.id },
            update: {},
            create: {
              userId: user.id,
              dailyReviewCap: 5,
              desiredRetention: 0.9,
              fsrsParams: [],
              timezone: "Asia/Kolkata",
              easyBaseline: 15,
              mediumBaseline: 30,
              hardBaseline: 45,
            },
          });

          // Data Migration: If dev-user-local holds entries and this Google user has 0 entries,
          // safely transfer all entries and import batches to the real authenticated user.
          if (user.id !== DEV_USER.id) {
            const devEntriesCount = await prisma.entry.count({
              where: { userId: DEV_USER.id },
            });

            if (devEntriesCount > 0) {
              const userEntriesCount = await prisma.entry.count({
                where: { userId: user.id },
              });

              if (userEntriesCount === 0) {
                await prisma.$transaction(async (tx) => {
                  await tx.entry.updateMany({
                    where: { userId: DEV_USER.id },
                    data: { userId: user.id },
                  });
                  await tx.importBatch.updateMany({
                    where: { userId: DEV_USER.id },
                    data: { userId: user.id },
                  });
                });
                console.log(
                  `[Auth Migration] Transferred ${devEntriesCount} entries from dev-user-local to ${user.id}`
                );
              }
            }
          }
        } catch (err) {
          console.error("[Auth] Failed during post-login setup/migration:", err);
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
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);

/**
 * Gets the current authenticated user from the session.
 * In dev mode (when Google OAuth credentials are not configured), falls back to the dev user.
 * Throws if called in production or when OAuth is active with no session.
 */
export async function getCurrentUser(): Promise<{ id: string; name?: string | null; email?: string | null; image?: string | null }> {
  // If Google OAuth credentials are configured, require genuine authenticated session
  if (hasGoogleAuth) {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error("Unauthorized: no active session");
    }
    return session.user as { id: string; name?: string | null; email?: string | null; image?: string | null };
  }

  // Fallback Dev Bypass: active only when Google credentials have not yet been provided in .env
  await prisma.user.upsert({
    where: { id: DEV_USER.id },
    update: {},
    create: {
      id: DEV_USER.id,
      name: DEV_USER.name,
      email: DEV_USER.email,
      image: DEV_USER.image,
    },
  });
  await prisma.userSettings.upsert({
    where: { userId: DEV_USER.id },
    update: {},
    create: {
      userId: DEV_USER.id,
      dailyReviewCap: 5,
      desiredRetention: 0.9,
      fsrsParams: [],
      timezone: "Asia/Kolkata",
      easyBaseline: 15,
      mediumBaseline: 30,
      hardBaseline: 45,
    },
  });
  return DEV_USER;
}
