"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { CustomFieldDef, CustomValue } from "@/lib/custom-fields";

/** Draft values while editing: `null` means "clear this field". */
export type CustomDraft = Record<string, CustomValue | null>;

const inputClass =
  "w-full border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

/** One input per user-defined field, matched to its type. */
export function CustomFieldInputs({
  fields,
  values,
  onChange,
  className,
}: {
  fields: CustomFieldDef[];
  values: CustomDraft;
  onChange: (next: CustomDraft) => void;
  className?: string;
}) {
  if (fields.length === 0) return null;
  const set = (id: string, v: CustomValue | null) => onChange({ ...values, [id]: v });

  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2", className)}>
      {fields.map((f) => {
        const v = values[f.id];
        const id = `cf-${f.id}`;
        return (
          <div key={f.id} className={cn("space-y-1", f.type === "text" && "sm:col-span-2")}>
            <label htmlFor={id} className="block text-[11px] font-medium text-muted-foreground">
              {f.label}
            </label>
            {f.type === "boolean" ? (
              <label className="flex h-[30px] cursor-pointer items-center gap-2 text-xs text-foreground">
                <input
                  id={id}
                  type="checkbox"
                  checked={v === true}
                  onChange={(e) => set(f.id, e.target.checked ? true : null)}
                  className="h-3.5 w-3.5 accent-orange-500"
                />
                Yes
              </label>
            ) : f.type === "select" ? (
              <>
                <input
                  id={id}
                  type="text"
                  list={`${id}-opts`}
                  value={typeof v === "string" ? v : ""}
                  onChange={(e) => set(f.id, e.target.value || null)}
                  placeholder="Pick or type new..."
                  className={inputClass}
                />
                <datalist id={`${id}-opts`}>
                  {f.options?.map((o) => (
                    <option key={o} value={o} />
                  ))}
                </datalist>
              </>
            ) : f.type === "number" ? (
              <input
                id={id}
                type="number"
                inputMode="decimal"
                value={typeof v === "number" ? v : ""}
                onChange={(e) => set(f.id, e.target.value === "" ? null : Number(e.target.value))}
                className={cn(inputClass, "tabular-numbers")}
              />
            ) : f.type === "date" ? (
              <input
                id={id}
                type="date"
                value={typeof v === "string" ? v : ""}
                onChange={(e) => set(f.id, e.target.value || null)}
                className={inputClass}
              />
            ) : (
              <input
                id={id}
                type="text"
                maxLength={2000}
                value={typeof v === "string" ? v : v == null ? "" : String(v)}
                onChange={(e) => set(f.id, e.target.value || null)}
                className={inputClass}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
