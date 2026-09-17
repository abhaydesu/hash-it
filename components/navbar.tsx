"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { SheetSection } from "@/components/ui/sheet-section";
import { Logo } from "@/components/logo";

interface NavbarProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
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

  if (pathname === "/" || pathname === "/auth/signin") {
    return null;
  }

  return (
    <SheetSection className="bg-background/95 backdrop-blur-sm">
      <nav>
        <div className="flex items-center gap-1 overflow-x-auto px-4 sm:px-6 py-2 scrollbar-none text-xs">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "whitespace-nowrap px-2.5 py-1 transition-colors border text-xs",
                isActive
                  ? "border-orange-500 bg-orange-50 text-orange-700 font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              {item.label}
            </Link>
          );
        })}
        </div>
      </nav>
    </SheetSection>
  );
}

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const isLandingPage = pathname === "/";

  return (
    <header className="sticky top-0 z-40 w-full bg-background/95 backdrop-blur-sm">
      <SheetSection>
        <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-foreground transition-colors hover:opacity-80">
          <Logo className="h-6 w-6" />
        </Link>

        <div className="flex items-center gap-2">
          {!isLandingPage && (
            <>
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("open-command-bar"));
                }}
                className="hidden items-center gap-2 border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground sm:flex transition-colors"
              >
                <Search className="h-3.5 w-3.5" />
                <span className="font-medium">Log problem</span>
                <kbd className="border border-border bg-muted px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">⌘K</kbd>
              </button>

              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }));
                }}
                className="hidden h-7 w-7 items-center justify-center border border-border bg-background text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground sm:flex transition-colors"
                title="Keyboard shortcuts (?)"
              >
                ?
              </button>
            </>
          )}

          {isLandingPage && (
            <Link
              href="/roadmap"
              className="hidden border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground sm:inline-flex transition-colors"
            >
              Roadmap
            </Link>
          )}

          <ThemeToggle className="h-7 w-7" />

          {user ? (
            <UserMenu user={user} />
          ) : (
            <Link
              href="/auth/signin"
              className="border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors inline-flex items-center"
            >
              Sign in
            </Link>
          )}
        </div>
        </div>
      </SheetSection>
    </header>
  );
}
