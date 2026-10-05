"use client";

import React, { useState, useRef } from "react";
import { Plus, X } from "lucide-react";
import { AddFieldForm } from "@/components/add-field-form";
import { CustomFieldInputs, type CustomDraft } from "@/components/custom-field-inputs";
import { filterNonOverlappingFields, type CustomFieldDef } from "@/lib/custom-fields";
import { cn } from "@/lib/utils";

function SourceTagsField({
  source,
  onSourceChange,
  sources,
}: {
  source: string;
  onSourceChange: (v: string) => void;
  sources: string[];
}) {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const tags = source
    ? source
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const addTag = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const existingLower = new Set(tags.map((t) => t.toLowerCase()));
    if (!existingLower.has(trimmed.toLowerCase())) {
      const nextTags = [...tags, trimmed];
      onSourceChange(nextTags.join(", "));
    }
    setDraft("");
    setActive(-1);
  };

  const addMultipleTags = (raw: string) => {
    const parts = raw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const existingLower = new Set(tags.map((t) => t.toLowerCase()));
    const nextTags = [...tags];
    for (const p of parts) {
      if (!existingLower.has(p.toLowerCase())) {
        existingLower.add(p.toLowerCase());
        nextTags.push(p);
      }
    }
    onSourceChange(nextTags.join(", "));
    setDraft("");
    setActive(-1);
  };

  const removeTag = (index: number) => {
    const nextTags = tags.filter((_, i) => i !== index);
    onSourceChange(nextTags.join(", "));
  };

  const availableSources = sources.filter(
    (s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase())
  );

  const trimmedDraft = draft.trim();
  const filteredSources = trimmedDraft
    ? availableSources.filter((s) =>
        s.toLowerCase().includes(trimmedDraft.toLowerCase())
      )
    : availableSources;

  const hasExactMatch = filteredSources.some(
    (s) => s.toLowerCase() === trimmedDraft.toLowerCase()
  );
  const showCreateOption = Boolean(trimmedDraft && !hasExactMatch);

  const totalOptionsCount = filteredSources.length + (showCreateOption ? 1 : 0);
  const showList = focused && totalOptionsCount > 0;

  return (
    <div className="space-y-1 text-xs">
      <label htmlFor="log-source" className="block text-[11px] font-medium text-muted-foreground">
        Source / list
      </label>
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex min-h-[34px] flex-wrap items-center gap-1.5 border border-border bg-background px-2 py-1.5 cursor-text focus-within:ring-1 focus-within:ring-ring"
      >
        {tags.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="inline-flex max-w-full items-center gap-1 border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] text-foreground"
          >
            <span className="truncate">{tag}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(index);
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Remove source ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id="log-source"
          type="text"
          value={draft}
          maxLength={200}
          onChange={(e) => {
            const val = e.target.value;
            if (val.includes(",")) {
              addMultipleTags(val);
              return;
            }
            setDraft(val);
            setActive(-1);
          }}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => {
            if (showList && e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => (i + 1) % totalOptionsCount);
            } else if (showList && e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => (i <= 0 ? totalOptionsCount - 1 : i - 1));
            } else if (showList && e.key === "Escape") {
              e.stopPropagation();
              setFocused(false);
            } else if (e.key === "Enter" || e.key === "Tab") {
              if (draft.trim()) {
                e.preventDefault();
                if (active >= 0 && active < filteredSources.length) {
                  addTag(filteredSources[active]);
                } else if (active === filteredSources.length && showCreateOption) {
                  addTag(draft.trim());
                } else if (e.key === "Tab" && filteredSources.length > 0) {
                  addTag(filteredSources[0]);
                } else {
                  addTag(draft.trim());
                }
              }
            } else if (e.key === "Backspace" && !draft && tags.length > 0) {
              removeTag(tags.length - 1);
            }
          }}
          onBlur={() => {
            setFocused(false);
            if (draft.trim()) {
              addTag(draft.trim());
            }
          }}
          placeholder={tags.length ? "Add another source…" : "e.g. Blind 75, NeetCode 150, contest…"}
          className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      {showList && (
        <ul
          role="listbox"
          aria-label="Source suggestions"
          className="max-h-40 overflow-y-auto border border-border bg-background shadow-sm"
        >
          {filteredSources.map((name, i) => (
            <li key={name} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addTag(name);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "block w-full truncate px-2 py-1 text-left text-xs text-foreground",
                  i === active ? "bg-muted" : "hover:bg-muted/60"
                )}
              >
                {name}
              </button>
            </li>
          ))}
          {showCreateOption && (
            <li role="option" aria-selected={active === filteredSources.length}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addTag(draft.trim());
                }}
                onMouseEnter={() => setActive(filteredSources.length)}
                className={cn(
                  "block w-full truncate px-2 py-1 text-left text-xs font-medium text-orange-600 dark:text-orange-400",
                  active === filteredSources.length ? "bg-muted" : "hover:bg-muted/60"
                )}
              >
                + Add &ldquo;{draft.trim()}&rdquo; as source
              </button>
            </li>
          )}
        </ul>
      )}
      <p className="text-[10px] text-muted-foreground">
        Choose from known lists or type any new source and press Enter or comma.
      </p>
    </div>
  );
}

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
        <SourceTagsField
          source={source}
          onSourceChange={onSourceChange}
          sources={sources}
        />
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
