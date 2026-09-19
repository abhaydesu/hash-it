"use client";
import React, { useState } from "react";
import {
  AlertCircle,
  HelpCircle,
  Clock,
  Check,
  Brain,
} from "lucide-react";

interface DemoProblem {
  number: number;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  family: string;
  idea: string;
  lane: "RESOLVE" | "RECALL";
}

const DEMO_QUEUE: DemoProblem[] = [
  {
    number: 146,
    title: "LRU Cache",
    difficulty: "Hard",
    family: "Design",
    idea: "Doubly linked list + hash map. Move to head on access, evict tail on capacity.",
    lane: "RESOLVE",
  },
  {
    number: 3,
    title: "Longest Substring Without Repeating Characters",
    difficulty: "Medium",
    family: "Sliding Window",
    idea: "Expand right pointer, contract left when duplicate found via set. Track max window size.",
    lane: "RECALL",
  },
  {
    number: 21,
    title: "Merge Two Sorted Lists",
    difficulty: "Easy",
    family: "Linked List",
    idea: "Dummy head, compare nodes, advance the smaller. Attach remainder at the end.",
    lane: "RECALL",
  },
];

const INTERVALS: Record<string, number> = {
  SOLVED_UNAIDED: 14,
  SOLVED_WITH_HELP: 4,
  ATTEMPTED_FAILED: 1,
  GOOD: 21,
  HARD: 7,
  AGAIN: 1,
};

function diffClasses(d: "Easy" | "Medium" | "Hard") {
  if (d === "Easy") return "border-easy/50 text-easy";
  if (d === "Hard") return "border-hard/50 text-hard";
  return "border-medium/50 text-medium";
}

