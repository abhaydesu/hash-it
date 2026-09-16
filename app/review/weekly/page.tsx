"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Target, Eye, AlertTriangle, Clock, CheckCircle2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SheetSection } from "@/components/ui/sheet-section";

interface PatternItem {
  id: string;
  name: string;
  family: string;
  sortOrder: number;
  cue: string;
  avgRetrievability: number;
  hasCards: boolean;
  cardCount: number;
  daysSinceReview: number | null;
  isBelowTarget: boolean;
  isUntouched14Days: boolean;
  lastDrilledAt: string | null;
  sampleProblems: Array<{
    id: string;
    title: string;
    number: number | null;
    url: string;
    difficulty: string | null;
  }>;
}

interface WeeklyData {
  targetRetention: number;
  summary: {
    belowTargetCount: number;
    untouchedCount: number;
    healthyCount: number;
    unpracticedCount: number;
  };
  belowTarget: PatternItem[];
  untouched14Days: PatternItem[];
  healthy: PatternItem[];
  all: PatternItem[];
}

export default function WeeklyReviewPage() {
  const [data, setData] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealedPatterns, setRevealedPatterns] = useState<Record<string, boolean>>({});
  const [answers, setAnswers] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/review/weekly");
      if (!res.ok) throw new Error("Failed to load weekly review data");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleReveal = (id: string) => {
    setRevealedPatterns((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const revealAll = () => {
    if (!data) return;
    const all: Record<string, boolean> = {};
    data.belowTarget.forEach((p) => {
      all[p.id] = true;
    });
    setRevealedPatterns(all);
  };

  const answerPattern = async (patternId: string, correct: boolean) => {
    try {
      const res = await fetch("/api/review/weekly/drill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patternId, correct }),
      });
      if (!res.ok) throw new Error("Failed to record drill");
      setAnswers((prev) => ({ ...prev, [patternId]: correct }));
      window.setTimeout(fetchData, 900);
    } catch (err) {
      setError(String(err));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3 font-mono">
        <div className="h-6 w-48 animate-pulse bg-muted" />
        <div className="h-3 w-72 animate-pulse bg-muted" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <div className="text-destructive font-mono text-xs">{error || "Failed to load drill"}</div>
        <button
          onClick={fetchData}
          className="rounded-none border border-border bg-background px-3 py-1 text-xs text-foreground hover:bg-muted font-mono"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="pb-12">
      {/* Header */}
      <SheetSection innerClassName="py-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Pattern recognition drill
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Read the description, name the technique. Tests recognition, not implementation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-none border border-border bg-muted/20 px-3 py-1 font-mono text-xs text-muted-foreground">
              <span>Target:</span>
              <span className="font-semibold text-foreground tabular-numbers">you should recall {Math.round(data.targetRetention * 10)} in 10</span>
            </div>
            {data.belowTarget.length > 0 && (
              <button
                onClick={revealAll}
                className="rounded-none border border-border bg-background px-3 py-1 text-xs font-mono text-foreground hover:bg-muted transition-colors"
              >
                Reveal all
              </button>
            )}
          </div>
        </div>

        {/* Stats summary bar */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 border border-border divide-x divide-y divide-border bg-border/40 text-xs">
          <div className="bg-background px-3 py-2">
            <span className="text-foreground font-semibold tabular-numbers">{data.summary.belowTargetCount}</span>
            <span className="text-muted-foreground ml-1.5 font-sans">need review</span>
          </div>
          <div className="bg-background px-3 py-2">
            <span className="text-foreground font-semibold tabular-numbers">{data.summary.untouchedCount}</span>
            <span className="text-muted-foreground ml-1.5 font-sans">not practised in 2 weeks</span>
          </div>
          <div className="bg-background px-3 py-2">
            <span className="text-foreground font-semibold tabular-numbers">{data.summary.healthyCount}</span>
            <span className="text-muted-foreground ml-1.5 font-sans">solid</span>
          </div>
          <div className="bg-background px-3 py-2">
            <span className="text-muted-foreground font-semibold tabular-numbers">{data.summary.unpracticedCount}</span>
            <span className="text-muted-foreground ml-1.5 font-sans">never practised</span>
          </div>
        </div>
      </SheetSection>

      {/* Section 1: Weak Patterns (< Target Retrievability) Cue Flashcards */}
      <SheetSection innerClassName="py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 tracking-tight">
            Patterns that need review
          </h2>
          <span className="text-xs text-muted-foreground font-mono tabular-numbers">
            {data.belowTarget.length} need review
          </span>
        </div>

        {data.belowTarget.length === 0 ? (
          <div className="border border-border bg-dither-25 p-6 text-center">
            <CheckCircle2 className="mx-auto h-5 w-5 text-foreground mb-2" />
            <p className="text-sm font-medium text-foreground">All reviewed patterns are above target retention!</p>
            <p className="text-xs text-muted-foreground mt-1">Check untouched patterns or log new problems to expand your repertoire.</p>
          </div>
        ) : (
          <div className="border border-border divide-y divide-border bg-background">
            {data.belowTarget.map((pattern) => {
              const isRevealed = revealedPatterns[pattern.id];
              const answer = answers[pattern.id];
              const retrievabilityPct = (pattern.avgRetrievability * 100).toFixed(0);

              return (
                <div key={pattern.id} className="grid gap-4 p-4 sm:grid-cols-[1fr_150px_auto] sm:items-center">
                  <div className="space-y-2">
                    <p className="text-xs text-foreground leading-relaxed italic">"{pattern.cue}"</p>
                    {isRevealed && (
                      <div className="text-sm font-semibold text-foreground">
                        {pattern.name} <span className="text-xs font-normal text-muted-foreground">({pattern.family})</span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 text-xs text-muted-foreground sm:text-right">
                    <div className="text-[11px]">Recall estimate</div>
                    <div className="whitespace-nowrap font-semibold tabular-numbers text-foreground">{retrievabilityPct}% chance you&apos;d recall this</div>
                  </div>
                  <div>
                    {!isRevealed ? (
                      <button
                        onClick={() => toggleReveal(pattern.id)}
                        className="inline-flex items-center justify-center gap-2 border border-border bg-background px-3 py-2 text-xs text-foreground hover:border-orange-500 hover:text-orange-600 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" /> Reveal pattern
                      </button>
                    ) : answer == null ? (
                      <div className="space-y-2 text-xs">
                        <div className="text-muted-foreground">Did you name it?</div>
                        <div className="flex gap-2">
                          <button onClick={() => answerPattern(pattern.id, true)} className="border border-orange-500 bg-orange-50 px-3 py-1.5 text-orange-700 hover:bg-orange-100">Yes</button>
                          <button onClick={() => answerPattern(pattern.id, false)} className="border border-border px-3 py-1.5 text-foreground hover:border-orange-500">No</button>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Answered — {pattern.name}</span>
                    )}
                  </div>
                  {isRevealed && pattern.sampleProblems.length > 0 && (
                    <div className="sm:col-span-3 flex flex-wrap gap-2 border-t border-border pt-3 text-xs">
                      {pattern.sampleProblems.map((sp) => (
                        <a key={sp.id} href={sp.url} target="_blank" rel="noreferrer" className="text-orange-600 hover:underline">
                          {sp.number ? `#${sp.number}` : sp.title}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SheetSection>

      {/* Section 2: Not practised in 2 weeks */}
      <SheetSection innerClassName="py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 tracking-tight">
            Not practised in 2 weeks
          </h2>
          <span className="text-xs text-muted-foreground font-mono tabular-numbers">
            {data.untouched14Days.length} need practice
          </span>
        </div>

        {data.untouched14Days.length === 0 ? (
          <div className="border border-border bg-dither-25 p-4 text-xs font-mono text-muted-foreground">
            No patterns have been idle for more than 14 days. Good consistency!
          </div>
        ) : (
          <div className="border border-border divide-y divide-border bg-background">
            {data.untouched14Days.map((pattern) => (
              <div
                key={pattern.id}
                className="grid gap-2 p-3.5 sm:grid-cols-[1fr_auto]"
              >
                <div className="flex items-center justify-between gap-3 text-xs font-mono">
                  <span className="font-medium text-foreground font-sans">{pattern.name}</span>
                  <span className="text-muted-foreground tabular-numbers">
                    {pattern.daysSinceReview != null ? `${pattern.daysSinceReview}d ago` : "Never reviewed"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 italic font-sans">"{pattern.cue}"</p>
                <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-1 sm:col-span-2 border-t border-border">
                  <span>Family: {pattern.family}</span>
                  <Link
                    href={`/patterns?selected=${pattern.id}`}
                    className="text-foreground hover:underline flex items-center gap-0.5 font-medium"
                  >
                    View problems <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetSection>
    </div>
  );
}
