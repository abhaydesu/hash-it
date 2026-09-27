"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { addCustomField } from "@/app/actions/settings-actions";
import { TYPE_LABELS } from "@/components/import/column-mapper";
import { CUSTOM_FIELD_TYPES, isSourceLabel, type CustomFieldDef, type CustomFieldType } from "@/lib/custom-fields";
import { cn } from "@/lib/utils";

// Fixed height so the text input, select and buttons line up exactly.
const controlClass = "h-8 shrink-0 whitespace-nowrap border px-2.5 text-xs";
const inputClass =
  "h-8 w-full min-w-0 border border-border bg-background px-2 py-0 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

/**
 * Name + type → a new custom column. Used from the log form and the problems table.
 * "Source" is built in, so it's routed to `onSourceLabel` instead of becoming a duplicate column.
 */
export function AddFieldForm({
  onAdded,
  onCancel,
  onSourceLabel,
  variant = "inline",
  className,
}: {
  onAdded: (fields: CustomFieldDef[]) => void;
  onCancel: () => void;
  onSourceLabel?: () => void;
  /** "inline" sits inside a form (dashed outline); "popover" floats over content. */
  variant?: "inline" | "popover";
  className?: string;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<CustomFieldType>("text");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    if (isSourceLabel(trimmed)) {
      if (onSourceLabel) onSourceLabel();
      else setError("Source is built in — set it when logging a problem.");
      return;
    }
    startTransition(async () => {
      try {
        onAdded(await addCustomField({ label: trimmed, type }));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  };

  return (
    <div
      className={cn(
        "space-y-2.5 bg-background p-3",
        variant === "inline" ? "border border-dashed border-border" : "border border-border shadow-lg",
        className,
      )}
    >
      <div className="flex gap-2">
        <input
          autoFocus
          type="text"
          maxLength={60}
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
              e.preventDefault();
              e.stopPropagation();
              submit();
            } else if (e.key === "Escape") {
              e.stopPropagation();
              onCancel();
            }
          }}
          placeholder="Field name, e.g. Company"
          aria-label="New field name"
          className={inputClass}
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as CustomFieldType)}
          aria-label="New field type"
          className={cn(inputClass, "w-28 shrink-0 pr-7")}
        >
          {CUSTOM_FIELD_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/settings#custom-fields"
          className="truncate text-[11px] font-normal text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Manage columns
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={cn(controlClass, "pressable border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground")}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isPending || !label.trim()}
            className={cn(controlClass, "pressable border-primary bg-primary font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50")}
          >
            {isPending ? "Adding…" : "Add field"}
          </button>
        </div>
      </div>
    </div>
  );
}
