import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";
import { isSafeCallbackPath } from "@/lib/safe";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = [
  "/",
  "/auth/signin",
  "/api/auth",
  "/api/cron",
  "/favicon.ico",
  "/icon.svg",
  "/logo-1.svg",
  "/logo-2.svg",
];

export default auth((req) => {
  const pathname = req.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => p === pathname || (p !== "/" && pathname.startsWith(p)));

  if (isPublic) return NextResponse.next();

  if (!req.auth?.user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", isSafeCallbackPath(pathname) ? pathname : "/");
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};
