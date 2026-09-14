import { signIn } from "@/lib/auth";
import { ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const redirectTarget = callbackUrl || "/today";
  const hasGoogleAuth = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  const isProduction = process.env.NODE_ENV === "production";

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-[28px] border border-border bg-card/80 p-8 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.9)] backdrop-blur-md">
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-lg font-bold text-emerald-600 dark:text-emerald-300 font-pixel">
            #
          </div>
          <div>
            <h1 className="font-pixel text-2xl tracking-[0.18em] text-foreground">HASH_IT</h1>
            <p className="mt-2 text-sm text-muted-foreground">Personal DSA memory system</p>
          </div>
        </div>

        <div className="mt-8 space-y-5">
          <p className="text-sm leading-6 text-muted-foreground">
            {hasGoogleAuth || isProduction
              ? "Sign in with Google to keep your solves, memory reviews, and pattern insights synced to your account."
              : "Development mode is active. Use a local email to create or reuse a separate dev account without all accounts collapsing to one identity."}
          </p>

          <form
            action={async (formData: FormData) => {
              "use server";
              if (hasGoogleAuth) {
                await signIn("google", { redirectTo: redirectTarget });
                return;
              }

              const email = String(formData.get("email") || "dev-user-local@example.com").trim().toLowerCase();
              const name = String(formData.get("name") || email.split("@")[0] || "Local Dev").trim() || "Local Dev";

              await signIn("credentials", {
                email,
                name,
                password: "dev",
                redirectTo: redirectTarget,
              });
            }}
            className="space-y-3"
          >
            {!hasGoogleAuth && (
              <>
                <label className="block text-sm text-muted-foreground">
                  <span className="mb-1.5 block">Local dev email</span>
                  <input
                    type="email"
                    name="email"
                    defaultValue="dev-user-local@example.com"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none ring-0 placeholder:text-muted-foreground/70 focus:border-foreground"
                    placeholder="you@example.com"
                  />
                </label>
                <label className="block text-sm text-muted-foreground">
                  <span className="mb-1.5 block">Display name</span>
                  <input
                    type="text"
                    name="name"
                    defaultValue="Local Dev"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none ring-0 placeholder:text-muted-foreground/70 focus:border-foreground"
                    placeholder="Alice"
                  />
                </label>
              </>
            )}

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-500/30 active:scale-[0.98]"
            >
              {hasGoogleAuth ? (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" />
                    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z" />
                    <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 14.8s.7 5.1 1.9 7.5l3.7-2.9z" />
                    <path fill="#34A853" d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z" />
                  </svg>
                  <span>Continue with Google</span>
                </>
              ) : (
                <span>Continue as local account</span>
              )}
            </button>
          </form>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Encrypted review data</span>
        </div>
      </div>
    </div>
  );
}
