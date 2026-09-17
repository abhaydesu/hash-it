import React from 'react';
import { signIn } from "@/lib/auth";
import { SheetSection } from "@/components/ui/sheet-section";
import { SpecCell, SpecGrid, FigureCaption } from "@/components/ui/spec-sheet";

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
  const useGoogle = isProduction && hasGoogleAuth;

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] w-full flex-col justify-center bg-background font-sans text-foreground">
      <SheetSection
        className="before:pointer-events-none before:absolute before:left-1/2 before:top-0 before:z-20 before:w-screen before:-translate-x-1/2 before:border-t before:border-border before:content-['']"
        innerClassName="px-0"
      >
        <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-12 md:divide-x md:divide-y-0">
          <div className="flex flex-col justify-center gap-10 px-6 py-12 sm:px-8 sm:py-16 md:col-span-7">
            <div className="max-w-xl space-y-5">
              <h1 className="text-3xl font-medium tracking-tight sm:text-5xl">
                Sign in to keep your practice log and review schedule.
              </h1>
              <p className="type-body">
                {useGoogle
                  ? "Google keeps your solves, memory reviews, and pattern insights synced to one account."
                  : "Development mode is active. Use a local email to create or reuse a separate account without collapsing identities."}
              </p>
            </div>

            <SpecGrid columns={3} className="max-w-lg">
              <SpecCell label="Daily" value="Queue" subvalue="Due reviews" />
              <SpecCell label="Schedule" value="FSRS" subvalue="Interval logic" />
              <SpecCell label="Recall" value="Patterns" subvalue="Drill + mock" />
            </SpecGrid>
          </div>

          <div className="relative flex flex-col justify-center bg-dither-25 px-6 py-12 sm:px-8 sm:py-16 md:col-span-5">
            <div className="mx-auto w-full max-w-sm border border-border bg-background">
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
                <span className="type-label text-muted-foreground">Credential panel</span>
                <span className="type-label text-orange-600">
                  {isProduction ? (hasGoogleAuth ? "Google" : "Blocked") : "Local Dev"}
                </span>
              </div>

              <div className="space-y-5 p-5 sm:p-6">
                {isProduction && !hasGoogleAuth ? (
                  <div className="space-y-2 border border-destructive/40 bg-destructive/10 p-3.5">
                    <p className="text-xs font-semibold text-destructive">Authentication not configured</p>
                    <p className="text-[11px] leading-relaxed text-destructive/80">
                      Google OAuth credentials (<code className="font-mono">AUTH_GOOGLE_ID</code> and{" "}
                      <code className="font-mono">AUTH_GOOGLE_SECRET</code>) are missing.
                    </p>
                  </div>
                ) : (
                  <form
                    action={async (formData: FormData) => {
                      "use server";
                      if (isProduction) {
                        if (!hasGoogleAuth) {
                          throw new Error("Google authentication is required in production.");
                        }
                        await signIn("google", { redirectTo: redirectTarget });
                        return;
                      }

                      const email = String(formData.get("email") || "dev-user-local@example.com")
                        .trim()
                        .toLowerCase();
                      const name =
                        String(formData.get("name") || email.split("@")[0] || "Local Dev").trim() ||
                        "Local Dev";

                      await signIn("credentials", {
                        email,
                        name,
                        password: "dev",
                        redirectTo: redirectTarget,
                      });
                    }}
                    className="space-y-4"
                  >
                    {!isProduction && (
                      <div className="space-y-3">
                        <label className="block">
                          <span className="type-label mb-1.5 block">Local dev email</span>
                          <input
                            type="email"
                            name="email"
                            defaultValue="dev-user-local@example.com"
                            className="w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                            placeholder="you@example.com"
                          />
                        </label>
                        <label className="block">
                          <span className="type-label mb-1.5 block">Display name</span>
                          <input
                            type="text"
                            name="name"
                            defaultValue="Local Dev"
                            className="w-full border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                            placeholder="Alice"
                          />
                        </label>
                      </div>
                    )}

                    <button
                      type="submit"
        className="pressable inline-flex h-10 w-full items-center justify-center gap-2 border border-orange-500 bg-orange-500 px-4 text-sm text-white hover:bg-orange-600"
                    >
                      {useGoogle ? (
                        <>
                          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              fill="currentColor"
                              d="M21.6 12.23c0-.74-.07-1.45-.19-2.13H12v4.03h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.99-4.3 2.99-7.42z"
                            />
                            <path
                              fill="currentColor"
                              opacity="0.85"
                              d="M12 22c2.7 0 4.96-.9 6.61-2.43l-3.23-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.09v2.59A10 10 0 0 0 12 22z"
                            />
                            <path
                              fill="currentColor"
                              opacity="0.7"
                              d="M6.41 13.91A6 6 0 0 1 6.09 12c0-.66.11-1.31.3-1.91V7.5H3.09A10 10 0 0 0 2 12c0 1.61.39 3.14 1.09 4.5l3.32-2.59z"
                            />
                            <path
                              fill="currentColor"
                              opacity="0.9"
                              d="M12 5.98c1.47 0 2.79.5 3.82 1.5l2.86-2.86C16.95 2.99 14.7 2 12 2A10 10 0 0 0 3.09 7.5l3.32 2.59C7.2 7.73 9.4 5.98 12 5.98z"
                            />
                          </svg>
                          Continue with Google
                        </>
                      ) : (
                        "Continue as local account"
                      )}
                    </button>
                  </form>
                )}

                <p className="type-caption">
                  By continuing you open your daily queue and review schedule.
                </p>
              </div>
            </div>

            <FigureCaption
              fig={1}
              title="Sign-in panel. One credential, one queue."
              className="text-center"
            />
          </div>
        </div>
      </SheetSection>
    </div>
  );
}
