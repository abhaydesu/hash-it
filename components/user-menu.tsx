"use client";
import React from 'react';

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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKey);
    };
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
          "pressable flex h-8 items-center gap-1.5 border px-2 text-xs",
          open
            ? "border-border bg-muted text-foreground"
            : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
        title={user.email ?? "User"}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt={user.name ?? "avatar"}
            className="h-4 w-4 object-cover"
          />
        ) : (
          <span className="flex h-4 w-4 items-center justify-center bg-muted text-[9px] font-semibold text-foreground">
            {initials}
          </span>
        )}
        <span className="hidden max-w-[96px] truncate sm:inline">{user.name ?? user.email ?? "Account"}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform duration-popover ease-out", open && "rotate-180")} />
      </button>

      {open && (
        <div className="ui-popover absolute right-0 top-full z-50 mt-1 w-52 border border-border bg-background p-1 text-xs shadow-md" role="menu">
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate font-semibold text-foreground">{user.name ?? "User"}</p>
            <p className="truncate text-muted-foreground">{user.email}</p>
          </div>

          <div className="p-1">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="pressable flex w-full items-center gap-2 px-2.5 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              role="menuitem"
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </Link>

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/auth/signin" })}
              className="pressable flex w-full items-center gap-2 px-2.5 py-1.5 text-destructive hover:bg-destructive/10"
              role="menuitem"
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
