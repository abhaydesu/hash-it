import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";
import { isSafeCallbackPath } from "@/lib/safe";

const { auth } = NextAuth(authConfig);

/** Paths that skip session checks. Everything else requires an authenticated user. */
export const PUBLIC_PATHS = [
  "/",
  "/auth/signin",
  "/auth/error",
  "/api/auth",
  "/api/cron",
  "/favicon.ico",
  "/icon.svg",
  "/logo-1.svg",
  "/logo-2.svg",
] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => p === pathname || (p !== "/" && pathname.startsWith(p)));
}

/**
 * Session gate used by middleware. Independent of whether OAuth env vars are set —
 * missing OAuth must not open protected routes; it only prevents sign-in.
 */
export function authorizeRequest(opts: {
  pathname: string;
  hasUser: boolean;
  requestUrl: string;
}): NextResponse {
  const { pathname, hasUser, requestUrl } = opts;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!hasUser) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const signInUrl = new URL("/auth/signin", requestUrl);
    signInUrl.searchParams.set("callbackUrl", isSafeCallbackPath(pathname) ? pathname : "/");
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export default auth((req) => {
  const pathname = req.nextUrl.pathname;
  return authorizeRequest({
    pathname,
    hasUser: Boolean(req.auth?.user),
    requestUrl: req.url,
  });
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};
