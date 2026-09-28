import { signOut } from "@/lib/auth";

/**
 * Clears a session whose user no longer exists (see getCurrentUser) and sends the
 * visitor back to sign in. A route handler, because only it can rewrite the cookie
 * from a server-component render; it sits under the public /auth/signin prefix.
 */
export async function GET() {
  await signOut({ redirectTo: "/auth/signin" });
}
