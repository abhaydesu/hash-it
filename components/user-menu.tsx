"use client";

import { signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { LogOut, Settings, ChevronDown } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function UserMenu({ user }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : (user.email?.[0] ?? "?").toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 rounded-xl border px-2 py-1.5 text-xs transition-all",
          open
            ? "border-border bg-muted text-foreground"
            : "border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground"
        )}
        title={user.email ?? "User"}
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt={user.name ?? "avatar"}
            className="h-4 w-4 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/15 text-[9px] font-bold text-emerald-600 dark:text-emerald-300">
            {initials}
          </span>
        )}
        <span className="hidden max-w-[96px] truncate sm:inline">{user.name ?? user.email ?? "Account"}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-border bg-card/95 p-1 text-xs shadow-xl shadow-slate-900/10 backdrop-blur-md">
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate font-semibold text-foreground">{user.name ?? "User"}</p>
            <p className="truncate text-muted-foreground">{user.email}</p>
          </div>

          <div className="p-1">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </Link>

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/auth/signin" })}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-rose-500 hover:bg-rose-500/10 hover:text-rose-400"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
