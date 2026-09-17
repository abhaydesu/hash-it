"use client";

import { useEffect, useState, useRef } from "react";
import { Timer, Check, HelpCircle, AlertCircle, Play, RotateCcw, Award, ExternalLink } from "lucide-react";
import { recordReviewAttempt, createEntry } from "@/app/actions/entry-actions";
import { formatDifficulty, safeHref } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SpecGrid, SpecCell } from "@/components/ui/spec-sheet";
import { SheetSection } from "@/components/ui/sheet-section";
import { PageSkeleton } from "@/components/ui/loader";

interface MockProblem {
  id: string;
  entryId?: string;
  title: string;
  number: number | null;
  url: string;
  platform: string;
  patternName: string;
  difficulty: "EASY" | "MEDIUM" | "HARD" | null;
}

interface AttemptResult {
  problemId: string;
  status: "SOLVED_UNAIDED" | "SOLVED_WITH_HELP" | "ATTEMPTED_FAILED";
  minutes: number;
}

export default function MonthlyMockPage() {
  const [problems, setProblems] = useState<MockProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);

  const [totalSeconds, setTotalSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const [problemMinutes, setProblemMinutes] = useState<string>("");
  const [results, setResults] = useState<Record<string, AttemptResult>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMockSet = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/review/monthly");
      if (!res.ok) throw new Error("Failed to generate mock set");
      const data = await res.json();
      setProblems(data.problems || []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMockSet();
  }, []);

  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setTotalSeconds((prev) => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning]);

  const startMock = () => {
    setStarted(true);
    setIsTimerRunning(true);
    setTotalSeconds(0);
  };

  const handleRecordProblem = async (
    status: "SOLVED_UNAIDED" | "SOLVED_WITH_HELP" | "ATTEMPTED_FAILED"
  ) => {
    const p = problems[currentIndex];
    if (!p) return;

    const mins = problemMinutes
      ? parseInt(problemMinutes, 10)
      : Math.max(1, Math.round(totalSeconds / 60));
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

      setResults((prev) => ({
        ...prev,
        [p.id]: {
          problemId: p.id,
          status,
          minutes: mins,
        },
      }));

      setProblemMinutes("");

      if (currentIndex + 1 < problems.length) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        setIsTimerRunning(false);
        setFinished(true);
      }
    } catch (err) {
      console.error("Failed to record attempt in mock", err);
      alert("Failed to record problem result. See console.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <SheetSection band="none" last>
        <PageSkeleton rows={3} />
      </SheetSection>
    );
  }

  if (error || problems.length === 0) {
    return (
      <SheetSection
        band="none"
        last
        innerClassName="flex flex-col items-center justify-center min-h-[50vh] gap-3 py-12 text-center"
      >
        <div className="type-caption text-destructive">
          {error || "No problems available to generate mock"}
        </div>
        <p className="max-w-sm type-caption">
          Ensure you have seeded canonical problems and patterns before starting a monthly mock.
        </p>
        <Button variant="secondary" size="sm" onClick={fetchMockSet}>
          Retry
        </Button>
      </SheetSection>
    );
  }

  if (!started) {
    return (
      <SheetSection innerClassName="mx-auto max-w-2xl space-y-5 py-8" last>
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
          </ul>
        </div>

        <div className="pt-2">
          <Button variant="primary" onClick={startMock}>
            <Play className="mr-2 h-3.5 w-3.5 fill-current" /> Start assessment
          </Button>
        </div>
      </SheetSection>
    );
  }

  if (finished) {
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
              {formatTime(totalSeconds)}
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
          <a href="/problems" className="type-caption text-orange-600 hover:text-orange-700">
            Back to problem grid
          </a>
          <Button
            variant="secondary"
            onClick={() => {
              setStarted(false);
              setFinished(false);
              setResults({});
              setCurrentIndex(0);
              fetchMockSet();
            }}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Start another mock
          </Button>
        </div>
      </SheetSection>
    );
  }

  const currentProblem = problems[currentIndex];

  return (
    <SheetSection innerClassName="mx-auto max-w-2xl space-y-6 py-8" last>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold tabular-nums text-foreground">
            Problem {currentIndex + 1} of {problems.length}
          </span>
          <span className="text-border">|</span>
          <span className="type-caption">{currentProblem.platform}</span>
        </div>

        <div className="flex items-center gap-2 border border-border bg-background px-3 py-1 text-foreground">
          <Timer className="h-3.5 w-3.5 animate-pulse text-foreground" />
          <span className="font-semibold tabular-nums">{formatTime(totalSeconds)}</span>
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
          <p>
            Pattern cue and difficulty will be revealed upon completion of the 5-problem set.
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
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-3">
            <Button
              variant="outcome-good"
              onClick={() => handleRecordProblem("SOLVED_UNAIDED")}
              disabled={isSubmitting}
              className="justify-center"
            >
              <Check className="mr-1.5 h-3.5 w-3.5" /> Solved cold
            </Button>
            <Button
              variant="outcome-hard"
              onClick={() => handleRecordProblem("SOLVED_WITH_HELP")}
              disabled={isSubmitting}
              className="justify-center"
            >
              <HelpCircle className="mr-1.5 h-3.5 w-3.5" /> Used hint
            </Button>
            <Button
              variant="outcome-failed"
              onClick={() => handleRecordProblem("ATTEMPTED_FAILED")}
              disabled={isSubmitting}
              className="justify-center"
            >
              <AlertCircle className="mr-1.5 h-3.5 w-3.5" /> Failed / saw solution
            </Button>
          </div>
        </div>
      </div>
    </SheetSection>
  );
}
