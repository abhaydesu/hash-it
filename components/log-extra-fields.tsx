"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { AddFieldForm } from "@/components/add-field-form";
import { CustomFieldInputs, type CustomDraft } from "@/components/custom-field-inputs";
import { filterNonOverlappingFields, type CustomFieldDef } from "@/lib/custom-fields";

const inputClass =
  "w-full border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

/**
 * The optional part of the log form: Source (once the user tracks one), their own
 * columns, and a quick way to add a new column without leaving the form.
 */
export function LogExtraFields({
  fields,
  onFieldsChange,
  values,
  onValuesChange,
  sources,
  showSource,
  onShowSource,
  source,
  onSourceChange,
}: {
  fields: CustomFieldDef[];
  onFieldsChange: (fields: CustomFieldDef[]) => void;
  values: CustomDraft;
  onValuesChange: (next: CustomDraft) => void;
  sources: string[];
  showSource: boolean;
  onShowSource: () => void;
  source: string;
  onSourceChange: (v: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-3">
      {showSource && (
        <div className="space-y-1">
          <label htmlFor="log-source" className="block text-[11px] font-medium text-muted-foreground">
            Source
          </label>
          <input
            id="log-source"
            type="text"
            list="log-source-opts"
            maxLength={200}
            value={source}
            onChange={(e) => onSourceChange(e.target.value)}
            placeholder="e.g. Blind 75, NeetCode 150, contest…"
            className={inputClass}
          />
          <datalist id="log-source-opts">
            {sources.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      )}

      <CustomFieldInputs fields={fields} values={values} onChange={onValuesChange} />

      {adding ? (
        <AddFieldForm
          onAdded={(defs) => {
            onFieldsChange(filterNonOverlappingFields(defs));
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
          onSourceLabel={() => {
            onShowSource();
            setAdding(false);
          }}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus className="h-3 w-3" /> Add a field
          </button>
          {!showSource && (
            <button
              type="button"
              onClick={onShowSource}
              className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <Plus className="h-3 w-3" /> Source
            </button>
          )}
        </div>
      )}
    </div>
  );
}
