"use client";

import { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Check, HelpCircle, XCircle, AlertTriangle } from "lucide-react";
import { formatDifficulty, formatMinutes } from "@/lib/utils";
import { updateEntryInline } from "@/app/actions/entry-actions";

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
  const [isPreviewPinned, setIsPreviewPinned] = useState(false);
  const [previewPosition, setPreviewPosition] = useState<{ x: number; y: number } | null>(null);
  const [value, setValue] = useState(initialValue || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateEntryInline({ entryId, field, value: value.trim() || null });
      setIsEditing(false);
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const updatePreviewPosition = (clientX: number, clientY: number) => {
    setPreviewPosition({
      x: Math.max(8, Math.min(clientX + 16, window.innerWidth - 368)),
      y: Math.max(8, Math.min(clientY + 16, window.innerHeight - 248)),
    });
  };

  const handleCellClick = () => {
    if (isPreviewPinned) {
      setIsEditing(true);
      setIsPreviewPinned(false);
      setPreviewPosition(null);
      return;
    }
    setIsPreviewPinned(true);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1.5 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") setIsEditing(false);
          }}
          disabled={isSaving}
          autoFocus
          className="w-full border border-border bg-background px-2 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          onClick={handleSave}
          className="p-1 text-foreground hover:bg-muted"
          title="Save"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        onClick={handleCellClick}
        onMouseEnter={(event) => updatePreviewPosition(event.clientX, event.clientY)}
        onMouseMove={(event) => updatePreviewPosition(event.clientX, event.clientY)}
        onMouseLeave={() => {
          if (!isPreviewPinned) setPreviewPosition(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") handleCellClick();
          if (event.key === "Escape") {
            setIsPreviewPinned(false);
            setPreviewPosition(null);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`${field === "idea" ? "Core idea" : "Mistake"}. Activate again to edit.`}
        title="Hover to read. Tap again to edit."
        className="truncate max-w-[220px] cursor-pointer px-1.5 py-0.5 text-foreground hover:bg-muted/50 transition-colors focus-visible:bg-muted/50"
      >
      {initialValue ? initialValue : <span className="text-muted-foreground italic">—</span>}
      </div>
      {initialValue && previewPosition && !isEditing && typeof document !== "undefined" && createPortal(
        <div
          className="idea-preview fixed z-[100] pointer-events-none w-[352px] max-w-[calc(100vw-16px)] max-h-56 overflow-y-auto border border-border bg-background px-4 py-3 text-sm leading-relaxed text-foreground shadow-lg"
          style={{ left: previewPosition.x, top: previewPosition.y }}
          role="tooltip"
        >
          {initialValue}
        </div>,
        document.body
      )}
    </>
  );
}

export const columns: ColumnDef<ProblemGridRow>[] = [
  {
    accessorKey: "number",
    header: "#",
    cell: ({ row }) => {
      const num = row.original.number;
      return (
        <span className="tabular-numbers text-muted-foreground text-xs">
          {num != null ? `#${num}` : "—"}
        </span>
      );
    },
  },
  {
    accessorKey: "title",
    header: "Problem",
    cell: ({ row }) => {
      const item = row.original;
      return (
        <div className="flex items-center gap-2 max-w-[280px]">
          <a
            href={`/problems/${item.id}`}
            className="font-medium text-foreground hover:underline truncate"
          >
            {item.title}
          </a>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
              title="Open problem link"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {item.revisit && (
            <span
              className="border border-hard bg-hard px-1 py-0.2 text-[10px] text-background"
              title="Flagged for revisit"
            >
              rev
            </span>
          )}
          {item.lapses >= 3 && (
            <span
              className="border border-hard bg-hard px-1 py-0.2 text-[10px] text-background"
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
    cell: ({ row }) => {
      const diff = formatDifficulty(row.original.difficulty);
      return (
        <span className={`inline-block border px-1.5 py-0.2 text-[10px] ${diff.className}`}>
          {diff.label}
        </span>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = row.original.status;
      if (s === "SOLVED_UNAIDED") {
        return (
          <span className="flex items-center gap-1 text-[11px] text-easy">
            <Check className="h-3 w-3" /> Unaided
          </span>
        );
      }
      if (s === "SOLVED_WITH_HELP") {
        return (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <HelpCircle className="h-3 w-3" /> With Help
          </span>
        );
      }
      return (
        <span className="flex items-center gap-1 text-[11px] text-destructive">
          <XCircle className="h-3 w-3" /> Failed
        </span>
      );
    },
  },
  {
    accessorKey: "patterns",
    header: "Pattern",
    cell: ({ row }) => {
      const patterns = row.original.patterns;
      if (!patterns || patterns.length === 0) {
        return <span className="text-muted-foreground text-xs italic">—</span>;
      }
      return (
        <div className="flex flex-wrap gap-1 max-w-[180px]">
          {patterns.map((p) => (
            <span
              key={p}
              className="border border-border bg-muted/40 px-1.5 py-0.2 text-[10px] text-muted-foreground"
            >
              {p}
            </span>
          ))}
        </div>
      );
    },
  },
  {
    accessorKey: "minutes",
    header: "Time",
    cell: ({ row }) => (
      <span className="tabular-numbers text-muted-foreground text-xs">
        {formatMinutes(row.original.minutes)}
      </span>
    ),
  },
  {
    accessorKey: "idea",
    header: "Core idea",
    cell: ({ row }) => (
      <InlineEditCell
        entryId={row.original.id}
        field="idea"
        initialValue={row.original.idea}
      />
    ),
  },
  {
    accessorKey: "mistake",
    header: "Mistake log",
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
    cell: ({ row }) => {
      const d = new Date(row.original.firstSolvedAt);
      return (
        <span className="tabular-numbers text-muted-foreground text-[11px]">
          {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
      );
    },
  },
  {
    accessorKey: "due",
    header: "Next due",
    cell: ({ row }) => {
      const dueStr = row.original.due;
      if (!dueStr) return <span className="text-muted-foreground text-xs">—</span>;
      const due = new Date(dueStr);
      const isOverdue = due.getTime() <= Date.now();
      return (
        <span
          className={`tabular-numbers text-[11px] ${
            isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"
          }`}
        >
          {due.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          {isOverdue && " (!)"}
        </span>
      );
    },
  },
];
