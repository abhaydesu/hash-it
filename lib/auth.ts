import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import type { NextAuthConfig } from "next-auth";

const isProduction = process.env.NODE_ENV === "production";
const hasGoogleAuth = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

const config: NextAuthConfig = {
  trustHost: true,
  secret: process.env.AUTH_SECRET,
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
    ...(!hasGoogleAuth && !isProduction
      ? [
          Credentials({
            name: "Local Dev",
            credentials: {
              email: { label: "Email", type: "email" },
              password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
              const email = String(credentials?.email ?? "dev-user-local@example.com");
              const name = email.split("@")[0] || "Local Dev";
              return {
                id: "dev-user-local",
                name,
                email,
                image: null,
              };
            },
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
      if (user?.id) {
        try {
          await prisma.userSettings.upsert({
            where: { userId: user.id },
            update: {},
            create: {
              userId: user.id,
              dailyResolveCap: 2,
              desiredRetention: 0.80,
              fsrsParams: [],
              timezone: "Asia/Kolkata",
              easyBaseline: 15,
              mediumBaseline: 30,
              hardBaseline: 45,
            },
          });
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
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);

/**
 * Gets the current authenticated user from the session.
 * Development mode allows the local credentials bypass; production requires real Google auth.
 */
export async function getCurrentUser(): Promise<{ id: string; name?: string | null; email?: string | null; image?: string | null }> {
  if (isProduction && !hasGoogleAuth) {
    throw new Error("AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are required before a user can sign in.");
  }

  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized: no active session");
  }

  return session.user as { id: string; name?: string | null; email?: string | null; image?: string | null };
}
