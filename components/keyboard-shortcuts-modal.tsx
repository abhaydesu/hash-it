"use client";
import React from 'react';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Keyboard } from "lucide-react";
import { useIsMac } from "@/lib/use-is-mac";

export function KeyboardShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const isMac = useIsMac();

  useEffect(() => {
    let pendingG = false;
    let gTimeout: NodeJS.Timeout;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;

      if (e.key === "?" && !isInput) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        setIsOpen(false);
        return;
      }

      if (isInput) return;

      if (e.key === "g" && !pendingG) {
        pendingG = true;
        clearTimeout(gTimeout);
        gTimeout = setTimeout(() => {
          pendingG = false;
        }, 1000);
        return;
      }

      if (pendingG) {
        pendingG = false;
        clearTimeout(gTimeout);
        if (e.key === "t") router.push("/today");
        else if (e.key === "p") router.push("/problems");
        else if (e.key === "s") router.push("/stats");
        else if (e.key === "i") router.push("/import");
        else if (e.key === "w") router.push("/review/weekly");
        else if (e.key === "m") router.push("/review/monthly");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, router]);

  if (!isOpen) return null;

  const shortcuts = [
    { key: isMac ? "⌘K" : "Ctrl+K", desc: "Open global problem log bar" },
    { key: "?", desc: "Toggle keyboard shortcuts guide" },
    { key: "g t", desc: "Go to Today dashboard" },
    { key: "g p", desc: "Go to Problems catalog" },
    { key: "g s", desc: "Go to Stats" },
    { key: "g w", desc: "Go to Weekly review" },
    { key: "g m", desc: "Go to Monthly review" },
    { key: "g i", desc: "Go to CSV Import" },
    { key: "1 / 2 / 3", desc: "Select Solve Status (Unaided / With Help / Failed)" },
    { key: isMac ? "⌘ + Enter" : "Ctrl + Enter", desc: "Submit and save problem log" },
    { key: "Esc", desc: "Dismiss modals or command bar" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsOpen(false);
      }}
    >
      <div
        className="w-full max-w-lg border border-border bg-background p-5 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2 text-foreground">
            <Keyboard className="h-4 w-4 text-muted-foreground" />
            <h2 id="shortcuts-title" className="text-sm font-semibold tracking-tight">
              Keyboard shortcuts
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="pressable p-1 text-muted-foreground hover:text-foreground"
            aria-label="Close shortcuts"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-1.5 text-xs">
          {shortcuts.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between px-2 py-1.5"
            >
              <span className="text-muted-foreground">{s.desc}</span>
              <kbd className="border border-border bg-muted/50 px-2 py-0.5 text-foreground font-mono text-[11px]">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-4 border-t border-border pt-3 text-right">
          <span className="text-xs text-muted-foreground">Press Esc to close</span>
        </div>
      </div>
    </div>
  );
}
