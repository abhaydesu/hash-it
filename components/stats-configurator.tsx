"use client";

import React, { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff } from "lucide-react";
import { saveStatsPreferences } from "@/app/actions/settings-actions";
import { DEFAULT_STATS_PREFERENCES, resolveSectionLayout, type StatsPreferences } from "@/lib/stats-preferences";
import { SheetSection } from "@/components/ui/sheet-section";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Row = { id: string; label: string; visible: boolean };

export function StatsConfigurator({
  sections,
  preferences,
  onClose,
}: {
  sections: { id: string; label: string }[];
  preferences: StatsPreferences;
  onClose: () => void;
}) {
  const labelOf = (id: string) => sections.find((s) => s.id === id)?.label ?? id;
  const buildRows = (prefs: StatsPreferences): Row[] =>
    resolveSectionLayout(sections.map((s) => s.id), prefs).map((r) => ({ ...r, label: labelOf(r.id) }));

  const [rows, setRows] = useState<Row[]>(() => buildRows(preferences));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggle = (id: string) =>
    setRows((prev) => {
      const row = prev.find((r) => r.id === id)!;
      const rest = prev.filter((r) => r.id !== id);
      const next = { ...row, visible: !row.visible };
      // Keep visible rows on top in display order; a re-shown row joins the end of the visible block.
      const lastVisible = rest.filter((r) => r.visible).length;
      return next.visible ? [...rest.slice(0, lastVisible), next, ...rest.slice(lastVisible)] : [...rest, next];
    });

  const move = (index: number, direction: -1 | 1) =>
    setRows((prev) => {
      const next = [...prev];
      [next[index], next[index + direction]] = [next[index + direction], next[index]];
      return next;
    });

  const save = () => {
    setError(null);
    startTransition(async () => {
      try {
        await saveStatsPreferences({
          visibleSections: rows.filter((r) => r.visible).map((r) => r.id),
          hiddenSections: rows.filter((r) => !r.visible).map((r) => r.id),
        });
        onClose();
      } catch {
        setError("Couldn't save your layout. Try again.");
      }
    });
  };

  const visibleCount = rows.filter((r) => r.visible).length;

  return (
    <SheetSection innerClassName="space-y-4 py-5" band="neutral">
      <div>
        <h2 className="type-heading text-foreground">Customize sections</h2>
        <p className="type-caption">Choose what shows below the activity heatmap and in what order.</p>
      </div>

      <ul className="divide-y divide-border border border-border bg-background">
        {rows.map((row, idx) => (
          <li key={row.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <button
              type="button"
              onClick={() => toggle(row.id)}
              aria-pressed={row.visible}
              className={cn(
                "flex min-w-0 items-center gap-2.5 text-left text-sm transition-colors",
                row.visible ? "text-foreground" : "text-muted-foreground line-through decoration-muted-foreground/40",
              )}
            >
              {row.visible ? <Eye className="h-4 w-4 shrink-0" /> : <EyeOff className="h-4 w-4 shrink-0" />}
              <span className="truncate">{row.label}</span>
            </button>

            {row.visible && (
              <div className="flex shrink-0 items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground"
                  disabled={idx === 0}
                  onClick={() => move(idx, -1)}
                  aria-label={`Move ${row.label} up`}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground"
                  disabled={idx >= visibleCount - 1}
                  onClick={() => move(idx, 1)}
                  aria-label={`Move ${row.label} down`}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {error && <p className="type-caption text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setRows(buildRows(DEFAULT_STATS_PREFERENCES))}
          disabled={isPending}
        >
          Reset to default
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={save} disabled={isPending}>
            {isPending ? "Saving…" : "Save layout"}
          </Button>
        </div>
      </div>
    </SheetSection>
  );
}
