"use client";

import React, { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteCustomField, updateCustomField } from "@/app/actions/settings-actions";
import { TYPE_LABELS } from "@/components/import/column-mapper";
import { MAX_SELECT_OPTIONS, type CustomFieldDef } from "@/lib/custom-fields";
import { cn } from "@/lib/utils";

const controlClass = "h-8 shrink-0 whitespace-nowrap border px-2.5 text-xs";
const inputClass =
  "h-8 w-full min-w-0 border border-border bg-background px-2 py-0 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";
const labelClass = "block text-[11px] font-medium text-muted-foreground";

/** Rename / edit options / delete one custom column. Type is fixed (values are stored by type). */
export function EditFieldForm({
  field,
  onDone,
  onCancel,
}: {
  field: CustomFieldDef;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(field.label);
  const [options, setOptions] = useState((field.options ?? []).join(", "));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (action: () => Promise<unknown>) =>
    startTransition(async () => {
      try {
        await action();
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });

  const save = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const parsed = options.split(",").map((o) => o.trim()).filter(Boolean);
    if (parsed.length > MAX_SELECT_OPTIONS) {
      setError(`At most ${MAX_SELECT_OPTIONS} options.`);
      return;
    }
    run(() => updateCustomField(field.id, { label: trimmed, ...(field.type === "select" ? { options: parsed } : {}) }));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      save();
    } else if (e.key === "Escape") {
      e.stopPropagation();
      onCancel();
    }
  };

  if (confirmDelete) {
    return (
      <div className="space-y-2.5 border border-border bg-background p-3 shadow-lg">
        <p className="text-xs text-foreground">
          Delete <span className="font-medium">{field.label}</span>?
        </p>
        <p className="text-[11px] text-muted-foreground">
          The column disappears everywhere. Values stay saved and return if you add a column with the same name.
        </p>
        {error && <p className="text-[11px] text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className={cn(controlClass, "pressable border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground")}
          >
            Keep
          </button>
          <button
            type="button"
            autoFocus
            disabled={isPending}
            onClick={() => run(() => deleteCustomField(field.id))}
            className={cn(controlClass, "pressable border-destructive bg-destructive font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50")}
          >
            {isPending ? "Deleting…" : "Delete column"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 border border-border bg-background p-3 shadow-lg">
      <div className="space-y-1">
        <label htmlFor={`edit-${field.id}`} className={labelClass}>
          Name <span className="font-normal text-muted-foreground/70">· {TYPE_LABELS[field.type]}</span>
        </label>
        <input
          id={`edit-${field.id}`}
          autoFocus
          type="text"
          maxLength={60}
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            setError(null);
          }}
          onKeyDown={onKeyDown}
          className={inputClass}
        />
      </div>

      {field.type === "select" && (
        <div className="space-y-1">
          <label htmlFor={`edit-${field.id}-opts`} className={labelClass}>
            Options <span className="font-normal text-muted-foreground/70">· comma-separated</span>
          </label>
          <input
            id={`edit-${field.id}-opts`}
            type="text"
            value={options}
            onChange={(e) => {
              setOptions(e.target.value);
              setError(null);
            }}
            onKeyDown={onKeyDown}
            placeholder="Google, Meta, Amazon"
            className={inputClass}
          />
        </div>
      )}

      {error && <p className="text-[11px] text-destructive">{error}</p>}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" /> Delete
        </button>
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
            onClick={save}
            disabled={isPending || !label.trim()}
            className={cn(controlClass, "pressable border-primary bg-primary font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50")}
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
