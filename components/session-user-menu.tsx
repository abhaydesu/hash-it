import Link from "next/link";
import { auth } from "@/lib/auth";
import { UserMenu } from "@/components/user-menu";

export function SessionUserMenuFallback() {
  return <div className="h-8 w-8 bg-muted/50" aria-hidden />;
}

/** Session chrome only — kept out of the root layout so page navigations are not blocked on auth(). */
export async function SessionUserMenu() {
  const session = await auth();
  const user = session?.user ?? null;

  if (user) {
    return <UserMenu user={user} />;
  }

  return (
    <Link
      href="/auth/signin"
      className="inline-flex h-8 items-center border border-orange-500 bg-orange-500 px-2.5 text-xs font-medium text-white transition-colors hover:bg-orange-600"
    >
      Sign in
    </Link>
  );
}
