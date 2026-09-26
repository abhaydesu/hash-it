"use client";
import React from 'react';

import { ColumnDef } from "@tanstack/react-table";
import { useEffect, useRef, useState, useTransition } from "react";
import { ExternalLink, Check, HelpCircle, XCircle, Pencil, Trash2 } from "lucide-react";
import {
  cn,
  formatDifficulty,
  formatMinutes,
  formatStatus,
  normalizePatternList,
  patternClayStyle,
  safeHref,
} from "@/lib/utils";
import { updateEntryInline, deleteEntry } from "@/app/actions/entry-actions";

const GRID_EDIT_EVENT = "grid-cell-edit";

function broadcastEditStart(cellId: string) {
  window.dispatchEvent(new CustomEvent(GRID_EDIT_EVENT, { detail: { cellId } }));
}

function useCloseOnOtherEdit(cellId: React.RefObject<string | null>, onClose: () => void) {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.cellId !== cellId.current) onClose();
    };
    window.addEventListener(GRID_EDIT_EVENT, handler);
    return () => window.removeEventListener(GRID_EDIT_EVENT, handler);
  }, [cellId, onClose]);
}

export interface ProblemGridRow {
  id: string;
  problemId: string;
  number?: number | null;
  title: string;
  slug: string;
  url: string;
  platform: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD" | null;
  status: "SOLVED_UNAIDED" | "SOLVED_WITH_HELP" | "ATTEMPTED_FAILED";
  revisit: boolean;
  minutes?: number | null;
  idea?: string | null;
  mistake?: string | null;
  patterns: string[];
  family?: string | null;
  topicTags: string[];
  firstSolvedAt: string;
  due?: string | null;
  lapses: number;
  reps: number;
  sourceList?: string | null;
}

