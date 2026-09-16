"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, BarChart2, AlertTriangle, Hash, ExternalLink } from "lucide-react";
import { formatDifficulty } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SpecGrid, SpecCell } from "@/components/ui/spec-sheet";
import { SheetSection } from "@/components/ui/sheet-section";

interface StatsData {
  coldSolveRate: number;
  totalAttempts: number;
  coldSolveAttempts: number;
  totalEntries: number;
  totalCards: number;
  totalLapses: number;
  medianMinutes: {
    EASY: number;
    MEDIUM: number;
    HARD: number;
  };
  lapseRate: number;
  leechCount: number;
  leechEntries: Array<{
    entryId: string;
    problemId: string;
    title: string;
    number: number | null;
    url: string;
    difficulty: "EASY" | "MEDIUM" | "HARD" | null;
    platform: string;
    lapses: number;
    mistake: string | null;
  }>;
  countByDifficulty: Record<string, number>;
  countBySourceList: Record<string, number>;
  topMistakeKeywords: Array<{ word: string; count: number }>;
}

export default function StatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error("Failed to load statistics");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3 font-mono">
        <RefreshCw className="h-6 w-6 text-foreground animate-spin" />
        <div className="h-3 w-48 animate-pulse bg-muted" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <div className="text-destructive font-mono text-sm">{error || "Failed to load stats"}</div>
        <Button variant="secondary" onClick={fetchStats} className="text-xs">
          Retry
        </Button>
      </div>
    );
  }

  const coldSolvePct = (data.coldSolveRate * 100).toFixed(1);

  return (
    <div className="pb-12">
      {/* Header */}
      <SheetSection innerClassName="py-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono  tracking-wider text-muted-foreground">
            <BarChart2 className="h-4 w-4 text-foreground" />
            <span>Telemetry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mt-1">
            Performance metrics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            A plain-language view of what you have practised and what needs attention.
          </p>
        </div>
      </SheetSection>

      {/* Top Headline Cards using SpecGrid */}
      <SheetSection innerClassName="py-6" band="none">
      <SpecGrid columns={4}>
        <SpecCell
          label="Solved without help"
          value={<span className="text-easy">{coldSolvePct}%</span>}
          subvalue={`${data.coldSolveAttempts} of ${data.totalAttempts} reviews`}
        />
        <SpecCell
          label="Problems practised"
          value={data.totalEntries}
          subvalue="Entries in your practice log"
        />
        <SpecCell
          label="Times forgotten per problem"
          value={data.lapseRate.toFixed(2)}
          subvalue={`${data.totalLapses} lapses across ${data.totalCards} carded problems`}
        />
        <SpecCell
          label="Typical solve time"
          value={
            <div className="flex items-baseline gap-1.5 text-base sm:text-lg font-bold font-mono">
              <span className="text-easy">{data.medianMinutes.EASY}m</span>
              <span className="text-muted-foreground/60 font-normal">/</span>
              <span className="text-medium">{data.medianMinutes.MEDIUM}m</span>
              <span className="text-muted-foreground/60 font-normal">/</span>
              <span className="text-hard">{data.medianMinutes.HARD}m</span>
            </div>
          }
          subvalue="Easy / Medium / Hard, in minutes"
        />
      </SpecGrid>
      </SheetSection>

      {/* Middle Grid: Breakdowns */}
      <SheetSection innerClassName="py-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
        {/* Difficulty Distribution */}
        <div className="border border-border bg-background p-5 space-y-4">
          <h2 className="text-xs font-mono font-semibold  tracking-wider text-muted-foreground">
            Problems practised by difficulty
          </h2>

          <div className="space-y-3.5">
            {Object.entries(data.countByDifficulty).map(([diff, count]) => {
              const diffInfo = formatDifficulty(diff as any);
              const percentage = data.totalEntries > 0 ? (count / data.totalEntries) * 100 : 0;

              return (
                <div key={diff} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className={`px-1.5 py-0.2 border text-[10px] font-mono ${diffInfo.className}`}>
                      {diffInfo.label}
                    </span>
                    <span className="font-mono text-muted-foreground tabular-nums">
                      {count} ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full bg-muted h-1 overflow-hidden">
                    <div
                      className="bg-foreground h-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Source List Distribution */}
        <div className="border border-border bg-background p-5 space-y-4">
          <h2 className="text-xs font-mono font-semibold  tracking-wider text-muted-foreground">
            Problems by source list
          </h2>

          <div className="space-y-3.5">
            {Object.entries(data.countBySourceList).map(([source, count]) => {
              const percentage = data.totalEntries > 0 ? (count / data.totalEntries) * 100 : 0;

              return (
                <div key={source} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-foreground font-medium">{source}</span>
                    <span className="font-mono text-muted-foreground tabular-nums">
                      {count} ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full bg-muted h-1 overflow-hidden">
                    <div
                      className="bg-foreground/70 h-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </SheetSection>

      {/* Frequency Analysis of Mistakes */}
      <SheetSection innerClassName="py-6 text-xs">
        <div className="border border-border bg-background p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-xs font-mono font-semibold  tracking-wider text-muted-foreground flex items-center gap-2">
            <Hash className="h-4 w-4 text-foreground" /> Top mistake corpus frequency
          </h2>
          <span className="text-[11px] text-muted-foreground">Derived from your mistake notes</span>
        </div>

        {data.topMistakeKeywords.length === 0 ? (
          <div className="bg-dither-25 text-muted-foreground italic py-3">No mistake notes recorded yet.</div>
        ) : (
          <div className="flex flex-wrap gap-2 pt-1">
            {data.topMistakeKeywords.map(({ word, count }) => (
              <div
                key={word}
                className="flex items-center gap-2 border border-border bg-muted/20 px-2.5 py-1 text-foreground"
              >
                <span>{word}</span>
                <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
                  {count}
                </span>
              </div>
            ))}
          </div>
        )}
        </div>
      </SheetSection>

      {/* Leech List Section */}
      <SheetSection innerClassName="py-6 text-xs">
        <div className="border border-border bg-background p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="text-xs font-mono font-semibold  tracking-wider text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" /> Stuck problems
          </h2>
          <span className="font-mono text-destructive tabular-nums">{data.leechCount} problems</span>
        </div>

        {data.leechEntries.length === 0 ? (
          <div className="text-muted-foreground text-xs py-2">0 stuck problems. Nothing has reached three failures.</div>
        ) : (
          <div className="divide-y divide-border border-t border-border pt-1">
            {data.leechEntries.map((leech) => {
              const diff = formatDifficulty(leech.difficulty);

              return (
                <div
                  key={leech.entryId}
                  className="space-y-2.5 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-destructive font-semibold text-xs">
                        Lapses: {leech.lapses}
                      </span>
                      <span className={`border px-1.5 py-0.2 text-[10px] font-mono ${diff.className}`}>
                        {diff.label}
                      </span>
                      <a
                        href={leech.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-foreground hover:text-muted-foreground font-medium transition-colors flex items-center gap-1"
                      >
                        {leech.title} <ExternalLink className="h-3 w-3 opacity-60" />
                      </a>
                    </div>
                    <Link
                      href={`/problems/${leech.entryId}`}
                      className="border border-border bg-background hover:bg-muted px-2.5 py-1 text-[11px] font-mono text-foreground transition-colors"
                    >
                      View detail
                    </Link>
                  </div>

                  {leech.mistake && (
                    <div className="bg-muted/30 border-l-2 border-destructive p-2.5 text-foreground text-xs">
                      <span className="font-mono text-destructive font-semibold  text-[10px] block mb-1">
                        Mistake note:
                      </span>
                      {leech.mistake}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>
      </SheetSection>

      <SheetSection innerClassName="py-6 text-xs">
        <div className="border border-border divide-y divide-border bg-background">
        <div className="p-4">
          <h2 className="text-sm font-semibold text-foreground">What these mean</h2>
        </div>
        {[
          ["Solved without help", "You solved the problem without a hint.", "Good or Easy review ratings divided by all logged review attempts."],
          ["Stuck problems", "You have failed the same problem three or more times.", "Problems whose review card has at least three lapses."],
          ["Recall estimate", "The estimated chance you would remember a pattern now.", "FSRS retrievability calculated from each card's stability and last review."],
          ["Typical solve time", "The median time recorded for each difficulty.", "The middle recorded solve time among entries with a positive duration."],
        ].map(([term, definition, formula]) => (
          <div key={term} className="grid gap-2 p-4 sm:grid-cols-[180px_1fr_1fr]">
            <div className="font-medium text-foreground">{term}</div>
            <div className="text-muted-foreground">{definition}</div>
            <div className="text-muted-foreground">{formula}</div>
          </div>
        ))}
        </div>
      </SheetSection>
    </div>
  );
}
