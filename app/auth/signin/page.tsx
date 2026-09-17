import { signIn } from "@/lib/auth";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

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
      <div className="w-full max-w-md border border-border bg-background p-8 space-y-6">
        <div className="space-y-3 text-center border-b border-border pb-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center border border-border bg-muted/40 p-2.5">
            <Logo className="h-full w-full text-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Hash-It</h1>
            <p className="mt-1 text-xs text-muted-foreground">Personal DSA memory system</p>
          </div>
        </div>

        <div className="space-y-5">
          <p className="text-xs leading-relaxed text-muted-foreground">
            {hasGoogleAuth || isProduction
              ? "Sign in with Google to keep your solves, memory reviews, and pattern insights synced to your account."
              : "Development mode is active. Use a local email to create or reuse a separate dev account without all accounts collapsing to one identity."}
          </p>

          {isProduction && !hasGoogleAuth ? (
            <div className="border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive space-y-1">
              <p className="font-semibold">Authentication Not Configured</p>
              <p className="text-[11px] text-destructive/80">
                Google OAuth credentials (<code>AUTH_GOOGLE_ID</code> and <code>AUTH_GOOGLE_SECRET</code>) are missing in environment variables.
              </p>
            </div>
          ) : (
            <form
              action={async (formData: FormData) => {
                "use server";
                if (hasGoogleAuth) {
                  await signIn("google", { redirectTo: redirectTarget });
                  return;
                }

                if (isProduction) {
                  throw new Error("Google authentication is required in production.");
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
              className="space-y-4"
            >
              {!hasGoogleAuth && !isProduction && (
                <div className="space-y-3">
                  <label className="block type-label">
                    <span className="mb-1.5 block">Local dev email</span>
                    <input
                      type="email"
                      name="email"
                      defaultValue="dev-user-local@example.com"
                      className="w-full border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-orange-500 font-sans"
                      placeholder="you@example.com"
                    />
                  </label>
                  <label className="block type-label">
                    <span className="mb-1.5 block">Display name</span>
                    <input
                      type="text"
                      name="name"
                      defaultValue="Local Dev"
                      className="w-full border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-orange-500 font-sans"
                      placeholder="Alice"
                    />
                  </label>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                className="w-full text-xs h-10"
              >
                {hasGoogleAuth ? (
                  <div className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" />
                      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z" />
                      <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 14.8s.7 5.1 1.9 7.5l3.7-2.9z" />
                      <path fill="#34A853" d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z" />
                    </svg>
                    <span>Continue with Google</span>
                  </div>
                ) : (
                  <span>Continue as local account</span>
                )}
              </Button>
            </form>
          )}
        </div>

        <div className="pt-2 flex items-center justify-center gap-2 type-caption border-t border-border">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Encrypted review data</span>
        </div>
      </div>
    </div>
  );
}
