"use client";
import React from "react";

import { useState } from "react";
import Link from "next/link";
import { Timer, Check, HelpCircle, AlertCircle, Play, Pause, RotateCcw, Award, ExternalLink } from "lucide-react";
import { recordReviewAttempt, createEntry } from "@/app/actions/entry-actions";
import { formatDifficulty, safeHref } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SpecGrid, SpecCell } from "@/components/ui/spec-sheet";
import { SheetSection } from "@/components/ui/sheet-section";
import {
  formatMockClock,
  useMonthlyMock,
  type MonthlyMockProblem,
} from "@/components/monthly-mock-provider";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAlertDialog } from "@/components/ui/alert-dialog";

export function MonthlyReviewClient({ initialCatalog }: { initialCatalog: MonthlyMockProblem[] }) {
  const {
    phase,
    problems,
    currentIndex,
    results,
    problemMinutes,
    elapsedSeconds,
    isActive,
    startSession,
    pause,
    resume,
    discard,
    resetToIdle,
    setProblemMinutes,
    advanceAfterRecord,
  } = useMonthlyMock();

  const [catalog, setCatalog] = useState<MonthlyMockProblem[]>(initialCatalog);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { showAlert, alertDialog } = useAlertDialog();

  const refetchCatalog = async () => {
    try {
      const res = await fetch("/api/review/monthly");
      if (!res.ok) throw new Error("Failed to generate mock set");
      const data = await res.json();
      setCatalog(data.problems || []);
    } catch (err) {
      console.error("Failed to refresh catalog", err);
    }
  };

  const handleRecordProblem = async (
    status: "SOLVED_UNAIDED" | "SOLVED_WITH_HELP" | "ATTEMPTED_FAILED"
  ) => {
    const p = problems[currentIndex];
    if (!p) return;

    const mins = problemMinutes
      ? parseInt(problemMinutes, 10)
      : Math.max(1, Math.round(elapsedSeconds / 60));
    setIsSubmitting(true);

    try {
      let entryId = p.entryId;

      if (!entryId) {
        const newEntry = await createEntry({
          problemId: p.id,
          status,
          minutes: mins,
          sourceList: "monthly-mock",
        });
        entryId = newEntry.entryId;
      } else {
        await recordReviewAttempt({
          entryId,
          status,
          minutes: mins,
          usedHint: status === "SOLVED_WITH_HELP",
        });
      }

      advanceAfterRecord(p.id, {
        problemId: p.id,
        status,
        minutes: mins,
      });
    } catch (err) {
      console.error("Failed to record attempt in mock", err);
      showAlert("Failed to record problem result. See console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isActive && phase !== "finished" && catalog.length === 0) {
    return (
      <SheetSection
        band="none"
        last
        innerClassName="flex flex-col items-center justify-center min-h-[50vh] gap-3 py-12 text-center"
      >
        <div className="type-caption text-destructive">
          No problems available to generate mock
        </div>
        <p className="max-w-sm type-caption">
          Ensure you have seeded canonical problems and patterns before starting a monthly mock.
        </p>
        <Button variant="secondary" size="sm" onClick={refetchCatalog}>
          Retry
        </Button>
      </SheetSection>
    );
  }

  if (phase === "idle" || (!isActive && phase !== "finished")) {
    return (
      <SheetSection innerClassName="mx-auto space-y-5 py-8">
        <div className="flex items-center gap-2 type-label text-muted-foreground">
          <Timer className="h-4 w-4 text-foreground" />
          <span>Monthly mock assessment</span>
        </div>

        <h1 className="type-title text-foreground">Timed blind mock set (5 problems)</h1>

        <p className="type-body text-muted-foreground">
          This mock draws 5 problems from your weakest pattern families. To simulate real interview
          conditions,{" "}
          <span className="font-medium text-foreground">
            pattern names and difficulty ratings are strictly hidden
          </span>{" "}
          until you finish.
        </p>

        <p className="type-caption">
          It is the monthly stress test: no labels, no hints, no safe-mode warmup. If you can choose
          the right strategy under pressure, your review system is doing its job.
        </p>

        <div className="space-y-2 bg-dither-25 p-4 type-caption">
          <div className="font-semibold text-foreground">Before you start:</div>
          <ul className="list-inside list-disc space-y-1">
            <li>Open each problem on the platform and solve unaided.</li>
            <li>Record your outcome: Solved cold, Used hint, or Attempted / failed.</li>
            <li>Attempts are automatically integrated into your FSRS review schedule.</li>
            <li>You can leave this page — the timer stays in the navbar until you pause or discard it.</li>
          </ul>
        </div>

        <div className="pt-2">
          <Button variant="primary" onClick={() => startSession(catalog)} disabled={catalog.length === 0}>
            <Play className="mr-2 h-3.5 w-3.5 fill-current" /> Start assessment
          </Button>
        </div>
      </SheetSection>
    );
  }

  if (phase === "finished") {
    const coldCount = Object.values(results).filter((r) => r.status === "SOLVED_UNAIDED").length;
    const hintCount = Object.values(results).filter((r) => r.status === "SOLVED_WITH_HELP").length;
    const failCount = Object.values(results).filter((r) => r.status === "ATTEMPTED_FAILED").length;

    return (
      <SheetSection innerClassName="mx-auto max-w-3xl space-y-6 py-8" last>
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2 type-label text-muted-foreground">
              <Award className="h-4 w-4 text-foreground" />
              <span>Assessment complete</span>
            </div>
            <h1 className="mt-1 type-title text-foreground">Assessment summary</h1>
          </div>
          <div className="text-right">
            <div className="type-label">Total duration</div>
            <div className="text-lg font-semibold tabular-nums text-foreground">
              {formatMockClock(elapsedSeconds)}
            </div>
          </div>
        </div>

        <SpecGrid columns={3}>
          <SpecCell label="Solved without help" value={`${coldCount}/5`} />
          <SpecCell label="Needed a hint" value={`${hintCount}/5`} />
          <SpecCell
            label="Could not solve"
            value={`${failCount}/5`}
            className={failCount > 0 ? "text-destructive" : ""}
          />
        </SpecGrid>

        <div className="space-y-3">
          <h2 className="type-heading text-foreground">Revealed problem breakdown</h2>

          <div className="divide-y divide-border border border-border bg-background text-xs">
            {problems.map((p, idx) => {
              const res = results[p.id];
              const diff = formatDifficulty(p.difficulty);

              return (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-4 p-3.5">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                      <span className="tabular-nums">#{idx + 1}</span>
                      {p.number != null && (
                        <span className="tabular-nums text-[11px]">LC #{p.number}</span>
                      )}
                      <Badge variant={diff.variant}>{diff.label}</Badge>
                      <Badge variant="pattern">{p.patternName}</Badge>
                    </div>
                    {safeHref(p.url) ? (
                      <a
                        href={safeHref(p.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 font-medium text-foreground transition-colors hover:text-orange-600"
                      >
                        {p.title} <ExternalLink className="h-3 w-3 opacity-60" />
                      </a>
                    ) : (
                      <span className="font-medium text-foreground">{p.title}</span>
                    )}
                  </div>

                  <div className="text-right">
                    {res?.status === "SOLVED_UNAIDED" && (
                      <span className="text-xs font-semibold text-easy">Solved without help</span>
                    )}
                    {res?.status === "SOLVED_WITH_HELP" && (
                      <span className="text-xs font-semibold text-medium">Needed a hint</span>
                    )}
                    {res?.status === "ATTEMPTED_FAILED" && (
                      <span className="text-xs font-semibold text-destructive">Could not solve</span>
                    )}
                    <div className="mt-0.5 tabular-nums type-caption">{res?.minutes}m</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Link href="/problems" className="type-caption text-orange-600 hover:text-orange-700">
            Back to problem grid
          </Link>
          <Button
            variant="secondary"
            onClick={() => {
              resetToIdle();
              refetchCatalog();
            }}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Start another mock
          </Button>
        </div>
      </SheetSection>
    );
  }

  const currentProblem = problems[currentIndex];
  if (!currentProblem) {
    return null;
  }

  const paused = phase === "paused";

  return (
    <SheetSection innerClassName="mx-auto max-w-2xl space-y-6 py-8" last>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold tabular-nums text-foreground">
            Problem {currentIndex + 1} of {problems.length}
          </span>
          <span className="text-border">|</span>
          <span className="type-caption">{currentProblem.platform}</span>
          {paused && <span className="type-label text-orange-600">Paused</span>}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex h-8 items-center gap-1.5 border border-border bg-background px-3 text-foreground">
            <Timer
              className={`h-3.5 w-3.5 ${paused ? "text-muted-foreground" : "animate-pulse text-orange-600"}`}
            />
            <span className="font-semibold tabular-nums">{formatMockClock(elapsedSeconds)}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => (paused ? resume() : pause())}>
            {paused ? (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Resume</span>
              </>
            ) : (
              <>
                <Pause className="h-3.5 w-3.5" />
                <span>Pause</span>
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowConfirm(true)}
          >
            Discard
          </Button>
        </div>
      </div>

      <div className="space-y-5 border border-border bg-background p-6">
        <div className="space-y-1">
          <div className="type-label">
            {currentProblem.number != null && `Problem #${currentProblem.number}`}
          </div>
          {safeHref(currentProblem.url) ? (
            <a
              href={safeHref(currentProblem.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground transition-colors hover:text-orange-600"
            >
              {currentProblem.title}
              <ExternalLink className="h-4 w-4 opacity-70" />
            </a>
          ) : (
            <span className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
              {currentProblem.title}
            </span>
          )}
        </div>

        <div className="space-y-1 bg-dither-25 p-3.5 type-caption">
          <p>
            Solve this problem on{" "}
            {currentProblem.platform === "LEETCODE" ? "LeetCode" : currentProblem.platform} without
            looking at discussion or related tags.
          </p>
          <p>Pattern cue and difficulty will be revealed upon completion of the 5-problem set.</p>
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center gap-3">
            <label className="type-label">Minutes taken</label>
            <input
              type="number"
              min="1"
              placeholder="auto-timed"
              value={problemMinutes}
              onChange={(e) => setProblemMinutes(e.target.value)}
              className="w-28 border border-border bg-background px-2.5 py-1 text-xs tabular-nums text-foreground focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              disabled={isSubmitting || paused}
            />
          </div>

          <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-3">
            <Button
              variant="outcome-good"
              onClick={() => handleRecordProblem("SOLVED_UNAIDED")}
              disabled={isSubmitting || paused}
              className="justify-center"
            >
              <Check className="h-3.5 w-3.5" /> <span>Solved cold</span>
            </Button>
            <Button
              variant="outcome-hard"
              onClick={() => handleRecordProblem("SOLVED_WITH_HELP")}
              disabled={isSubmitting || paused}
              className="justify-center"
            >
              <HelpCircle className="h-3.5 w-3.5" /> <span>Used hint</span>
            </Button>
            <Button
              variant="outcome-failed"
              onClick={() => handleRecordProblem("ATTEMPTED_FAILED")}
              disabled={isSubmitting || paused}
              className="justify-center"
            >
              <AlertCircle className="h-3.5 w-3.5" /> <span>Failed / saw solution</span>
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showConfirm}
        onOpenChange={setShowConfirm}
        title="Discard progress?"
        description="Are you sure you want to end this monthly mock? Your progress will be lost."
        confirmText="Discard"
        cancelText="Cancel"
        onConfirm={discard}
      />
      {alertDialog}
    </SheetSection>
  );
}
