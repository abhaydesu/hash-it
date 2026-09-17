"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "pressable relative inline-flex items-center justify-center border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className
      )}
      title="Toggle theme"
      aria-label="Toggle theme"
    >
      <Sun className="h-[14px] w-[14px] rotate-0 scale-100 opacity-100 transition-[transform,opacity] duration-press ease-out dark:-rotate-90 dark:scale-95 dark:opacity-0" />
      <Moon className="absolute h-[14px] w-[14px] rotate-90 scale-95 opacity-0 transition-[transform,opacity] duration-press ease-out dark:rotate-0 dark:scale-100 dark:opacity-100" />
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}
