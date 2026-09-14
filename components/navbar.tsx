"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Calendar, Database, BarChart2, Upload, Settings, Target, BookOpen, LayoutGrid, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";

interface NavbarProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
}

const sidebarItems = [
  { href: "/today", label: "Today", icon: Calendar },
  { href: "/problems", label: "Problems", icon: Database },
  { href: "/roadmap", label: "Roadmap", icon: BookOpen },
  { href: "/review/weekly", label: "Weekly Review", icon: Target },
  { href: "/review/monthly", label: "Monthly Review", icon: Sparkles },
  { href: "/stats", label: "Stats", icon: BarChart2 },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();

  if (pathname === "/" || pathname === "/auth/signin") {
    return null;
  }

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border/80 bg-card/80 p-4 lg:block">
      <div className="space-y-2">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors",
                isActive
                  ? "bg-muted text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const isLandingPage = pathname === "/";

  if (isLandingPage) {
    return (
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:text-emerald-600 dark:hover:text-emerald-400">
            <span className="flex h-6 w-6 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 text-xs font-bold text-emerald-600 dark:text-emerald-300 font-pixel">#</span>
            <span className="font-pixel text-sm tracking-[0.18em] text-foreground">HASH_IT</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link href="/auth/signin" className="hidden rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted sm:inline-flex">
              Sign in
            </Link>
            <Link href="/roadmap" className="hidden rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground sm:inline-flex">
              Roadmap
            </Link>
            <ThemeToggle className="h-9 w-9" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:text-emerald-600 dark:hover:text-emerald-400">
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 text-xs font-bold text-emerald-600 dark:text-emerald-300 font-pixel">#</span>
          <span className="font-pixel text-sm tracking-[0.18em] text-foreground">HASH_IT</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("open-command-bar"));
            }}
            className="hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:border-border/80 hover:text-foreground sm:flex"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="font-medium">Log problem</span>
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">⌘K</kbd>
          </button>

          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }));
            }}
            className="hidden h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground sm:flex"
            title="Keyboard shortcuts (?)"
          >
            ?
          </button>

          <ThemeToggle className="h-9 w-9" />

          {user ? (
            <UserMenu user={user} />
          ) : (
            <Link href="/auth/signin" className="hidden rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted sm:inline-flex">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