function InlineEditCell({
  entryId,
  field,
  initialValue,
}: {
  entryId: string;
  field: "idea" | "mistake";
  initialValue?: string | null;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState(initialValue || "");
  const [isSaving, setIsSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const cellId = useRef(`edit-${entryId}-${field}`);

  const closeAll = React.useCallback(() => {
    setIsEditing(false);
    setIsOpen(false);
    setValue(initialValue || "");
  }, [initialValue]);

  useCloseOnOtherEdit(cellId, closeAll);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setIsEditing(false);
        setValue(initialValue || "");
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isEditing) {
          setIsEditing(false);
          setValue(initialValue || "");
        } else {
          setIsOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, isEditing, initialValue]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateEntryInline({ entryId, field, value: value.trim() || null });
      setIsEditing(false);
      setIsOpen(false);
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Empty cell → inline input directly in the cell
  if (isEditing && !isOpen) {
    return (
      <div className="flex min-w-[200px] items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") { setValue(initialValue || ""); setIsEditing(false); }
          }}
          onBlur={() => {
            if ((value.trim() || null) === (initialValue || null)) {
              setIsEditing(false);
              return;
            }
            handleSave();
          }}
          disabled={isSaving}
          autoFocus
          className="w-full border border-border bg-background px-2 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative min-w-0 max-w-[260px]">
      <button
        type="button"
        onClick={() => {
          broadcastEditStart(cellId.current);
          if (!initialValue) {
            setIsEditing(true);
            return;
          }
          setIsOpen((open) => !open);
        }}
        aria-expanded={isOpen}
        aria-label={`${field === "idea" ? "Core idea" : "Mistake"}. Click to read or edit.`}
        className="w-full truncate px-1.5 py-0.5 text-left text-foreground transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
      >
        {initialValue ? initialValue : <span className="italic text-muted-foreground">—</span>}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-[min(22rem,70vw)] border border-border bg-background shadow-lg">
          {isEditing ? (
            <>
              <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={isSaving}
                autoFocus
                rows={5}
                className="w-full resize-y border-0 px-3 py-2.5 text-sm leading-relaxed text-foreground bg-background focus:outline-none"
              />
              <div className="flex items-center justify-end gap-2 border-t border-border px-3 py-2">
                <button
                  type="button"
                  onClick={() => { setIsEditing(false); setValue(initialValue || ""); }}
                  className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-600 transition-colors hover:text-orange-700"
                >
                  <Check className="h-3 w-3" />
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="max-h-56 overflow-y-auto px-3 py-2.5 text-sm leading-relaxed text-foreground">
                <p className="whitespace-pre-wrap">{initialValue}</p>
              </div>
              <div className="flex items-center justify-between border-t border-border px-3 py-2">
                <span className="type-label">
                  {field === "idea" ? "Core idea" : "Mistake log"}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-600 transition-colors hover:text-orange-700"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function InlinePatternCell({
  entryId,
  patterns,
}: {
  entryId: string;
  patterns: string[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(patterns.join(", "));
  const [isSaving, setIsSaving] = useState(false);
  const cellId = useRef(`pattern-${entryId}`);

  const closeAll = React.useCallback(() => {
    setIsEditing(false);
    setValue(patterns.join(", "));
  }, [patterns]);

  useCloseOnOtherEdit(cellId, closeAll);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const parsed = value
        .split(/[,;|]/)
        .map((s) => s.trim())
        .filter(Boolean);
      await updateEntryInline({ entryId, field: "patternOverride", value: parsed });
      setIsEditing(false);
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") { setValue(patterns.join(", ")); setIsEditing(false); }
          }}
          onBlur={() => {
            const parsed = value.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
            if (JSON.stringify(parsed) === JSON.stringify(patterns)) {
              setIsEditing(false);
              return;
            }
            handleSave();
          }}
          disabled={isSaving}
          autoFocus
          placeholder="e.g. Two Pointer, DFS"
          className="w-full border border-border bg-background px-2 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        broadcastEditStart(cellId.current);
        setIsEditing(true);
      }}
      className="w-full text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 px-1.5 py-0.5"
    >
      {patterns.length > 0 ? (
        <div className="flex max-w-[220px] flex-wrap gap-1">
          {normalizePatternList(patterns).map((p) => (
            <span
              key={p}
              className="border px-1.5 py-0.5 text-[10px] font-semibold"
              style={patternClayStyle(p)}
            >
              {p}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-xs italic text-muted-foreground">—</span>
      )}
    </button>
  );
}

function InlineMinutesCell({
  entryId,
  initialValue,
}: {
  entryId: string;
  initialValue?: number | null;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue != null ? String(initialValue) : "");
  const [isSaving, setIsSaving] = useState(false);
  const cellId = useRef(`minutes-${entryId}`);

  const closeAll = React.useCallback(() => {
    setIsEditing(false);
    setValue(initialValue != null ? String(initialValue) : "");
  }, [initialValue]);

  useCloseOnOtherEdit(cellId, closeAll);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const num = value.trim() === "" ? null : parseInt(value.trim(), 10);
      if (num !== null && (isNaN(num) || num < 0 || num > 9999)) return;
      await updateEntryInline({ entryId, field: "minutes", value: num });
      setIsEditing(false);
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <input
          type="number"
          min="0"
          max="9999"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") { setValue(initialValue != null ? String(initialValue) : ""); setIsEditing(false); }
          }}
          onBlur={() => {
            const num = value.trim() === "" ? null : parseInt(value.trim(), 10);
            if (num === (initialValue ?? null)) {
              setIsEditing(false);
              return;
            }
            handleSave();
          }}
          disabled={isSaving}
          autoFocus
          className="w-full border border-border bg-background px-2 py-0.5 text-xs tabular-nums text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        broadcastEditStart(cellId.current);
        setIsEditing(true);
      }}
      className="w-full text-left px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground transition-colors hover:bg-muted/50"
    >
      {formatMinutes(initialValue)}
    </button>
  );
}

