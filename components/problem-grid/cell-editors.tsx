"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Pencil } from "lucide-react";
import { TagCombobox } from "@/components/ui/tag-combobox";
import { CustomFieldInputs, type CustomDraft } from "@/components/custom-field-inputs";
import { formatCustomValue, type CustomFieldDef, type CustomValue } from "@/lib/custom-fields";
import { canonicalPattern, suggestPatterns } from "@/lib/pattern-match";
import { normalizePatternList, patternClayStyle } from "@/lib/utils";
import { updateEntryInline, updateEntryCustomValues } from "@/app/actions/entry-actions";
import { getLogFormConfig } from "@/app/actions/settings-actions";

const GRID_EDIT_EVENT = "grid-cell-edit";

export function broadcastEditStart(cellId: string) {
  window.dispatchEvent(new CustomEvent(GRID_EDIT_EVENT, { detail: { cellId } }));
}

/** Close this cell's editor when another cell starts editing, so only one is ever open. */
export function useCloseOnOtherEdit(cellId: React.RefObject<string | null>, onClose: () => void) {
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail?.cellId !== cellId.current) onClose();
    };
    window.addEventListener(GRID_EDIT_EVENT, handler);
    return () => window.removeEventListener(GRID_EDIT_EVENT, handler);
  }, [cellId, onClose]);
}

const PANEL_WIDTH = 352;

/**
 * The shared edit dialog for every grid cell: a trigger plus a floating panel with a field-specific
 * body and one Cancel / Save footer. The body is a render prop so each field type brings its own control.
 * Fixed-positioned in a portal because the table's scroll container would clip an absolute panel.
 */
