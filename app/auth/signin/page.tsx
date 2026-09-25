import React from 'react';
import { DEV_USER, signIn } from "@/lib/auth";
import { SheetSection } from "@/components/ui/sheet-section";
import { SpecCell, SpecGrid, FigureCaption } from "@/components/ui/spec-sheet";
import { isSafeCallbackPath } from "@/lib/safe";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const redirectTarget = callbackUrl && isSafeCallbackPath(callbackUrl) ? callbackUrl : "/today";
  const hasGoogleAuth = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  const isProduction = process.env.NODE_ENV === "production";

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] w-full flex-col justify-center bg-background font-sans text-foreground">
      <SheetSection
        className="before:pointer-events-none before:absolute before:left-1/2 before:top-0 before:z-20 before:w-screen before:-translate-x-1/2 before:border-t before:border-border before:content-['']"
        flush
      >
        <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-12 md:divide-x md:divide-y-0">
          <div className="flex flex-col justify-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:px-8 md:col-span-7">
            <div className="max-w-xl space-y-5">
              <h1 className="text-3xl font-medium tracking-tight sm:text-5xl">
                Sign in to your practice log.
              </h1>
              <p className="type-body">
                {hasGoogleAuth
                  ? "One Google account. Your solves, reviews, and pattern data stay synced."
                  : `Development mode. Sign in as the ${DEV_USER.name} test user.`}
              </p>
            </div>

            <SpecGrid columns={3} className="max-w-lg">
              <SpecCell label="Daily" value="Queue" subvalue="Due reviews" />
              <SpecCell label="Schedule" value="FSRS" subvalue="Interval logic" />
              <SpecCell label="Recall" value="Patterns" subvalue="Drill + mock" />
            </SpecGrid>
          </div>

          <div className="relative flex flex-col justify-center bg-dither-25 px-4 py-12 sm:px-6 sm:py-16 lg:px-8 md:col-span-5">
            <div className="mx-auto w-full max-w-sm border border-border bg-background">
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
                <span className="type-label text-muted-foreground">Credential panel</span>
                <span className="type-label text-orange-600">
                  {hasGoogleAuth ? "Google" : isProduction ? "Blocked" : "Local Dev"}
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
                  <div className="space-y-3">
                    {hasGoogleAuth && (
                      <form
                        action={async () => {
                          "use server";
                          await signIn("google", { redirectTo: redirectTarget });
                        }}
                      >
                        <button
                          type="submit"
                          className="pressable inline-flex h-10 w-full items-center justify-center gap-2 border border-orange-500 bg-orange-500 px-4 text-sm text-white hover:bg-orange-600"
                        >
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
                        </button>
                      </form>
                    )}

                    {!isProduction && (
                      <form
                        action={async () => {
                          "use server";
                          await signIn("credentials", { redirectTo: redirectTarget });
                        }}
                      >
                        <button
                          type="submit"
                          className="pressable inline-flex h-10 w-full items-center justify-center gap-2 border border-border bg-background px-4 text-sm text-foreground hover:bg-muted"
                        >
                          Continue as {DEV_USER.name}
                          <span className="type-label text-muted-foreground">dev</span>
                        </button>
                      </form>
                    )}
                  </div>
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
