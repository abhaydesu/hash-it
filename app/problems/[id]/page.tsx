import React from 'react';
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { formatDifficulty, formatMinutes, safeHref } from "@/lib/utils";
import { ExternalLink, Sparkles, ArrowLeft } from "lucide-react";
import { calculateRetrievability, isLeech } from "@/lib/scheduler";
import { ScheduleReviewToggle } from "@/components/schedule-review-toggle";
import { SheetSection } from "@/components/ui/sheet-section";
import { SpecGrid, SpecCell } from "@/components/ui/spec-sheet";
import { Badge } from "@/components/ui/badge";

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
        state: card.state as "NEW" | "LEARNING" | "REVIEW" | "RELEARNING",
        lastReview: card.lastReview,
      })
    : null;

  return (
    <div>
      <SheetSection innerClassName="py-4">
        <Link
          href="/problems"
          className="inline-flex items-center gap-1.5 type-caption text-muted-foreground transition-colors hover:text-orange-600"
        >
          <ArrowLeft className="h-3 w-3" /> Back to problem grid
        </Link>
      </SheetSection>

      <SheetSection innerClassName="space-y-3 py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 type-label text-muted-foreground">
              {p.number != null && <span className="tabular-nums">#{p.number}</span>}
              <span>{p.platform}</span>
              {card && isLeech(card) && <Badge variant="status-failed">Leech (≥3 lapses)</Badge>}
            </div>
            <h1 className="mt-1 type-title text-foreground">{p.title}</h1>
          </div>

          <div className="flex items-center gap-2">
            <ScheduleReviewToggle entryId={entry.id} initialScheduled={Boolean(card)} />
            <Badge variant={diff.variant} className="px-2.5 py-1 text-xs">
              {diff.label}
            </Badge>
            {safeHref(p.url) && (
              <a
                href={safeHref(p.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 border border-border bg-background px-2.5 py-1 text-xs text-foreground transition-colors hover:border-orange-500 hover:text-orange-600"
              >
                <span>Solve</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {p.patterns.map((pp) => (
            <Badge key={pp.patternId} variant="pattern" className="gap-1">
              <Sparkles className="h-3 w-3" />
              {pp.pattern.name} ({pp.pattern.family})
            </Badge>
          ))}
          {p.topicTags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      </SheetSection>

      <SheetSection innerClassName="grid grid-cols-1 gap-6 py-6 md:grid-cols-2">
        <div className="space-y-2">
          <h2 className="type-label">Core idea / intuition</h2>
          <div className="min-h-[120px] whitespace-pre-wrap border border-border bg-muted/20 p-3 font-mono text-xs leading-relaxed text-foreground">
            {entry.idea || (
              <span className="font-sans italic text-muted-foreground">No notes recorded yet.</span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="type-label">What I did wrong / trap</h2>
          <div className="min-h-[120px] whitespace-pre-wrap border border-border bg-muted/20 p-3 font-mono text-xs leading-relaxed text-foreground">
            {entry.mistake || (
              <span className="font-sans italic text-muted-foreground">
                No mistakes logged. Clean solve!
              </span>
            )}
          </div>
        </div>
      </SheetSection>

      {card && (
        <SheetSection innerClassName="space-y-3 py-6" band="neutral">
          <h2 className="type-heading text-foreground">FSRS memory and schedule state</h2>
          <SpecGrid columns={4}>
            <SpecCell label="Next due" value={card.due.toLocaleDateString()} />
            <SpecCell
              label="Retrievability"
              value={retrievability != null ? `${(retrievability * 100).toFixed(1)}%` : "—"}
            />
            <SpecCell
              label="Stability / difficulty"
              value={`${card.stability.toFixed(1)}d / ${card.difficulty.toFixed(1)}`}
            />
            <SpecCell
              label="Reps / lapses / state"
              value={`${card.reps} / ${card.lapses} / ${card.state}`}
            />
          </SpecGrid>
        </SheetSection>
      )}

      <SheetSection innerClassName="space-y-3 py-6" last>
        <h2 className="type-heading text-foreground">
          Attempt and review history ({entry.attempts.length})
        </h2>
        <div className="divide-y divide-border border border-border bg-background text-xs">
          {entry.attempts.map((att) => (
            <div key={att.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 px-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline">{att.rating}</Badge>
                <span className="tabular-nums text-muted-foreground">
                  {att.at.toLocaleDateString()} at{" "}
                  {att.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                {att.minutes && (
                  <span className="tabular-nums text-muted-foreground">
                    ({formatMinutes(att.minutes)})
                  </span>
                )}
                {att.usedHint && <Badge variant="status-help">Hint used</Badge>}
              </div>
              {att.note && (
                <span className="max-w-sm truncate text-muted-foreground">{att.note}</span>
              )}
            </div>
          ))}
        </div>
      </SheetSection>
    </div>
  );
}
