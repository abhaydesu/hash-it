"use client";
import React from "react";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { SheetSection } from "@/components/ui/sheet-section";
import { MonthlyMockNavControls } from "@/components/monthly-mock-nav";

interface NavbarProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  userMenu?: ReactNode;
}

const navItems = [
  { href: "/today", label: "Today" },
  { href: "/problems", label: "Problems" },
  { href: "/roadmap", label: "Roadmap" },
  { href: "/review/weekly", label: "Weekly review" },
  { href: "/review/monthly", label: "Monthly review" },
  { href: "/stats", label: "Stats" },
  { href: "/import", label: "Import" },
  { href: "/settings", label: "Settings" },
];

export function SidebarNav() {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  if (pathname === "/" || pathname === "/auth/signin") {
    return null;
  }

  return (
    <SheetSection className="bg-background/95 backdrop-blur-sm" band="none">
      <nav className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-none text-xs">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const isPending = pendingHref === item.href && !isActive;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                if (!isActive) setPendingHref(item.href);
              }}
              className={cn(
                "whitespace-nowrap border px-2.5 py-1 transition-colors",
                isActive
                  ? "border-orange-500 bg-orange-50 text-orange-700 font-medium dark:bg-orange-500/10 dark:text-orange-400"
                  : "border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                isPending && "bg-muted/60 text-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </SheetSection>
  );
}

export function Navbar({ user, userMenu }: NavbarProps) {
  const pathname = usePathname();
  const isMarketingPage = pathname === "/" || pathname === "/auth/signin";

  return (
    <header className="sticky top-0 z-40 w-full bg-background/95 backdrop-blur-sm">
      <SheetSection band="none">
        <div className="flex h-14 items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-orange-600 transition-colors hover:text-orange-700"
          >
            <Image src="/logo-2.svg" alt="" width={24} height={24} className="h-6 w-6 object-contain dark:hidden" />
            <Image src="/logo-1.svg" alt="" width={24} height={24} className="hidden h-6 w-6 object-contain dark:block" />
          </Link>

          <div className="flex items-center gap-2">
            {!isMarketingPage && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("open-command-bar"));
                  }}
                  className="hidden h-8 items-center gap-2 border border-border bg-background px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground sm:flex"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span className="font-medium">Log problem</span>
                  <kbd className="border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    ⌘K
                  </kbd>
                </button>
              </>
            )}

            {isMarketingPage && (
              <Link
                href="/today"
                className="hidden h-8 items-center border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground sm:inline-flex"
              >
                Dashboard
              </Link>
            )}

            {!isMarketingPage && <MonthlyMockNavControls />}

            <ThemeToggle className="h-8 w-8" />

            {userMenu ??
              (user ? (
                <UserMenu user={user} />
              ) : (
                <Link
                  href="/auth/signin"
                  className="inline-flex h-8 items-center border border-orange-500 bg-orange-500 px-2.5 text-xs font-medium text-white transition-colors hover:bg-orange-600"
                >
                  Sign in
                </Link>
              ))}
          </div>
        </div>
      </SheetSection>
    </header>
  );
}