function CellDialog({
  cellId,
  label,
  trigger,
  triggerLabel,
  triggerClassName,
  startInEdit,
  readView,
  editView,
  dirty,
  onSave,
  onOpen,
}: {
  cellId: string;
  label: string;
  trigger: React.ReactNode;
  triggerLabel: string;
  triggerClassName?: string;
  /** Open straight into the editor (empty cells) instead of a read-only view. */
  startInEdit: boolean;
  /** Read-only content shown first when the cell already has a value. */
  readView?: React.ReactNode;
  editView: React.ReactNode;
  dirty: boolean;
  /** Persist the draft. Throw to keep the dialog open and show the error. */
  onSave: () => Promise<void>;
  /** Called on open so the caller can reset its draft to the stored value. */
  onOpen: () => void;
}) {
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(cellId);
  const open = pos !== null;

  const close = useCallback(() => {
    setPos(null);
    setEditing(false);
    setError(null);
  }, []);

  useCloseOnOtherEdit(idRef, close);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !triggerRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (editing && !startInEdit) setEditing(false);
      else close();
    };
    // Scrolling the page would leave the panel adrift from its cell; scrolling inside the panel is fine.
    const onScroll = (e: Event) => {
      if (!panelRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, editing, startInEdit, close]);

  // Flip above the cell when there isn't room below (e.g. the last rows of the grid).
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !panelRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const h = panelRef.current.offsetHeight;
    const below = window.innerHeight - r.bottom - 8;
    const flip = below < h && r.top > below;
    const next = flip ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 };
    setPos((p) => (p && p.top === next.top && p.bottom === next.bottom ? p : { ...next, left: p!.left }));
  }, [open, editing]);

  const toggle = () => {
    if (open) return close();
    broadcastEditStart(idRef.current);
    onOpen();
    const r = triggerRef.current!.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 16);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    setError(null);
    setEditing(startInEdit);
    setPos({ top: r.bottom + 4, left });
  };

  const save = async () => {
    if (saving || !dirty) return;
    setSaving(true);
    setError(null);
    try {
      await onSave();
      close();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const showEdit = editing || !readView;

  return (
    <div className="relative min-w-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={triggerLabel}
        className={triggerClassName}
      >
        {trigger}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={`Edit ${label}`}
            style={pos}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void save();
              }
            }}
            className="fixed z-50 w-[min(22rem,calc(100vw-16px))] border border-border bg-background shadow-lg"
          >
            {showEdit ? (
              <>
                <div className="px-3 pb-2 pt-3">{editView}</div>
                {error && (
                  <p role="alert" className="px-3 pb-2 text-xs text-hard">
                    {error}
                  </p>
                )}
                <div className="flex items-center justify-end gap-3 border-t border-border px-3 py-2">
                  <button
                    type="button"
                    // Keep focus in the field: a blur would commit the half-typed text as a tag before closing.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => (readView ? setEditing(false) : close())}
                    className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving || !dirty}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-600 transition-colors hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" />
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="max-h-56 overflow-y-auto px-3 py-2.5 text-sm leading-relaxed text-foreground">{readView}</div>
                <div className="flex items-center justify-between border-t border-border px-3 py-2">
                  <span className="type-label">{label}</span>
                  <button
                    type="button"
                    onClick={() => {
                      onOpen();
                      setEditing(true);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-600 transition-colors hover:text-orange-700"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                </div>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

const cellButton = "w-full truncate px-1.5 py-0.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50";
const dash = <span className="italic text-muted-foreground">—</span>;

/** Long free text (core idea, mistake log): read view when filled, straight to the editor when empty. */
export function NoteCell({
  entryId,
  field,
  value,
}: {
  entryId: string;
  field: "idea" | "mistake";
  value?: string | null;
}) {
  const label = field === "idea" ? "Core idea" : "Mistake log";
  const stored = value ?? "";
  const [draft, setDraft] = useState(stored);
  return (
    <div className="max-w-[260px]">
      <CellDialog
        cellId={`note-${entryId}-${field}`}
        label={label}
        triggerLabel={`${label}. Click to ${stored ? "read or edit" : "add"}.`}
        triggerClassName={`${cellButton} text-foreground`}
        trigger={stored || dash}
        startInEdit={!stored}
        onOpen={() => setDraft(stored)}
        readView={stored ? <p className="whitespace-pre-wrap">{stored}</p> : undefined}
        dirty={draft.trim() !== stored.trim()}
        onSave={async () => {
          await updateEntryInline({ entryId, field, value: draft.trim() || null });
        }}
        editView={
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            rows={5}
            aria-label={label}
            placeholder={field === "idea" ? "The key insight in a sentence or two…" : "What went wrong?"}
            className="w-full resize-y border border-border bg-background px-2.5 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        }
      />
    </div>
  );
}

/** Lazily load pattern names the first time a pattern editor opens. */
let patternCache: string[] | null = null;
function usePatternOptions(active: boolean) {
  const [known, setKnown] = useState<string[]>(patternCache ?? []);
  useEffect(() => {
    if (!active || patternCache) return;
    let cancelled = false;
    fetch("/api/patterns")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.patterns)) {
          patternCache = d.patterns;
          if (!cancelled) setKnown(d.patterns);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [active]);
  return known;
}

/** Multi-select from the pattern catalog (plus the user's own), via the same picker as the log form. */
export function PatternCell({ entryId, patterns }: { entryId: string; patterns: string[] }) {
  const [draft, setDraft] = useState<string[]>(patterns);
  const [opened, setOpened] = useState(false);
  const known = usePatternOptions(opened);
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  return (
    <CellDialog
      cellId={`pattern-${entryId}`}
      label="Pattern"
      triggerLabel="Pattern. Click to edit."
      triggerClassName="w-full px-1.5 py-0.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
      trigger={
        patterns.length > 0 ? (
          <div className="flex max-w-[220px] flex-wrap gap-1">
            {patterns.map((p) => (
              <span key={p} className="border px-1.5 py-0.5 text-[10px] font-semibold" style={patternClayStyle(p)}>
                {p}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs italic text-muted-foreground">—</span>
        )
      }
      startInEdit
      onOpen={() => {
        setDraft(patterns);
        setOpened(true);
      }}
      dirty={!same(normalizePatternList(draft), patterns)}
      onSave={async () => {
        await updateEntryInline({ entryId, field: "patternOverride", value: normalizePatternList(draft) });
      }}
      editView={
        <TagCombobox
          id={`grid-pattern-${entryId}`}
          label="Pattern"
          noun="pattern"
          tags={draft}
          onTagsChange={setDraft}
          getSuggestions={(q, current) => suggestPatterns(q, known, current)}
          normalize={(raw) => normalizePatternList([raw]).map((part) => canonicalPattern(part, known))}
          showOnFocus
          placeholder="Sliding Window, Strings…"
        />
      }
    />
  );
}

const splitSources = (s: string | null | undefined) =>
  (s ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

let sourceCache: string[] | null = null;

/** Source / list: one or more tags, suggesting the sources used elsewhere. Stored comma-joined. */
export function SourceCell({ entryId, value }: { entryId: string; value?: string | null }) {
  const stored = splitSources(value);
  const [draft, setDraft] = useState<string[]>(stored);
  const [options, setOptions] = useState<string[]>(sourceCache ?? []);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    if (!opened || sourceCache) return;
    let cancelled = false;
    getLogFormConfig()
      .then((cfg) => {
        sourceCache = cfg.sources;
        if (!cancelled) setOptions(cfg.sources);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [opened]);

  const joined = draft.join(", ");
  return (
    <div className="max-w-[200px]">
      <CellDialog
        cellId={`source-${entryId}`}
        label="Source"
        triggerLabel="Source. Click to edit."
        triggerClassName={`${cellButton} text-xs text-foreground`}
        trigger={stored.length ? stored.join(", ") : dash}
        startInEdit
        onOpen={() => {
          setDraft(stored);
          setOpened(true);
        }}
        dirty={joined !== stored.join(", ")}
        onSave={async () => {
          if (joined.length > 200) throw new Error("Source is too long (200 characters max).");
          await updateEntryInline({ entryId, field: "sourceList", value: joined || null });
          if (sourceCache) sourceCache = null; // new names should show up in the next suggestion list
        }}
        editView={
          <TagCombobox
            id={`grid-source-${entryId}`}
            label="Source / list"
            noun="source"
            tags={draft}
            onTagsChange={setDraft}
            options={options}
            allowCreate
            showOnFocus
            maxLength={200}
            placeholder="Blind 75, NeetCode 150, a contest…"
          />
        }
      />
    </div>
  );
}

/** A user-defined column: the editor matches the field's type (text, number, date, yes/no, select). */
export function CustomCell({
  entryId,
  def,
  value,
}: {
  entryId: string;
  def: CustomFieldDef;
  value: CustomValue | undefined;
}) {
  const text = formatCustomValue(def, value);
  const [draft, setDraft] = useState<CustomDraft>({ [def.id]: value ?? null });
  const next = draft[def.id] ?? null;
  const dirty = next !== (value ?? null);
  return (
    <div className="max-w-[240px]">
      <CellDialog
        cellId={`custom-${entryId}-${def.id}`}
        label={def.label}
        triggerLabel={`${def.label}. Click to edit.`}
        triggerClassName={`${cellButton} text-xs text-foreground`}
        trigger={text || <span className="text-muted-foreground/50">—</span>}
        startInEdit
        onOpen={() => setDraft({ [def.id]: value ?? null })}
        dirty={dirty}
        onSave={async () => {
          await updateEntryCustomValues(entryId, { [def.id]: next });
        }}
        editView={<CustomFieldInputs fields={[def]} values={draft} onChange={setDraft} className="sm:grid-cols-1" />}
      />
    </div>
  );
}