function GridDeleteButton({ entryId }: { entryId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!confirming) return;
    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setConfirming(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [confirming]);

  if (confirming) {
    return (
      <div ref={rootRef} className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => {
            startTransition(async () => {
              await deleteEntry(entryId);
            });
          }}
          disabled={isPending}
          className="text-[10px] font-medium text-red-600 hover:text-red-700"
        >
          {isPending ? "..." : "Yes"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-[10px] text-muted-foreground hover:text-foreground"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="p-0.5 text-muted-foreground transition-opacity hover:text-red-600 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:focus-visible:opacity-100 [@media(hover:hover)]:group-hover/row:opacity-100"
      title="Delete entry"
      aria-label="Delete entry"
    >
      <Trash2 className="h-3 w-3" />
    </button>
  );
}

export const columns: ColumnDef<ProblemGridRow>[] = [
  {
    accessorKey: "number",
    header: "#",
    size: 64,
    cell: ({ row }) => {
      const num = row.original.number;
      return (
        <span className="text-xs tabular-numbers text-muted-foreground">
          {num != null ? `#${num}` : "—"}
        </span>
      );
    },
  },
  {
    accessorKey: "title",
    header: "Problem",
    size: 260,
    cell: ({ row }) => {
      const item = row.original;
      return (
        <div className="flex max-w-[280px] items-center gap-2">
          <a
            href={`/problems/${item.id}`}
            className="truncate font-medium text-foreground hover:underline"
          >
            {item.title}
          </a>
          {safeHref(item.url) && (
            <a
              href={safeHref(item.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              title="Open on LeetCode"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {item.revisit && (
            <span
              className="border border-hard/40 bg-hard/15 px-1 text-[10px] text-hard"
              title="Flagged for revisit"
            >
              rev
            </span>
          )}
          {item.lapses >= 3 && (
            <span
              className="border border-hard/40 bg-hard/15 px-1 text-[10px] text-hard"
              title="Leech problem (≥3 lapses)"
            >
              leech
            </span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "difficulty",
    header: "Diff",
    size: 88,
    cell: ({ row }) => {
      const diff = formatDifficulty(row.original.difficulty);
      return (
        <span className={cn("inline-block px-1.5 py-0.5 text-[10px] font-medium", diff.className)}>
          {diff.label}
        </span>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    size: 110,
    cell: ({ row }) => {
      const status = formatStatus(row.original.status);
      const Icon =
        row.original.status === "SOLVED_UNAIDED"
          ? Check
          : row.original.status === "SOLVED_WITH_HELP"
            ? HelpCircle
            : XCircle;
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium",
            status.className
          )}
        >
          <Icon className="h-3 w-3" />
          {status.short}
        </span>
      );
    },
  },
  {
    accessorKey: "patterns",
    header: "Pattern",
    size: 180,
    cell: ({ row }) => (
      <InlinePatternCell entryId={row.original.id} patterns={row.original.patterns} />
    ),
  },
  {
    accessorKey: "minutes",
    header: "Time",
    size: 72,
    cell: ({ row }) => (
      <InlineMinutesCell entryId={row.original.id} initialValue={row.original.minutes} />
    ),
  },
  {
    accessorKey: "idea",
    header: "Core idea",
    size: 220,
    cell: ({ row }) => (
      <InlineEditCell entryId={row.original.id} field="idea" initialValue={row.original.idea} />
    ),
  },
  {
    accessorKey: "mistake",
    header: "Mistake log",
    size: 220,
    cell: ({ row }) => (
      <InlineEditCell
        entryId={row.original.id}
        field="mistake"
        initialValue={row.original.mistake}
      />
    ),
  },
  {
    accessorKey: "firstSolvedAt",
    header: "Solved",
    size: 88,
    cell: ({ row }) => {
      const d = new Date(row.original.firstSolvedAt);
      return (
        <span className="text-[11px] tabular-numbers text-muted-foreground">
          {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
      );
    },
  },
  {
    accessorKey: "due",
    header: "Next due",
    size: 96,
    cell: ({ row }) => {
      const dueStr = row.original.due;
      if (!dueStr) return <span className="text-xs text-muted-foreground">—</span>;
      const due = new Date(dueStr);
      const isOverdue = due.getTime() <= Date.now();
      return (
        <span
          className={cn(
            "text-[11px] tabular-numbers",
            isOverdue ? "font-semibold text-hard" : "text-muted-foreground"
          )}
        >
          {due.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          {isOverdue && " (!)"}
        </span>
      );
    },
  },
  {
    id: "actions",
    header: "",
    size: 36,
    cell: ({ row }) => (
      <GridDeleteButton entryId={row.original.id} />
    ),
  },
];
