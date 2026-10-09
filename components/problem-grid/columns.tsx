"use client";
import React from 'react';

import { ColumnDef } from "@tanstack/react-table";
import { useEffect, useRef, useState, useTransition } from "react";
import { ExternalLink, Check, HelpCircle, XCircle, Trash2, Plus, MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { AddFieldForm } from "@/components/add-field-form";
import { EditFieldForm } from "@/components/edit-field-form";
import { type CustomFieldDef, type CustomValues } from "@/lib/custom-fields";
import {
  cn,
  formatDifficulty,
  formatMinutes,
  formatStatus,
  safeHref,
} from "@/lib/utils";
import { updateEntryInline, deleteEntry } from "@/app/actions/entry-actions";
import { NoteCell, PatternCell, SourceCell, CustomCell, broadcastEditStart, useCloseOnOtherEdit } from "./cell-editors";

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
  customValues?: CustomValues;
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
      if (num !== null && (isNaN(num) || num < 0 || num > 9999)) {
        setValue(initialValue != null ? String(initialValue) : "");
        setIsEditing(false);
        return;
      }
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

const baseColumns: ColumnDef<ProblemGridRow>[] = [
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
      <PatternCell entryId={row.original.id} patterns={row.original.patterns} />
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
      <NoteCell entryId={row.original.id} field="idea" value={row.original.idea} />
    ),
  },
  {
    accessorKey: "mistake",
    header: "Mistake log",
    size: 220,
    cell: ({ row }) => (
      <NoteCell entryId={row.original.id} field="mistake" value={row.original.mistake} />
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
    header: () => <AddColumnButton />,
    enableSorting: false,
    size: 36,
    cell: ({ row }) => (
      <GridDeleteButton entryId={row.original.id} />
    ),
  },
];

const POPOVER_WIDTH = 320;

/**
 * A header button that opens a floating panel. Fixed-positioned because the table's
 * scroll container would clip an absolute one; clicks inside never reach the header's sort.
 */
function HeaderPopover({
  label,
  icon,
  className,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  className?: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const open = anchor !== null;

  useEffect(() => {
    if (!open) return;
    const close = () => setAnchor(null);
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => {
          if (open) return setAnchor(null);
          const r = e.currentTarget.getBoundingClientRect();
          const width = Math.min(POPOVER_WIDTH, window.innerWidth - 16);
          // Right-align to the button, but never off either edge of the screen.
          const left = Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8);
          setAnchor({ top: r.bottom + 4, left });
        }}
        className={cn(
          "pressable flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground",
          className,
        )}
        aria-label={label}
        aria-expanded={open}
        title={label}
      >
        {icon}
      </button>
      {open && (
        <div
          style={{ ...anchor, width: `min(${POPOVER_WIDTH}px, calc(100vw - 16px))` }}
          className="fixed z-50 cursor-default text-left font-normal"
        >
          {children(() => setAnchor(null))}
        </div>
      )}
    </div>
  );
}

/** Header "+" → add a custom column in place; the page re-renders with it. */
function AddColumnButton() {
  const router = useRouter();
  return (
    <HeaderPopover label="Add column" icon={<Plus className="h-3.5 w-3.5" />}>
      {(close) => (
        <AddFieldForm
          variant="popover"
          onAdded={() => {
            close();
            router.refresh();
          }}
          onCancel={close}
        />
      )}
    </HeaderPopover>
  );
}

/** Custom column header: label plus a menu to rename / edit options / delete. */
function CustomColumnHeader({ def }: { def: CustomFieldDef }) {
  const router = useRouter();
  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-1">
      <span className="truncate">{def.label}</span>
      <HeaderPopover
        label={`Edit ${def.label} column`}
        icon={<MoreHorizontal className="h-3.5 w-3.5" />}
        // Always visible on touch; on hover-capable screens only when the header is hovered.
        className="[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/th:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
      >
        {(close) => (
          <EditFieldForm
            field={def}
            onDone={() => {
              close();
              router.refresh();
            }}
            onCancel={close}
          />
        )}
      </HeaderPopover>
    </div>
  );
}

const COLUMN_SIZE: Record<CustomFieldDef["type"], number> = {
  text: 180,
  select: 120,
  number: 80,
  boolean: 64,
  date: 96,
};

/**
 * Base columns plus the user's own: Source (when they track one) and each custom
 * field, placed after the mistake log. Expects fields already run through
 * filterNonOverlappingFields (DataTable does this).
 */
export function buildColumns({
  customFields,
  showSource,
}: {
  customFields: CustomFieldDef[];
  showSource: boolean;
}): ColumnDef<ProblemGridRow>[] {
  const extra: ColumnDef<ProblemGridRow>[] = [
    ...(showSource
      ? [
          {
            accessorKey: "sourceList",
            header: "Source",
            size: 120,
            cell: ({ row }) => (
              <SourceCell entryId={row.original.id} value={row.original.sourceList} />
            ),
          } satisfies ColumnDef<ProblemGridRow>,
        ]
      : []),
    ...customFields.map(
      (def): ColumnDef<ProblemGridRow> => ({
        id: `custom_${def.id}`,
        header: () => <CustomColumnHeader def={def} />,
        size: COLUMN_SIZE[def.type],
        accessorFn: (row) => row.customValues?.[def.id] ?? null,
        sortUndefined: "last",
        cell: ({ row }) => (
          <CustomCell entryId={row.original.id} def={def} value={row.original.customValues?.[def.id]} />
        ),
      })
    ),
  ];
  const at = baseColumns.findIndex((c) => "accessorKey" in c && c.accessorKey === "mistake") + 1;
  return [...baseColumns.slice(0, at), ...extra, ...baseColumns.slice(at)];
}
