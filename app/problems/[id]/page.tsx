import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { formatDifficulty, formatMinutes, safeHref } from "@/lib/utils";
import { ExternalLink, Sparkles, ArrowLeft } from "lucide-react";
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
    <div className="max-w-4xl mx-auto space-y-6 font-sans pb-12">
      {/* Back button */}
      <div>
        <a
          href="/problems"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Back to problem grid
        </a>
      </div>

      {/* Header */}
      <div className="rounded-none border border-border bg-background p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              {p.number != null && <span className="tabular-numbers">#{p.number}</span>}
              <span>•</span>
              <span className="">{p.platform}</span>
              {card && isLeech(card) && (
                <span className="rounded-none bg-hard border border-hard px-1.5 py-0.2 text-[10px] font-mono text-background">
                  Leech (≥3 lapses)
                </span>
              )}
            </div>
            <h1 className="text-xl font-semibold text-foreground mt-1 tracking-tight">{p.title}</h1>
          </div>

          <div className="flex items-center gap-2">
            <ScheduleReviewToggle entryId={entry.id} initialScheduled={Boolean(card)} />
            <span className={`rounded-none border px-2 py-0.5 text-xs font-mono  ${diff.className}`}>
              {diff.label}
            </span>
            {safeHref(p.url) && (
              <a
                href={safeHref(p.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-none border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted transition-colors font-mono"
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
              className="flex items-center gap-1 rounded-none bg-muted/40 border border-border px-2 py-0.5 text-xs text-foreground font-mono"
            >
              <Sparkles className="h-3 w-3 text-foreground" />
              {pp.pattern.name} ({pp.pattern.family})
            </span>
          ))}
          {p.topicTags.map((tag) => (
            <span
              key={tag}
              className="rounded-none bg-background border border-border px-2 py-0.5 text-xs text-muted-foreground font-mono"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Idea & Mistake Split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Core Idea */}
        <div className="rounded-none border border-border bg-background p-4 space-y-2">
          <h2 className="text-xs font-mono font-medium  tracking-wider text-muted-foreground">
            Core idea / intuition
          </h2>
          <div className="rounded-none bg-muted/20 border border-border p-3 text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed min-h-[120px]">
            {entry.idea || <span className="text-muted-foreground italic font-sans">No notes recorded yet.</span>}
          </div>
        </div>

        {/* Mistake Log */}
        <div className="rounded-none border border-border bg-background p-4 space-y-2">
          <h2 className="text-xs font-mono font-medium  tracking-wider text-muted-foreground">
            What I did wrong / trap
          </h2>
          <div className="rounded-none bg-muted/20 border border-border p-3 text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed min-h-[120px]">
            {entry.mistake || <span className="text-muted-foreground italic font-sans">No mistakes logged. Clean solve!</span>}
          </div>
        </div>
      </div>

      {/* FSRS Schedule State */}
      {card && (
        <div className="rounded-none border border-border bg-background p-4 space-y-3">
          <h2 className="text-xs font-mono font-medium  tracking-wider text-muted-foreground">
            FSRS memory & schedule state
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="rounded-none border border-border bg-muted/30 p-2.5">
              <span className="text-muted-foreground text-[10px]  block">Next due</span>
              <div className="text-sm font-semibold text-foreground mt-0.5 tabular-numbers">
                {card.due.toLocaleDateString()}
              </div>
            </div>

            <div className="rounded-none border border-border bg-muted/30 p-2.5">
              <span className="text-muted-foreground text-[10px]  block">Retrievability (R)</span>
              <div className="text-sm font-semibold text-foreground mt-0.5 tabular-numbers">
                {retrievability != null ? `${(retrievability * 100).toFixed(1)}%` : "-"}
              </div>
            </div>

            <div className="rounded-none border border-border bg-muted/30 p-2.5">
              <span className="text-muted-foreground text-[10px]  block">Stability (S) / Difficulty (D)</span>
              <div className="text-sm font-semibold text-foreground mt-0.5 tabular-numbers">
                {card.stability.toFixed(1)}d / {card.difficulty.toFixed(1)}
              </div>
            </div>

            <div className="rounded-none border border-border bg-muted/30 p-2.5">
              <span className="text-muted-foreground text-[10px]  block">Reps / Lapses / State</span>
              <div className="text-sm font-semibold text-foreground mt-0.5 tabular-numbers">
                {card.reps} / {card.lapses} / {card.state}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attempt History */}
      <div className="rounded-none border border-border bg-background p-4 space-y-3">
        <h2 className="text-xs font-mono font-medium  tracking-wider text-muted-foreground">
          Attempt & review history ({entry.attempts.length})
        </h2>
        <div className="divide-y divide-border border-t border-border font-mono text-xs">
          {entry.attempts.map((att) => {
            return (
              <div key={att.id} className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="rounded-none border border-border bg-muted px-2 py-0.5 text-[10px] font-mono text-foreground ">
                    {att.rating}
                  </span>
                  <span className="text-muted-foreground tabular-numbers">
                    {att.at.toLocaleDateString()} at {att.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {att.minutes && (
                    <span className="text-muted-foreground tabular-numbers">
                      ({formatMinutes(att.minutes)})
                    </span>
                  )}
                  {att.usedHint && (
                    <span className="text-muted-foreground text-[11px] font-mono">[Hint used]</span>
                  )}
                </div>
                {att.note && <span className="text-muted-foreground truncate max-w-sm">{att.note}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
