"use client";

import { useEffect, useState, useRef } from "react";
import { Timer, Check, HelpCircle, AlertCircle, Play, RotateCcw, Award, ExternalLink } from "lucide-react";
import { recordReviewAttempt, createEntry } from "@/app/actions/entry-actions";
import { formatDifficulty } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SpecGrid, SpecCell } from "@/components/ui/spec-sheet";
import { SheetSection } from "@/components/ui/sheet-section";

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

  // Timer state
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Form state per problem
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

  const handleRecordProblem = async (status: "SOLVED_UNAIDED" | "SOLVED_WITH_HELP" | "ATTEMPTED_FAILED") => {
    const p = problems[currentIndex];
    if (!p) return;

    const mins = problemMinutes ? parseInt(problemMinutes, 10) : Math.max(1, Math.round(totalSeconds / 60));
    setIsSubmitting(true);

    try {
      let entryId = p.entryId;

      if (!entryId) {
        // Create an entry if one doesn't exist
        const newEntry = await createEntry({
          problemId: p.id,
          status,
          minutes: mins,
          sourceList: "monthly-mock",
        });
        entryId = newEntry.entryId;
      } else {
        // Append attempt to existing entry
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
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <div className="h-6 w-40 bg-dither-25" />
        <div className="h-3 w-56 bg-dither-25" />
      </div>
    );
  }

  if (error || problems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3 text-center">
        <div className="text-destructive font-mono text-sm">{error || "No problems available to generate mock"}</div>
        <p className="text-xs text-muted-foreground max-w-sm">
          Ensure you have seeded canonical problems and patterns before starting a monthly mock.
        </p>
        <Button variant="secondary" onClick={fetchMockSet} className="text-xs">
          Retry
        </Button>
      </div>
    );
  }

  // Not started state
  if (!started) {
    return (
      <SheetSection innerClassName="max-w-2xl mx-auto space-y-6 py-8">
        <div className="border border-border bg-background p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-2 text-xs font-mono  tracking-wider text-muted-foreground">
            <Timer className="h-4 w-4 text-foreground" />
            <span>Monthly mock assessment</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Timed blind mock set (5 problems)
          </h1>

          <p className="text-sm text-muted-foreground leading-relaxed">
            This mock draws 5 problems from your weakest pattern families.
            To simulate real interview conditions, <span className="text-foreground font-medium">pattern names and difficulty ratings are strictly hidden</span> until you finish.
          </p>

          <p className="text-xs text-muted-foreground leading-relaxed">
            It is the monthly stress test: no labels, no hints, no safe-mode warmup. If you can choose the right strategy under pressure, your review system is doing its job.
          </p>

          <div className="bg-dither-25 p-4 space-y-2 text-xs text-muted-foreground">
            <div className="text-foreground font-semibold text-[11px]">
              Before you start:
            </div>
            <ul className="list-disc list-inside space-y-1">
              <li>Open each problem on the platform and solve unaided.</li>
              <li>Record your outcome: Solved cold, Used hint, or Attempted / failed.</li>
              <li>Attempts are automatically integrated into your FSRS review schedule.</li>
            </ul>
          </div>

          <div className="pt-2">
            <Button
              variant="primary"
              onClick={startMock}
              className="text-xs"
            >
              <Play className="h-3.5 w-3.5 fill-current mr-2" /> Start assessment
            </Button>
          </div>
        </div>
      </SheetSection>
    );
  }

  // Finished state
  if (finished) {
    const coldCount = Object.values(results).filter((r) => r.status === "SOLVED_UNAIDED").length;
    const hintCount = Object.values(results).filter((r) => r.status === "SOLVED_WITH_HELP").length;
    const failCount = Object.values(results).filter((r) => r.status === "ATTEMPTED_FAILED").length;

    return (
      <SheetSection innerClassName="max-w-3xl mx-auto space-y-6 py-8">
        <div className="border border-border bg-background p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono  tracking-wider text-muted-foreground">
                <Award className="h-4 w-4 text-foreground" />
                <span>Assessment complete</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-foreground mt-1">
                Assessment summary
              </h1>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-mono text-muted-foreground ">Total duration</div>
              <div className="text-lg font-bold tabular-nums text-foreground">{formatTime(totalSeconds)}</div>
            </div>
          </div>

          {/* Headline stats using SpecGrid */}
          <SpecGrid columns={3}>
            <SpecCell label="Solved without help" value={`${coldCount}/5`} />
            <SpecCell label="Needed a hint" value={`${hintCount}/5`} />
            <SpecCell label="Could not solve" value={`${failCount}/5`} className={failCount > 0 ? "text-destructive" : ""} />
          </SpecGrid>

          {/* Breakdown with revealed patterns & difficulties */}
          <div className="space-y-3">
            <h2 className="text-xs font-mono font-semibold  tracking-wider text-muted-foreground">
              Revealed problem breakdown
            </h2>

            <div className="divide-y divide-border border-y border-border bg-background text-xs">
              {problems.map((p, idx) => {
                const res = results[p.id];
                const diff = formatDifficulty(p.difficulty);

                return (
                  <div key={p.id} className="p-3.5 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="font-mono">#{idx + 1}</span>
                        {p.number != null && <span className="font-mono text-[11px]">[LC #{p.number}]</span>}
                        <span className={`border px-1.5 py-0.2 text-[10px] font-mono ${diff.className}`}>
                          {diff.label}
                        </span>
                        <Badge variant="secondary" className="text-[10px] font-mono font-normal">
                          {p.patternName}
                        </Badge>
                      </div>
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-foreground hover:text-muted-foreground font-medium transition-colors flex items-center gap-1"
                      >
                        {p.title} <ExternalLink className="h-3 w-3 opacity-60" />
                      </a>
                    </div>

                    <div className="text-right">
                      {res?.status === "SOLVED_UNAIDED" && (
                        <span className="text-easy font-semibold text-xs">Solved without help</span>
                      )}
                      {res?.status === "SOLVED_WITH_HELP" && (
                        <span className="text-medium font-semibold text-xs">Needed a hint</span>
                      )}
                      {res?.status === "ATTEMPTED_FAILED" && (
                        <span className="text-destructive font-semibold text-xs">Could not solve</span>
                      )}
                      <div className="text-[10px] font-mono tabular-nums text-muted-foreground mt-0.5">{res?.minutes}m</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex justify-between items-center">
            <a
              href="/problems"
              className="text-xs text-muted-foreground hover:text-foreground font-mono"
            >
              ← Back to problem grid
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
              className="text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Start another mock
            </Button>
          </div>
        </div>
      </SheetSection>
    );
  }

  // Active mock problem view
  const currentProblem = problems[currentIndex];

  return (
    <SheetSection innerClassName="max-w-2xl mx-auto space-y-6 py-8">
      {/* Top Header with Progress & Timer */}
      <div className="flex items-center justify-between border-b border-border pb-3 font-mono text-xs">
        <div className="flex items-center gap-2">
          <span className="text-foreground font-semibold">
            Problem {currentIndex + 1} of {problems.length}
          </span>
          <span className="text-border">|</span>
          <span className="text-muted-foreground ">{currentProblem.platform}</span>
        </div>

        <div className="flex items-center gap-2 border border-border bg-background px-3 py-1 text-foreground">
          <Timer className="h-3.5 w-3.5 text-foreground animate-pulse" />
          <span className="font-bold tabular-nums">{formatTime(totalSeconds)}</span>
        </div>
      </div>

      {/* Main Problem Card (Pattern & Difficulty intentionally hidden) */}
      <div className="border-y border-border bg-background">
        <div className="p-6 space-y-5">
          <div className="space-y-1">
            <div className="text-[11px] font-mono text-muted-foreground">
              {currentProblem.number != null && `Problem #${currentProblem.number}`}
            </div>
            <a
              href={currentProblem.url}
              target="_blank"
              rel="noreferrer"
              className="text-xl font-bold tracking-tight text-foreground hover:text-muted-foreground transition-colors flex items-center gap-2"
            >
              {currentProblem.title}
              <ExternalLink className="h-4 w-4 opacity-70" />
            </a>
          </div>

          <div className="bg-dither-25 p-3.5 text-xs text-muted-foreground space-y-1">
            <p>
              Solve this problem on {currentProblem.platform === "LEETCODE" ? "LeetCode" : currentProblem.platform} without looking at discussion or related tags.
            </p>
            <p className="text-[11px] font-mono text-muted-foreground">
              Pattern cue & difficulty will be revealed upon completion of the 5-problem set.
            </p>
          </div>

          {/* Outcome buttons */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3">
              <label className="text-xs text-muted-foreground font-mono">Minutes taken:</label>
              <input
                type="number"
                min="1"
                placeholder="auto-timed"
                value={problemMinutes}
                onChange={(e) => setProblemMinutes(e.target.value)}
                className="w-28 border border-border bg-background px-2.5 py-1 text-xs font-mono text-foreground focus:border-foreground focus:outline-none"
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <Button
                variant="easy"
                onClick={() => handleRecordProblem("SOLVED_UNAIDED")}
                disabled={isSubmitting}
                className="text-xs justify-center"
              >
                <Check className="h-3.5 w-3.5 mr-1.5" /> Solved cold
              </Button>
              <Button
                variant="medium"
                onClick={() => handleRecordProblem("SOLVED_WITH_HELP")}
                disabled={isSubmitting}
                className="text-xs justify-center"
              >
                <HelpCircle className="h-3.5 w-3.5 mr-1.5" /> Used hint
              </Button>
              <Button
                variant="failed"
                onClick={() => handleRecordProblem("ATTEMPTED_FAILED")}
                disabled={isSubmitting}
                className="text-xs justify-center"
              >
                <AlertCircle className="h-3.5 w-3.5 mr-1.5" /> Failed / saw solution
              </Button>
            </div>
          </div>
        </div>
      </div>
    </SheetSection>
  );
}
