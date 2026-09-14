"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Keyboard } from "lucide-react";

export function KeyboardShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let pendingG = false;
    let gTimeout: NodeJS.Timeout;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when user is typing in an input/textarea
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

      // Sequential 'g' shortcuts: g then t, g then p, etc.
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
    { key: "Cmd/Ctrl + K", desc: "Open global problem add bar" },
    { key: "?", desc: "Toggle this shortcut guide" },
    { key: "g  t", desc: "Go to Today dashboard" },
    { key: "g  p", desc: "Go to Problems" },
    { key: "g  s", desc: "Go to Stats" },
    { key: "g  w", desc: "Go to Weekly review" },
    { key: "g  m", desc: "Go to Monthly review" },
    { key: "g  i", desc: "Go to CSV Import" },
    { key: "1 / 2 / 3", desc: "Select Solve Status (Unaided / With Help / Failed)" },
    { key: "Cmd + Enter", desc: "Submit and save problem log" },
    { key: "Escape", desc: "Dismiss modals or command bar" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-lg border border-zinc-800 bg-zinc-950 p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-100">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2 text-zinc-200">
            <Keyboard className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold tracking-wide uppercase font-mono">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-2 text-xs">
          {shortcuts.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between rounded px-2.5 py-1.5 hover:bg-zinc-900/80 font-mono"
            >
              <span className="text-zinc-400 font-sans">{s.desc}</span>
              <kbd className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-zinc-200 text-[11px]">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-5 border-t border-zinc-900 pt-3 text-right">
          <span className="text-[11px] text-zinc-500 font-mono">Press Esc to close</span>
        </div>
      </div>
    </div>
  );
}