function ResolveCard({ problem }: { problem: DemoProblem }) {
  const [minutes, setMinutes] = useState("");
  const [result, setResult] = useState<{ label: string; days: number } | null>(null);

  const handleOutcome = (status: "SOLVED_UNAIDED" | "SOLVED_WITH_HELP" | "ATTEMPTED_FAILED") => {
    if (status !== "ATTEMPTED_FAILED" && !minutes.trim()) return;
    const labels: Record<string, string> = {
      SOLVED_UNAIDED: "Solved cold",
      SOLVED_WITH_HELP: "Used hint",
      ATTEMPTED_FAILED: "Failed",
    };
    setResult({ label: labels[status], days: INTERVALS[status] });
  };

  if (result) {
    return (
      <article className="idea-preview border border-border bg-background p-4 sm:p-5">
        <div className="type-heading text-foreground">{problem.title}</div>
        <p className="mt-2 type-caption">
          Next review in{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {result.days} day{result.days !== 1 ? "s" : ""}
          </span>
          . Pattern family: {problem.family}.
        </p>
      </article>
    );
  }

  return (
    <article className="border border-border bg-background">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="type-label mb-1 flex flex-wrap items-center gap-2 tabular-nums">
            <span>#{problem.number}</span>
            <span>LeetCode</span>
          </div>
          <div className="type-heading text-foreground">{problem.title}</div>
        </div>
        <span className={`shrink-0 border px-1.5 py-0.5 text-[11px] font-medium ${diffClasses(problem.difficulty)}`}>
          {problem.difficulty}
        </span>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <p className="type-caption">
          Solve this problem on LeetCode, then record your outcome.
        </p>
        <div className="flex items-center gap-3">
          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="number"
            min="0"
            placeholder="Minutes taken"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="w-full max-w-xs border border-border bg-background px-3 py-1.5 text-sm tabular-nums text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => handleOutcome("SOLVED_UNAIDED")}
            className="pressable inline-flex h-9 items-center justify-center gap-1.5 text-sm font-medium outcome-fill-good w-full"
          >
            <Check className="h-3.5 w-3.5" /> Solved cold
          </button>
          <button
            type="button"
            onClick={() => handleOutcome("SOLVED_WITH_HELP")}
            className="pressable inline-flex h-9 items-center justify-center gap-1.5 text-sm font-medium outcome-fill-hint w-full"
          >
            <HelpCircle className="h-3.5 w-3.5" /> Used hint
          </button>
          <button
            type="button"
            onClick={() => handleOutcome("ATTEMPTED_FAILED")}
            className="pressable inline-flex h-9 items-center justify-center gap-1.5 text-sm font-medium outcome-fill-failed w-full"
          >
            <AlertCircle className="h-3.5 w-3.5" /> Failed
          </button>
        </div>
      </div>
    </article>
  );
}

function RecallCard({ problem }: { problem: DemoProblem }) {
  const [approach, setApproach] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ label: string; days: number } | null>(null);

  const handleRate = (rating: "GOOD" | "HARD" | "AGAIN") => {
    const labels: Record<string, string> = { GOOD: "Matched", HARD: "Close", AGAIN: "Blank" };
    setResult({ label: labels[rating], days: INTERVALS[rating] });
  };

  if (result) {
    return (
      <article className="idea-preview border border-border bg-background p-4 sm:p-5">
        <div className="type-heading text-foreground">{problem.title}</div>
        <p className="mt-2 type-caption">
          Next review in{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {result.days} day{result.days !== 1 ? "s" : ""}
          </span>
          . Pattern family: {problem.family}.
        </p>
      </article>
    );
  }

  return (
    <article className="border border-border bg-background">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="type-label mb-1 flex flex-wrap items-center gap-2 tabular-nums">
            <span>#{problem.number}</span>
            <span className="inline-flex items-center gap-1 text-foreground">
              <Brain className="h-3 w-3" /> Quick recall
            </span>
          </div>
          <div className="type-heading text-foreground">{problem.title}</div>
        </div>
        <span className={`shrink-0 border px-1.5 py-0.5 text-[11px] font-medium ${diffClasses(problem.difficulty)}`}>
          {problem.difficulty}
        </span>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {!submitted ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (approach.trim()) setSubmitted(true);
            }}
            className="space-y-3"
          >
            <label className="type-label block">Write the approach from memory</label>
            <textarea
              value={approach}
              onChange={(e) => setApproach(e.target.value)}
              rows={3}
              placeholder="Key idea, structure, edge cases…"
              className="w-full border border-border bg-background p-3 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-500 resize-y"
            />
            <button
              type="submit"
              disabled={!approach.trim()}
              className="pressable inline-flex h-8 items-center gap-1.5 bg-orange-500 px-3 text-xs font-medium text-white hover:bg-orange-600 disabled:pointer-events-none disabled:opacity-40"
            >
              Check against notes
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-2">
              <div className="bg-background">
                <div className="type-label border-b border-border bg-muted/30 px-3 py-1.5">You wrote</div>
                <div className="p-3 text-sm font-mono whitespace-pre-wrap">{approach}</div>
              </div>
              <div className="bg-background">
                <div className="type-label border-b border-border bg-muted/30 px-3 py-1.5">Your notes</div>
                <div className="p-3 text-sm font-mono whitespace-pre-wrap text-muted-foreground">
                  {problem.idea}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleRate("GOOD")}
                className="pressable inline-flex h-8 items-center gap-1.5 px-3 text-xs font-medium outcome-fill-good"
              >
                Matched
              </button>
              <button
                type="button"
                onClick={() => handleRate("HARD")}
                className="pressable inline-flex h-8 items-center gap-1.5 px-3 text-xs font-medium outcome-fill-hint"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleRate("AGAIN")}
                className="pressable inline-flex h-8 items-center gap-1.5 px-3 text-xs font-medium border border-hard/50 bg-background text-hard hover:bg-hard/10"
              >
                Blank
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export function HeroDemo() {
  const recallCount = DEMO_QUEUE.filter((p) => p.lane === "RECALL").length;
  const resolveCount = DEMO_QUEUE.filter((p) => p.lane === "RESOLVE").length;

  return (
    <div className="mx-auto max-w-4xl overflow-hidden border border-border bg-background">
      {/* Queue header — mirrors TodayClient */}
      <div className="flex flex-col gap-1 border-b border-border px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
        <h2 className="type-heading text-foreground">Review queue</h2>
        <p className="type-caption tabular-nums">
          <span className="font-semibold text-foreground">{recallCount}</span> quick recall and{" "}
          <span className="font-semibold text-foreground">{resolveCount}</span> full re-solve
        </p>
      </div>

      {/* Scrollable card list */}
      <div className="max-h-[420px] overflow-y-auto overscroll-contain">
        <div className="space-y-3 p-3 sm:p-4">
          {DEMO_QUEUE.map((problem) =>
            problem.lane === "RESOLVE" ? (
              <ResolveCard key={problem.number} problem={problem} />
            ) : (
              <RecallCard key={problem.number} problem={problem} />
            )
          )}
        </div>
      </div>

      {/* Hint */}
      <div className="border-t border-border bg-muted/20 px-4 py-2 text-center">
        <p className="text-[11px] text-muted-foreground">
          Try it — interact with the cards above
        </p>
      </div>
    </div>
  );
}
