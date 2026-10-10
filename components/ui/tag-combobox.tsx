"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagComboboxProps {
  id: string;
  label: string;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  /** Known values to suggest, most relevant first. */
  options?: string[];
  /** Custom ranking of suggestions; replaces the default substring filter. */
  getSuggestions?: (draft: string, tags: string[]) => string[];
  /** Turn typed text into the tags to add (default: split on separators and trim). */
  normalize?: (raw: string) => string[];
  /** Offer "Add “text”" when the draft isn't an existing option. */
  allowCreate?: boolean;
  /** Show every option on focus, before anything is typed. */
  showOnFocus?: boolean;
  placeholder: string;
  maxLength?: number;
  /** Singular noun for remove buttons, e.g. "source". */
  noun?: string;
  optional?: boolean;
}

const SEPARATORS = /[,;|]/;

const defaultNormalize = (raw: string) =>
  raw
    .split(SEPARATORS)
    .map((part) => part.trim())
    .filter(Boolean);

/**
 * Multi-value text field with a suggestion list, following the ARIA combobox pattern:
 * focus stays in the input, arrow keys move a highlight (aria-activedescendant) without
 * changing the value, Enter/Tab commit, Escape closes the list.
 */
export function TagCombobox({
  id,
  label,
  tags,
  onTagsChange,
  options = [],
  getSuggestions,
  normalize = defaultNormalize,
  allowCreate = false,
  showOnFocus = false,
  placeholder,
  maxLength,
  noun = "tag",
  optional = false,
}: TagComboboxProps) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = `${id}-list`;
  const optionId = (i: number) => `${id}-option-${i}`;

  const trimmed = draft.trim();
  const suggestions = useMemo(() => {
    if (getSuggestions) return trimmed ? getSuggestions(trimmed, tags) : [];
    const taken = new Set(tags.map((t) => t.toLowerCase()));
    const q = trimmed.toLowerCase();
    return options.filter((o) => !taken.has(o.toLowerCase()) && (!q || o.toLowerCase().includes(q)));
  }, [getSuggestions, options, tags, trimmed]);

  const canCreate =
    allowCreate && trimmed.length > 0 && !suggestions.some((s) => s.toLowerCase() === trimmed.toLowerCase());
  const rows = canCreate ? [...suggestions, trimmed] : suggestions;
  const showList = open && rows.length > 0 && (showOnFocus || trimmed.length > 0);

  // Keep the highlighted option visible when arrowing through a long list.
  useEffect(() => {
    if (active >= 0) document.getElementById(optionId(active))?.scrollIntoView?.({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const commit = (raw: string) => {
    const next = [...tags];
    const seen = new Set(next.map((t) => t.toLowerCase()));
    for (const part of normalize(raw)) {
      if (seen.has(part.toLowerCase())) continue;
      seen.add(part.toLowerCase());
      next.push(part);
    }
    if (next.length !== tags.length) onTagsChange(next);
    setDraft("");
    setActive(-1);
  };

  const removeTag = (index: number) => onTagsChange(tags.filter((_, i) => i !== index));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (rows.length === 0) return;
      e.preventDefault();
      if (!showList) {
        setOpen(true);
        setActive(e.key === "ArrowDown" ? 0 : rows.length - 1);
        return;
      }
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i < 0 ? (step === 1 ? 0 : rows.length - 1) : (i + step + rows.length) % rows.length));
    } else if (e.key === "Escape" && showList) {
      e.stopPropagation();
      setOpen(false);
      setActive(-1);
    } else if (
      (e.key === "Enter" || e.key === "Tab") &&
      !e.metaKey &&
      !e.ctrlKey &&
      (trimmed || (showList && active >= 0))
    ) {
      e.preventDefault();
      // Enter takes the highlighted row, otherwise what was typed. Tab takes the top suggestion.
      const pick = showList && active >= 0 ? rows[active] : e.key === "Tab" ? suggestions[0] : undefined;
      commit(pick ?? draft);
      setOpen(false);
    } else if (e.key === "Backspace" && !draft && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div className="relative space-y-1.5">
      <label htmlFor={id} className="flex items-baseline gap-1.5 text-xs font-medium text-foreground">
        {label}
        {optional && <span className="font-normal text-muted-foreground">optional</span>}
      </label>
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex min-h-9 cursor-text flex-wrap items-center gap-1.5 border border-border bg-background px-2 py-1 transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary"
      >
        {tags.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="inline-flex max-w-full items-center gap-1 border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-xs text-foreground"
          >
            <span className="truncate">{tag}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(index);
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Remove ${noun} ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
          // Our list replaces the browser's: no autofill history popup on top of it.
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={draft}
          maxLength={maxLength}
          placeholder={tags.length ? "Add another…" : placeholder}
          onChange={(e) => {
            const value = e.target.value;
            if (SEPARATORS.test(value)) {
              commit(value);
              return;
            }
            setDraft(value);
            setActive(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            setActive(-1);
            if (trimmed) commit(draft);
          }}
          onKeyDown={onKeyDown}
          className="min-w-[8rem] flex-1 bg-transparent py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-44 overflow-y-auto border border-border bg-popover py-1 shadow-lg"
        >
          {rows.map((name, i) => {
            const isCreate = canCreate && i === rows.length - 1;
            return (
              <li
                key={`${name}-${i}`}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                // mousedown (not click) so the input's blur doesn't commit the half-typed draft first.
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(name);
                  setOpen(false);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "cursor-pointer truncate px-3 py-1.5 text-sm",
                  isCreate ? "text-primary" : "text-foreground",
                  i === active && "bg-primary/10"
                )}
              >
                {isCreate ? <>Add &ldquo;{name}&rdquo;</> : name}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
