"use client";
import React from "react";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { SYSTEM_SOURCES } from "@/lib/custom-fields";
import { completeMonthlyMock } from "@/app/actions/monthly-actions";
import type { MonthlyMockState } from "@/lib/monthly-mock";
import { Countdown } from "@/components/ui/countdown";
import { cn } from "@/lib/utils";

/** "2026-09" → "September 2026". Fixed locale + UTC so server and client agree. */
const monthName = (period: string) =>
  new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${period}-01T00:00:00Z`));
const dayName = (day: string) =>
  new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));

/** Where the mock stands this month: due, overdue, or locked with a countdown. */
function StatusBanner({ status }: { status: MonthlyMockState["status"] }) {
  const tone =
    status.state === "open" && status.overdue
      ? "border-medium/50 bg-medium/10"
      : status.state === "locked"
        ? "border-border bg-muted/30"
        : "border-orange-500/40 bg-orange-50 dark:bg-orange-500/10";
  return (
    <div className={cn("border px-4 py-3 text-xs", tone)}>
      {status.state === "first" && (
        <>
          <span className="font-medium text-foreground">Your first mock.</span> It counts for {monthName(status.creditPeriod)}; after
          that, a mock opens on the last day of each month.
        </>
      )}
      {status.state === "open" && !status.overdue && (
        <>
          <span className="font-medium text-foreground">{monthName(status.creditPeriod)}&apos;s mock is due today.</span> End the month
          with a cold check.
        </>
      )}
      {status.state === "open" && status.overdue && (
        <>
          <span className="font-medium text-foreground">
            {monthName(status.creditPeriod)}&apos;s mock is overdue
          </span>{" "}
          (due {dayName(status.dueDay)}). It stays open until you take it.
        </>
      )}
      {status.state === "locked" && (
        <>
          <span className="font-medium text-foreground">This month&apos;s mock is done.</span> The next one opens{" "}
          <span className="font-medium text-foreground">
            <Countdown to={status.opensAt} />
          </span>
          .
        </>
      )}
    </div>
  );
}

function MockHistory({ history }: { history: MonthlyMockState["history"] }) {
  if (history.length === 0) return null;
  return (
    <div className="space-y-2">
      <h2 className="type-label text-muted-foreground">Past mocks</h2>
      <div className="divide-y divide-border border border-border bg-background text-xs">
        {history.map((m) => {
          const total = m.solved + m.hinted + m.failed;
          return (
            <div key={m.period} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-foreground">{monthName(m.period)}</span>
              <span className="flex items-center gap-3 tabular-nums text-muted-foreground">
                <span>
                  <span className="font-medium text-easy">{m.solved}</span>/{total} cold
                </span>
                <span className="hidden sm:inline">{m.hinted} hint · {m.failed} failed</span>
                <span>{formatMockClock(m.durationSec)}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MonthlyReviewClient({
  initialCatalog,
  mockState,
}: {
  initialCatalog: MonthlyMockProblem[];
  mockState: MonthlyMockState;
}) {
  const {
    phase,
    sessionId,
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
  const router = useRouter();
  const [takeEarly, setTakeEarly] = useState(false);
  const [creditedPeriod, setCreditedPeriod] = useState<string | null>(null);

  // Record a finished session once (idempotent on the server by session id).
  const recordedFor = useRef<string | null>(null);
  useEffect(() => {
    if (phase !== "finished" || !sessionId || recordedFor.current === sessionId) return;
    recordedFor.current = sessionId;
    const all = Object.values(results);
    completeMonthlyMock({
      sessionId,
      solved: all.filter((r) => r.status === "SOLVED_UNAIDED").length,
      hinted: all.filter((r) => r.status === "SOLVED_WITH_HELP").length,
      failed: all.filter((r) => r.status === "ATTEMPTED_FAILED").length,
      durationSec: elapsedSeconds,
    })
      .then((r) => setCreditedPeriod(r.period))
      .catch((err) => {
        recordedFor.current = null;
        console.error("Failed to record monthly mock", err);
      });
  }, [phase, sessionId, results, elapsedSeconds]);

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
          sourceList: SYSTEM_SOURCES.monthlyMock,
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

  const locked = mockState.status.state === "locked";

  if (phase === "idle" || (!isActive && phase !== "finished")) {
    return (
      <SheetSection innerClassName="mx-auto space-y-5 py-8">
        <div className="flex items-center gap-2 type-label text-muted-foreground">
          <Timer className="h-4 w-4 text-foreground" />
          <span>Monthly mock assessment</span>
        </div>

        <h1 className="type-title text-foreground">Timed mock set (5 problems)</h1>

        <StatusBanner status={mockState.status} />

        {locked && !takeEarly ? (
          <p className="type-caption">
            Want a mock anyway?{" "}
            <button
              type="button"
              onClick={() => setTakeEarly(true)}
              className="font-medium text-orange-600 underline-offset-2 hover:text-orange-700 hover:underline"
            >
              Continue
            </button>
          </p>
        ) : (
          <>
            {locked && (
              <p className="border-l-2 border-medium pl-3 type-caption">
                Taking it now counts as <span className="font-medium text-foreground">{monthName(mockState.status.creditPeriod)}</span>
                &apos;s mock, so the next one won&apos;t open until the end of the month after.
              </p>
            )}

            <p className="type-body text-muted-foreground">
              This mock draws 5 problems from your weakest topics.
            </p>

            <p className="type-caption">
              It is the monthly stress test: no hints and no warmup. If you can pick the right approach under
              pressure, your review system is doing its job.
            </p>

            <div className="space-y-2 border border-border bg-muted/40 p-4 type-caption">
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
          </>
        )}

        <MockHistory history={mockState.history} />
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
            {creditedPeriod && <p className="mt-1 type-caption">Counted as {monthName(creditedPeriod)}&apos;s mock.</p>}
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
                      <span className="text-xs font-semibold text-easy">Solved cold</span>
                    )}
                    {res?.status === "SOLVED_WITH_HELP" && (
                      <span className="text-xs font-semibold text-medium">Used hint</span>
                    )}
                    {res?.status === "ATTEMPTED_FAILED" && (
                      <span className="text-xs font-semibold text-destructive">Saw solution</span>
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
              setTakeEarly(false);
              refetchCatalog();
              router.refresh();
            }}
          >
            <Check className="mr-1.5 h-3.5 w-3.5" /> Done
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

        <div className="space-y-1 border border-border bg-muted/40 p-3.5 type-caption">
          <p>
            Solve this problem on{" "}
            {currentProblem.platform === "LEETCODE" ? "LeetCode" : currentProblem.platform} without
            looking at discussion or related tags.
          </p>
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
              <AlertCircle className="h-3.5 w-3.5" /> <span>Saw solution</span>
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
