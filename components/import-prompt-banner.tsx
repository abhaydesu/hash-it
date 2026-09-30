"use client";
import React, { useState, useTransition } from "react";
import Link from "next/link";
import { FileUp } from "lucide-react";
import { dismissImportPrompt } from "@/app/actions/import-actions";
import { SheetSection } from "@/components/ui/sheet-section";

const COLLAPSE_MS = 300;

/** New-user nudge on /today. "Nothing to import" is remembered on the account. */
export function ImportPromptBanner() {
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  if (gone) return null;

  const dismiss = () => {
    setError(false);
    startTransition(async () => {
      try {
        await dismissImportPrompt();
        setLeaving(true);
        window.setTimeout(() => setGone(true), COLLAPSE_MS);
      } catch {
        setError(true);
      }
    });
  };

  return (
    <SheetSection innerClassName="py-4">
      <div className="collapsible" data-leaving={leaving || undefined}>
        <div className="flex flex-col gap-4 border border-orange-500/40 bg-orange-50/50 px-4 py-4 dark:bg-orange-500/5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <FileUp className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" aria-hidden />
            <div className="space-y-1">
              <h2 className="text-sm font-medium text-foreground">Already solved problems on LeetCode?</h2>
              <p className="type-caption">
                Import them from a screenshot or a spreadsheet and your reviews start right away.
              </p>
              {error && <p className="type-caption text-destructive">Couldn&apos;t save that. Try again.</p>}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href="/import"
              className="pressable inline-flex h-8 items-center border border-orange-500 bg-orange-500 px-3 text-xs font-medium text-white hover:bg-orange-600"
            >
              Yes, take me there
            </Link>
            <button
              type="button"
              onClick={dismiss}
              disabled={pending}
              className="pressable inline-flex h-8 items-center border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
            >
              Nothing to import
            </button>
          </div>
        </div>
      </div>
    </SheetSection>
  );
}
