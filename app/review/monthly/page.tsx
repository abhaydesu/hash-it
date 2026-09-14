"use client";

import { useEffect, useState, useRef } from "react";
import { Timer, Check, HelpCircle, AlertCircle, Play, RotateCcw, Award, ChevronRight, ExternalLink } from "lucide-react";
import { recordReviewAttempt, createEntry } from "@/app/actions/entry-actions";
import { formatDifficulty } from "@/lib/utils";

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
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3 font-mono">
        <Timer className="h-6 w-6 text-emerald-500 animate-spin" />
        <span className="text-xs text-zinc-500">GENERATING_BLIND_MOCK_SET...</span>
      </div>
    );
  }

  if (error || problems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3 text-center">
        <div className="text-rose-400 font-mono text-sm">{error || "No problems available to generate mock"}</div>
        <p className="text-xs text-zinc-500 max-w-sm">
          Ensure you have seeded canonical problems and patterns before starting a monthly mock.
        </p>
        <button
          onClick={fetchMockSet}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-mono text-zinc-200 hover:bg-zinc-800"
        >
          Retry
        </button>
      </div>
    );
  }

  // Not started state
  if (!started) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pt-6 animate-in fade-in">
        <div className="border border-zinc-800 bg-zinc-950 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2 font-mono text-xs text-emerald-400">
            <Timer className="h-4 w-4" />
            <span>MONTHLY_MOCK_ASSESSMENT</span>
          </div>
          <h1 className="text-xl font-bold font-mono text-zinc-100">
            Timed Blind Mock Set (5 Problems)
          </h1>
          <p className="text-xs text-zinc-400 leading-relaxed font-sans">
            This mock draws 5 problems from your weakest pattern families.
            To simulate real interview conditions, <span className="text-zinc-200 font-medium">pattern names and difficulty ratings are strictly hidden</span> until you finish.
          </p>
          <p className="text-xs text-zinc-500 leading-relaxed font-sans">
            It is the monthly stress test: no labels, no hints, no safe-mode warmup. If you can choose the right strategy under pressure, your review system is doing its job.
          </p>

          <div className="rounded border border-zinc-800/80 bg-zinc-900/40 p-4 space-y-2 font-mono text-xs text-zinc-400">
            <div className="text-zinc-300 font-semibold uppercase tracking-wider">Protocol:</div>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li>Open each problem on the platform and solve unaided.</li>
              <li>Record your outcome: Solved Cold, Used Hint, or Attempted/Failed.</li>
              <li>Attempts are automatically integrated into your FSRS review schedule.</li>
            </ul>
          </div>

          <div className="pt-2">
            <button
              onClick={startMock}
              className="flex items-center gap-2 rounded border border-emerald-600 bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-colors"
            >
              <Play className="h-4 w-4 fill-zinc-950" /> Start Assessment
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Finished state
  if (finished) {
    const coldCount = Object.values(results).filter((r) => r.status === "SOLVED_UNAIDED").length;
    const hintCount = Object.values(results).filter((r) => r.status === "SOLVED_WITH_HELP").length;
    const failCount = Object.values(results).filter((r) => r.status === "ATTEMPTED_FAILED").length;

    return (
      <div className="max-w-3xl mx-auto space-y-6 pt-4 animate-in fade-in">
        <div className="border border-zinc-800 bg-zinc-950 rounded-lg p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                <Award className="h-4 w-4" />
                <span>MOCK_COMPLETED</span>
              </div>
              <h1 className="text-xl font-bold font-mono text-zinc-100 mt-1">
                Assessment Summary
              </h1>
            </div>
            <div className="text-right font-mono">
              <div className="text-xs text-zinc-500">Total Duration</div>
              <div className="text-lg font-bold text-zinc-200">{formatTime(totalSeconds)}</div>
            </div>
          </div>

          {/* Headline stats */}
          <div className="grid grid-cols-3 gap-3 font-mono text-center">
            <div className="rounded border border-emerald-900/60 bg-emerald-950/20 p-3">
              <div className="text-xl font-bold text-emerald-400">{coldCount}/5</div>
              <div className="text-[11px] text-zinc-400 mt-0.5">Solved Cold</div>
            </div>
            <div className="rounded border border-sky-900/60 bg-sky-950/20 p-3">
              <div className="text-xl font-bold text-sky-400">{hintCount}/5</div>
              <div className="text-[11px] text-zinc-400 mt-0.5">Used Hint</div>
            </div>
            <div className="rounded border border-rose-900/60 bg-rose-950/20 p-3">
              <div className="text-xl font-bold text-rose-400">{failCount}/5</div>
              <div className="text-[11px] text-zinc-400 mt-0.5">Failed / Solution</div>
            </div>
          </div>

          {/* Breakdown with revealed patterns & difficulties */}
          <div className="space-y-3">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400">
              Revealed Problem Breakdown
            </h2>

            <div className="divide-y divide-zinc-800/80 border border-zinc-800 rounded-lg overflow-hidden font-mono text-xs">
              {problems.map((p, idx) => {
                const res = results[p.id];
                const diff = formatDifficulty(p.difficulty);

                return (
                  <div key={p.id} className="p-3 bg-zinc-900/30 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-zinc-400">
                        <span>#{idx + 1}</span>
                        {p.number != null && <span>[LC #{p.number}]</span>}
                        <span className={`rounded border px-1.5 py-0.2 text-[10px] ${diff.className}`}>
                          {diff.label}
                        </span>
                        <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300">
                          {p.patternName}
                        </span>
                      </div>
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-zinc-200 hover:text-emerald-400 font-medium transition-colors flex items-center gap-1"
                      >
                        {p.title} <ExternalLink className="h-3 w-3 opacity-60" />
                      </a>
                    </div>

                    <div className="text-right">
                      {res?.status === "SOLVED_UNAIDED" && (
                        <span className="text-emerald-400 font-semibold">SOLVED_COLD</span>
                      )}
                      {res?.status === "SOLVED_WITH_HELP" && (
                        <span className="text-sky-400 font-semibold">USED_HINT</span>
                      )}
                      {res?.status === "ATTEMPTED_FAILED" && (
                        <span className="text-rose-400 font-semibold">FAILED</span>
                      )}
                      <div className="text-[10px] text-zinc-500 mt-0.5">{res?.minutes}m</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex justify-between items-center">
            <a
              href="/problems"
              className="text-xs font-mono text-zinc-400 hover:text-zinc-200"
            >
              ← Back to Problem Grid
            </a>
            <button
              onClick={() => {
                setStarted(false);
                setFinished(false);
                setResults({});
                setCurrentIndex(0);
                fetchMockSet();
              }}
              className="flex items-center gap-2 rounded border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-xs font-mono text-zinc-200 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Start Another Mock
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active mock problem view
  const currentProblem = problems[currentIndex];

  return (
    <div className="max-w-2xl mx-auto space-y-6 pt-4 animate-in fade-in">
      {/* Top Header with Progress & Timer */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3 font-mono text-xs">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-semibold">
            PROBLEM {currentIndex + 1} OF {problems.length}
          </span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-400 uppercase">{currentProblem.platform}</span>
        </div>

        <div className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900 px-3 py-1 text-zinc-200">
          <Timer className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
          <span className="font-bold">{formatTime(totalSeconds)}</span>
        </div>
      </div>

      {/* Main Problem Card (Pattern & Difficulty intentionally hidden) */}
      <div className="border border-zinc-800 bg-zinc-950 rounded-lg overflow-hidden">
        <div className="p-6 space-y-5">
          <div className="space-y-1">
            <div className="text-[11px] font-mono text-zinc-500">
              {currentProblem.number != null && `Problem #${currentProblem.number}`}
            </div>
            <a
              href={currentProblem.url}
              target="_blank"
              rel="noreferrer"
              className="text-xl font-bold font-mono text-zinc-100 hover:text-emerald-400 transition-colors flex items-center gap-2"
            >
              {currentProblem.title}
              <ExternalLink className="h-4 w-4 opacity-70" />
            </a>
          </div>

          <div className="rounded border border-zinc-800/80 bg-zinc-900/40 p-3.5 text-xs font-sans text-zinc-400 space-y-1">
            <p>
              Solve this problem on {currentProblem.platform === "LEETCODE" ? "LeetCode" : currentProblem.platform} without looking at discussion or related tags.
            </p>
            <p className="text-[11px] font-mono text-zinc-500">
              Pattern cue & difficulty will be revealed upon completion of the 5-problem set.
            </p>
          </div>

          {/* Outcome buttons */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3">
              <label className="text-xs font-mono text-zinc-400">Minutes taken:</label>
              <input
                type="number"
                min="1"
                placeholder="auto-timed"
                value={problemMinutes}
                onChange={(e) => setProblemMinutes(e.target.value)}
                className="w-28 rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs font-mono text-zinc-200 focus:border-emerald-500 focus:outline-none"
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <button
                onClick={() => handleRecordProblem("SOLVED_UNAIDED")}
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 rounded border border-emerald-800 bg-emerald-950/40 hover:bg-emerald-900 px-4 py-2.5 text-xs font-mono font-medium text-emerald-300 transition-colors disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" /> Solved Cold
              </button>
              <button
                onClick={() => handleRecordProblem("SOLVED_WITH_HELP")}
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 rounded border border-sky-800 bg-sky-950/40 hover:bg-sky-900 px-4 py-2.5 text-xs font-mono font-medium text-sky-300 transition-colors disabled:opacity-50"
              >
                <HelpCircle className="h-3.5 w-3.5" /> Used Hint
              </button>
              <button
                onClick={() => handleRecordProblem("ATTEMPTED_FAILED")}
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 rounded border border-rose-800 bg-rose-950/40 hover:bg-rose-900 px-4 py-2.5 text-xs font-mono font-medium text-rose-300 transition-colors disabled:opacity-50"
              >
                <AlertCircle className="h-3.5 w-3.5" /> Failed / Saw Solution
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
