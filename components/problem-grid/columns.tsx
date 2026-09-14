"use client";

import { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { ExternalLink, AlertTriangle, Sparkles, Check, HelpCircle, XCircle } from "lucide-react";
import { formatDifficulty, formatMinutes } from "@/lib/utils";
import { updateEntryInline } from "@/app/actions/entry-actions";

export interface ProblemGridRow {
  id: string; // entryId
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

// Inline Editable Cell Component
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
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-hidden"
        />
        <button
          onClick={handleSave}
          className="rounded p-1 text-emerald-400 hover:bg-zinc-800"
          title="Save"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      title="Click to edit inline"
      className="truncate max-w-[220px] cursor-pointer rounded px-1.5 py-0.5 text-zinc-300 hover:bg-zinc-800/80 hover:text-zinc-100 transition-colors"
    >
      {initialValue ? initialValue : <span className="text-zinc-600 italic">none</span>}
    </div>
  );
}

export const columns: ColumnDef<ProblemGridRow>[] = [
  {
    accessorKey: "number",
    header: "#",
    cell: ({ row }) => {
      const num = row.original.number;
      return (
        <span className="font-mono text-zinc-400 text-xs">
          {num != null ? `#${num}` : "-"}
        </span>
      );
    },
  },
  {
    accessorKey: "title",
    header: "Problem Name",
    cell: ({ row }) => {
      const item = row.original;
      return (
        <div className="flex items-center gap-2 max-w-[260px]">
          <a
            href={`/problems/${item.id}`}
            className="font-medium text-zinc-200 hover:text-emerald-400 hover:underline truncate"
          >
            {item.title}
          </a>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="text-zinc-500 hover:text-zinc-300 shrink-0"
              title="Open problem link"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {item.revisit && (
            <span
              className="rounded bg-rose-950/80 border border-rose-800/60 px-1 py-0.2 text-[10px] text-rose-300 font-mono"
              title="Flagged for revisit"
            >
              rev
            </span>
          )}
          {item.lapses >= 3 && (
            <span
              className="rounded bg-amber-950/80 border border-amber-800/60 px-1 py-0.2 text-[10px] text-amber-300 font-mono"
              title="Leech problem (>=3 lapses)"
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
        <span className={`inline-block rounded border px-1.5 py-0.2 text-[10px] font-mono ${diff.className}`}>
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
          <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
            <Check className="h-3 w-3" /> Unaided
          </span>
        );
      }
      if (s === "SOLVED_WITH_HELP") {
        return (
          <span className="flex items-center gap-1 text-[11px] text-sky-400 font-mono">
            <HelpCircle className="h-3 w-3" /> With Help
          </span>
        );
      }
      return (
        <span className="flex items-center gap-1 text-[11px] text-rose-400 font-mono">
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
        return <span className="text-zinc-600 text-xs italic">Untagged</span>;
      }
      return (
        <div className="flex flex-wrap gap-1 max-w-[180px]">
          {patterns.map((p) => (
            <span
              key={p}
              className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-300 font-mono"
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
      <span className="font-mono text-zinc-400 text-xs">
        {formatMinutes(row.original.minutes)}
      </span>
    ),
  },
  {
    accessorKey: "idea",
    header: "Core Idea",
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
    header: "Mistake Log",
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
        <span className="font-mono text-zinc-400 text-[11px]">
          {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </span>
      );
    },
  },
  {
    accessorKey: "due",
    header: "Next Due",
    cell: ({ row }) => {
      const dueStr = row.original.due;
      if (!dueStr) return <span className="text-zinc-600 text-xs">-</span>;
      const due = new Date(dueStr);
      const isOverdue = due.getTime() <= Date.now();
      return (
        <span
          className={`font-mono text-[11px] ${
            isOverdue ? "text-rose-400 font-semibold" : "text-zinc-400"
          }`}
        >
          {due.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          {isOverdue && " (!)"}
        </span>
      );
    },
  },
];
