import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { formatDifficulty, formatMinutes } from "@/lib/utils";
import { ExternalLink, Calendar, CheckCircle, AlertCircle, Clock, Sparkles, ArrowLeft } from "lucide-react";
import { calculateRetrievability, isLeech } from "@/lib/scheduler";
import { ScheduleReviewToggle } from "@/components/schedule-review-toggle";

export const dynamic = "force-dynamic";

export default async function ProblemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const entry = await prisma.entry.findFirst({
    where: { id, userId: user.id },
    include: {
      problem: {
        include: {
          patterns: {
            include: { pattern: true },
          },
        },
      },
      attempts: {
        orderBy: [{ at: "desc" }],
      },
      reviewCard: true,
    },
  });

  if (!entry) {
    notFound();
  }

  const p = entry.problem;
  const card = entry.reviewCard;
  const diff = formatDifficulty(p.difficulty);

  const retrievability = card
    ? calculateRetrievability({
        entryId: card.entryId,
        due: card.due,
        stability: card.stability,
        difficulty: card.difficulty,
        elapsedDays: card.elapsedDays,
        scheduledDays: card.scheduledDays,
        reps: card.reps,
        lapses: card.lapses,
        state: card.state as any,
        lastReview: card.lastReview,
      })
    : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans">
      {/* Back button */}
      <div>
        <a
          href="/problems"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Problem Grid
        </a>
      </div>

      {/* Header */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs text-zinc-400">
              {p.number != null && <span>#{p.number}</span>}
              <span>•</span>
              <span className="uppercase">{p.platform}</span>
              {card && isLeech(card) && (
                <span className="rounded bg-rose-950 border border-rose-800 px-1.5 py-0.2 text-[10px] text-rose-300">
                  Leech (≥3 Lapses)
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-zinc-100 mt-1">{p.title}</h1>
          </div>

          <div className="flex items-center gap-2">
            <ScheduleReviewToggle entryId={entry.id} initialScheduled={Boolean(card)} />
            <span className={`rounded border px-2 py-0.5 text-xs font-mono ${diff.className}`}>
              {diff.label}
            </span>
            {p.url && (
              <a
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors font-mono"
              >
                <span>Solve</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        {/* Tags & Patterns */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {p.patterns.map((pp) => (
            <span
              key={pp.patternId}
              className="flex items-center gap-1 rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-xs text-zinc-300 font-mono"
            >
              <Sparkles className="h-3 w-3 text-emerald-400" />
              {pp.pattern.name} ({pp.pattern.family})
            </span>
          ))}
          {p.topicTags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-zinc-900/60 border border-zinc-800/80 px-2 py-0.5 text-xs text-zinc-500 font-mono"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Idea & Mistake Split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Core Idea */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-2">
          <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-emerald-400">
            Core Idea / Intuition
          </h2>
          <div className="rounded bg-zinc-900/70 border border-zinc-800/70 p-3 text-xs font-mono text-zinc-200 whitespace-pre-wrap leading-relaxed min-h-[120px]">
            {entry.idea || <span className="text-zinc-600 italic">No notes recorded yet.</span>}
          </div>
        </div>

        {/* Mistake Log (Highest Value Artifact) */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-2">
          <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-rose-400">
            What I Did Wrong / Trap
          </h2>
          <div className="rounded bg-zinc-900/70 border border-zinc-800/70 p-3 text-xs font-mono text-zinc-200 whitespace-pre-wrap leading-relaxed min-h-[120px]">
            {entry.mistake || <span className="text-zinc-600 italic">No mistakes logged. Clean solve!</span>}
          </div>
        </div>
      </div>

      {/* FSRS Schedule State */}
      {card && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-3">
          <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400">
            FSRS Memory & Schedule State
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="rounded border border-zinc-800/80 bg-zinc-900/60 p-2.5">
              <span className="text-zinc-500 text-[10px]">NEXT DUE</span>
              <div className="text-sm font-semibold text-zinc-100 mt-0.5">
                {card.due.toLocaleDateString()}
              </div>
            </div>

            <div className="rounded border border-zinc-800/80 bg-zinc-900/60 p-2.5">
              <span className="text-zinc-500 text-[10px]">RETRIEVABILITY (R)</span>
              <div className="text-sm font-semibold text-emerald-400 mt-0.5">
                {retrievability != null ? `${(retrievability * 100).toFixed(1)}%` : "-"}
              </div>
            </div>

            <div className="rounded border border-zinc-800/80 bg-zinc-900/60 p-2.5">
              <span className="text-zinc-500 text-[10px]">STABILITY (S) / DIFFICULTY (D)</span>
              <div className="text-sm font-semibold text-zinc-100 mt-0.5">
                {card.stability.toFixed(1)}d / {card.difficulty.toFixed(1)}
              </div>
            </div>

            <div className="rounded border border-zinc-800/80 bg-zinc-900/60 p-2.5">
              <span className="text-zinc-500 text-[10px]">REPS / LAPSES / STATE</span>
              <div className="text-sm font-semibold text-zinc-100 mt-0.5">
                {card.reps} / {card.lapses} / {card.state}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attempt History */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-3">
        <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400">
          Attempt & Review History ({entry.attempts.length})
        </h2>
        <div className="divide-y divide-zinc-900 border-t border-zinc-900 font-mono text-xs">
          {entry.attempts.map((att) => {
            const ratingColor =
              att.rating === "EASY"
                ? "text-emerald-400 bg-emerald-950/70 border-emerald-800"
                : att.rating === "GOOD"
                ? "text-teal-400 bg-teal-950/70 border-teal-800"
                : att.rating === "HARD"
                ? "text-amber-400 bg-amber-950/70 border-amber-800"
                : "text-rose-400 bg-rose-950/70 border-rose-800";

            return (
              <div key={att.id} className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`rounded border px-2 py-0.5 text-[10px] ${ratingColor}`}>
                    {att.rating}
                  </span>
                  <span className="text-zinc-400">
                    {att.at.toLocaleDateString()} at {att.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {att.minutes && (
                    <span className="text-zinc-500">
                      ({formatMinutes(att.minutes)})
                    </span>
                  )}
                  {att.usedHint && (
                    <span className="text-amber-400 text-[11px]">[Hint used]</span>
                  )}
                </div>
                {att.note && <span className="text-zinc-500 truncate max-w-sm">{att.note}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
