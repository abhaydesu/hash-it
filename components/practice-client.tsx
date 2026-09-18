"use client";
import React from "react";

import { useState, useTransition } from "react";
import { ExternalLink, RefreshCw, CheckCircle2 } from "lucide-react";
import { cn, safeHref } from "@/lib/utils";
import { fetchPracticeSet } from "@/app/actions/practice-actions";

import { SheetSection } from "@/components/ui/sheet-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PracticePattern, PracticeProblem } from "@/lib/practice";

interface ProblemSet {
  easy: PracticeProblem | null;
  medium: PracticeProblem | null;
  hard: PracticeProblem | null;
}

function difficultyColor(d: string) {
  if (d === "EASY") return "text-easy border-easy/35";
  if (d === "MEDIUM") return "text-medium border-medium/35";
  return "text-hard border-hard/35";
}

function ProblemCard({
  problem,
  onLog,
}: {
  problem: PracticeProblem;
  onLog: (problemId: string) => void;
}) {
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(problem.isLogged);
  const href = safeHref(problem.url);

  const handleLog = () => {
    window.dispatchEvent(
      new CustomEvent("open-command-bar", {
        detail: {
          problem: {
            id: problem.id,
            title: problem.title,
            difficulty: problem.difficulty,
            url: problem.url,
            patterns: [],
            topicTags: [],
          },
        },
      })
    );
  };

  return (
    <div className="flex flex-col justify-between border border-border bg-background">
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant={
              problem.difficulty === "EASY"
                ? "easy"
                : problem.difficulty === "MEDIUM"
                  ? "medium"
                  : "hard"
            }
          >
            {problem.difficulty === "EASY"
              ? "Easy"
              : problem.difficulty === "MEDIUM"
                ? "Medium"
                : "Hard"}
          </Badge>
          {problem.number != null && (
            <span className="type-caption tabular-nums">#{problem.number}</span>
          )}
        </div>

        <span className="text-sm font-medium text-foreground">{problem.title}</span>
      </div>
      <div className="flex gap-2 border-t border-border p-3">
        {href && (
          <Button
            variant="primary"
            size="sm"
            className="flex-1 justify-center gap-1.5"
            onClick={() => window.open(href, '_blank', 'noopener,noreferrer')}
          >
            Solve
          </Button>
        )}
        {logged ? (
          <div className="flex flex-1 items-center justify-center gap-1.5 rounded-sm bg-muted/40 text-xs text-easy">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Logged</span>
          </div>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleLog}
            disabled={logging}
            className="flex-1 justify-center"
          >
            {logging ? "Logging…" : "Log problem"}
          </Button>
        )}
      </div>
    </div>
  );
}

const FEATURED_PATTERNS = new Set([
  "Dynamic Programming",
  "BFS",
  "DFS",
  "Backtracking",
]);

export function PracticeClient({ patterns }: { patterns: PracticePattern[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [problemSet, setProblemSet] = useState<ProblemSet | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedPattern = patterns.find((p) => p.id === selectedId);

  const loadProblems = (patternId: string) => {
    setSelectedId(patternId);
    setProblemSet(null);
    startTransition(async () => {
      const set = await fetchPracticeSet(patternId);
      setProblemSet(set);
    });
  };

  const shuffle = () => {
    if (selectedId) {
      setProblemSet(null);
      startTransition(async () => {
        const set = await fetchPracticeSet(selectedId);
        setProblemSet(set);
      });
    }
  };

  const handleLog = () => {
    // Problem logged — no need to refetch, card updates in-place
  };

  const problems = problemSet
    ? [problemSet.easy, problemSet.medium, problemSet.hard].filter(Boolean) as PracticeProblem[]
    : [];

  return (
    <div>
      <SheetSection innerClassName="py-6">
        <h1 className="type-title text-foreground">Practice</h1>
        <p className="mt-1 type-caption">
          Pick a pattern. Get problems you haven&apos;t solved yet.
        </p>
      </SheetSection>

      <SheetSection innerClassName="py-6" band="none">
        <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {patterns.map((pattern) => {
            const isSelected = selectedId === pattern.id;
            const isFeatured = FEATURED_PATTERNS.has(pattern.name);
            return (
              <button
                key={pattern.id}
                type="button"
                onClick={() => loadProblems(pattern.id)}
                className={cn(
                  "flex flex-col justify-between bg-background p-3 text-left transition-colors hover:bg-muted/40",
                  isSelected && "ring-1 ring-inset ring-orange-500",
                  isFeatured && "lg:col-span-2"
                )}
              >
                <div>
                  <div className="mb-1 type-label text-muted-foreground truncate">
                    {pattern.family}
                  </div>
                  <div className="type-heading line-clamp-1 text-foreground">{pattern.name}</div>
                </div>
                <div className="mt-2 type-caption tabular-nums">
                  {pattern.problemCount} problems
                </div>
              </button>
            );
          })}
        </div>
      </SheetSection>

      {selectedPattern && (
        <SheetSection innerClassName="space-y-5 py-6" last>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="type-heading text-foreground">{selectedPattern.name}</h2>
              <p className="mt-0.5 type-caption">
                {problems.length > 0
                  ? "Solve on LeetCode, then log your attempt."
                  : isPending
                    ? "Loading problems…"
                    : "No problems found for this pattern."}
              </p>
            </div>
            {problems.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={shuffle}
                disabled={isPending}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin")} />
                Shuffle
              </Button>
            )}
          </div>

          {isPending && problems.length === 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-36 animate-pulse border border-border bg-muted/30" />
              ))}
            </div>
          ) : problems.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {problems.map((p) => (
                <ProblemCard key={p.id} problem={p} onLog={handleLog} />
              ))}
            </div>
          ) : null}
        </SheetSection>
      )}
    </div>
  );
}
