"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useIsMac } from "@/lib/use-is-mac";

// ⌘K / Ctrl K drawn as physical keycaps that go down with the real keys,
// inspired by xevrion/ui-lab's keycap hint. Styling lives in `.keycap`.

/** Keys held right now for the mod+`letter` chord: [mod, letter]. */
function useChordKeys(letter: string, isMac: boolean | null) {
  const [held, setHeld] = useState<[boolean, boolean]>([false, false]);

  useEffect(() => {
    if (isMac === null) return;
    const modKey = isMac ? "Meta" : "Control";
    // e.code, not e.key, so Shift or a non-Latin layout still lights the cap.
    const isLetter = (e: KeyboardEvent) =>
      e.code === `Key${letter.toUpperCase()}` || e.key.toLowerCase() === letter;

    const down = (e: KeyboardEvent) => {
      if (e.key === modKey) setHeld(([, l]) => [true, l]);
      else if (isLetter(e) && (isMac ? e.metaKey : e.ctrlKey)) setHeld([true, true]);
    };
    const up = (e: KeyboardEvent) => {
      // macOS never sends keyup for other keys while Command is held, so
      // letting go of Command has to release everything.
      if (e.key === modKey) setHeld([false, false]);
      else if (isLetter(e)) setHeld(([m]) => [m, false]);
    };
    // A keyup that lands in another window never arrives.
    const reset = () => setHeld([false, false]);

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", reset);
    };
  }, [letter, isMac]);

  return held;
}

export function ShortcutKeycaps({
  letter = "k",
  pressed = false,
  className,
}: {
  letter?: string;
  /** Force both caps down, e.g. while the owning button is pointer-pressed. */
  pressed?: boolean;
  className?: string;
}) {
  const isMac = useIsMac();
  const [modHeld, letterHeld] = useChordKeys(letter, isMac);

  return (
    <span className={cn("inline-flex items-center gap-0.5 pb-0.5", className)}>
      {isMac !== null && <span className="sr-only">{isMac ? "Command K" : "Control K"}</span>}
      {/* Until the platform is known the caps hold their space unseen, so a Mac
          never flashes "Ctrl" on load. */}
      <span aria-hidden className={cn("inline-flex items-center gap-0.5", isMac === null && "invisible")}>
        <span className="keycap" data-pressed={modHeld || pressed || undefined}>
          {isMac ? <span className="text-[11px]">⌘</span> : isMac === false ? "Ctrl" : "⌘"}
        </span>
        <span className="keycap font-mono" data-pressed={letterHeld || pressed || undefined}>
          {letter.toUpperCase()}
        </span>
      </span>
    </span>
  );
}
