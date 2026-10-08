"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { AddFieldForm } from "@/components/add-field-form";
import { CustomFieldInputs, type CustomDraft } from "@/components/custom-field-inputs";
import { TagCombobox } from "@/components/ui/tag-combobox";
import { filterNonOverlappingFields, type CustomFieldDef } from "@/lib/custom-fields";

const splitSources = (source: string) =>
  source
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * The optional part of the log form: anything passed as `leading` (the pattern picker),
 * Source, the user's own columns, and a way to add a new column without leaving the form.
 */
export function LogExtraFields({
  fields,
  onFieldsChange,
  values,
  onValuesChange,
  sources,
  source,
  onSourceChange,
  leading,
}: {
  fields: CustomFieldDef[];
  onFieldsChange: (fields: CustomFieldDef[]) => void;
  values: CustomDraft;
  onValuesChange: (next: CustomDraft) => void;
  sources: string[];
  source: string;
  onSourceChange: (v: string) => void;
  leading?: React.ReactNode;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-4">
      {leading}

      <TagCombobox
        id="log-source"
        label="Source / list"
        noun="source"
        optional
        tags={splitSources(source)}
        onTagsChange={(next) => onSourceChange(next.join(", "))}
        options={sources}
        allowCreate
        showOnFocus
        maxLength={200}
        placeholder="Blind 75, NeetCode 150, a contest…"
      />

      <CustomFieldInputs fields={fields} values={values} onChange={onValuesChange} />

      {adding ? (
        <AddFieldForm
          onAdded={(defs) => {
            onFieldsChange(filterNonOverlappingFields(defs));
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
          // "Source" is built in and always shown above.
          onSourceLabel={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="pressable flex w-full items-center justify-center gap-1.5 border border-dashed border-border py-2 text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Add a custom field
        </button>
      )}
    </div>
  );
}
