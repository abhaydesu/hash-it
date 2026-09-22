import React from "react";
import Link from "next/link";
import { SheetSection } from "@/components/ui/sheet-section";
import { SpecCell, SpecGrid, FigureCaption } from "@/components/ui/spec-sheet";
import { isSafeCallbackPath } from "@/lib/safe";

export const dynamic = "force-dynamic";

type ErrorCopy = { title: string; detail: string; status: string };

const ERROR_COPY: Record<string, ErrorCopy> = {
  Configuration: {
    title: "Sign-in configuration error.",
    detail:
      "The server couldn't complete the OAuth handshake. This is on our end — try again in a moment.",
    status: "Server",
  },
  AccessDenied: {
    title: "Access denied.",
    detail: "The sign-in was cancelled, or the provider refused the request.",
    status: "Denied",
  },
  Verification: {
    title: "Verification link expired.",
    detail: "That sign-in link is no longer valid. Start over from the sign-in page.",
    status: "Expired",
  },
  OAuthAccountNotLinked: {
    title: "Account already exists.",
    detail:
      "This email is registered with a different sign-in method. Use the original provider to continue.",
    status: "Conflict",
  },
  AccountNotLinked: {
    title: "Account already exists.",
    detail:
      "This email is registered with a different sign-in method. Use the original provider to continue.",
    status: "Conflict",
  },
  OAuthCallbackError: {
    title: "OAuth callback failed.",
    detail: "The provider returned an unexpected response. Try signing in again.",
    status: "Callback",
  },
  OAuthSignInError: {
    title: "Could not start OAuth flow.",
    detail: "We couldn't hand off to the sign-in provider. Try again in a moment.",
    status: "Provider",
  },
  OAuthCreateAccount: {
    title: "Account creation failed.",
    detail: "We couldn't create your account from the OAuth profile. Try again shortly.",
    status: "Adapter",
  },
  Callback: {
    title: "Sign-in callback failed.",
    detail: "Something interrupted the sign-in handoff. Please retry.",
    status: "Callback",
  },
  CredentialsSignin: {
    title: "Invalid credentials.",
    detail: "The credentials submitted were not accepted. Check them and try again.",
    status: "Rejected",
  },
  SessionRequired: {
    title: "Sign-in required.",
    detail: "You need to be signed in to view that page.",
    status: "No session",
  },
  Default: {
    title: "Something went wrong.",
    detail: "We couldn't sign you in. Try again, and if it keeps happening, reach out.",
    status: "Halted",
  },
};

function resolveError(raw: string | undefined): { key: string; copy: ErrorCopy } {
  if (raw && Object.prototype.hasOwnProperty.call(ERROR_COPY, raw)) {
    return { key: raw, copy: ERROR_COPY[raw] };
  }
  return { key: raw?.slice(0, 40) || "Default", copy: ERROR_COPY.Default };
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;
  const { key, copy } = resolveError(error);

  const safeCallback = callbackUrl && isSafeCallbackPath(callbackUrl) ? callbackUrl : null;
  const retryHref = safeCallback
    ? `/auth/signin?callbackUrl=${encodeURIComponent(safeCallback)}`
    : "/auth/signin";

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] w-full flex-col justify-center bg-background font-sans text-foreground">
      <SheetSection
        className="before:pointer-events-none before:absolute before:left-1/2 before:top-0 before:z-20 before:w-screen before:-translate-x-1/2 before:border-t before:border-border before:content-['']"
        innerClassName="px-0"
      >
        <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-12 md:divide-x md:divide-y-0">
          <div className="flex flex-col justify-center gap-10 px-6 py-12 sm:px-8 sm:py-16 md:col-span-7">
            <div className="max-w-xl space-y-5">
              <h1 className="text-3xl font-medium tracking-tight sm:text-5xl">{copy.title}</h1>
              <p className="type-body">{copy.detail}</p>
            </div>

            <SpecGrid columns={3} className="max-w-lg">
              <SpecCell label="Code" value={key} subvalue="Error type" />
              <SpecCell label="Status" value={copy.status} subvalue="No session created" />
              <SpecCell label="Next" value="Retry" subvalue="Return to sign-in" />
            </SpecGrid>
          </div>

          <div className="relative flex flex-col justify-center bg-dither-25 px-6 py-12 sm:px-8 sm:py-16 md:col-span-5">
            <div className="mx-auto w-full max-w-sm border border-border bg-background">
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2.5">
                <span className="type-label text-muted-foreground">Error panel</span>
                <span className="type-label text-orange-600">{key}</span>
              </div>

              <div className="space-y-5 p-5 sm:p-6">
                <div className="space-y-2 border border-destructive/40 bg-destructive/10 p-3.5">
                  <p className="text-xs font-semibold text-destructive">{copy.title}</p>
                  <p className="text-[11px] leading-relaxed text-destructive/80">{copy.detail}</p>
                </div>

                <Link
                  href={retryHref}
                  className="pressable inline-flex h-10 w-full items-center justify-center gap-2 border border-orange-500 bg-orange-500 px-4 text-sm text-white hover:bg-orange-600"
                >
                  Back to sign-in
                </Link>

                <Link
                  href="/"
                  className="pressable inline-flex h-10 w-full items-center justify-center gap-2 border border-border bg-background px-4 text-sm text-foreground hover:bg-muted/40"
                >
                  Return home
                </Link>

                <p className="type-caption">
                  If this keeps happening, wait a minute and try again.
                </p>
              </div>
            </div>

            <FigureCaption
              fig={1}
              title="Sign-in error. Retry from the credential panel."
              className="text-center"
            />
          </div>
        </div>
      </SheetSection>
    </div>
  );
}
