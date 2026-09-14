import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/", "/auth/signin", "/api/auth", "/favicon.ico"];

export default auth((req: NextRequest & { auth: any }) => {
  const pathname = req.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => p === pathname || (p !== "/" && pathname.startsWith(p)));

  if (isPublic) return NextResponse.next();

  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && !req.auth?.user) {
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
