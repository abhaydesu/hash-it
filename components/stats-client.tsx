"use client";
import React from "react";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { formatDifficulty, safeHref } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SpecGrid, SpecCell } from "@/components/ui/spec-sheet";
import { SheetSection } from "@/components/ui/sheet-section";
import { Heatmap } from "@/components/ui/heatmap";
import { Select } from "@/components/ui/select";

export interface StatsData {
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
  activityMap: Record<string, number>;
}

export function StatsClient({ data }: { data: StatsData }) {
  const [selectedYear, setSelectedYear] = useState<string>("last365");

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    Object.keys(data.activityMap).forEach((dateStr) => {
      const y = dateStr.split("-")[0];
      if (y) years.add(y);
    });
    years.add(new Date().getFullYear().toString());
    return Array.from(years).sort().reverse();
  }, [data.activityMap]);

  const coldSolvePct = (data.coldSolveRate * 100).toFixed(1);

  return (
    <div>
      <SheetSection innerClassName="py-6">
        <h1 className="type-title text-foreground">Stats</h1>
        <p className="mt-1 type-caption">
          What you&apos;ve practised, how you&apos;ve performed, what needs work.
        </p>
      </SheetSection>

      <SheetSection innerClassName="py-6" band="neutral">
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
              <div className="flex items-baseline gap-1.5 text-base font-semibold sm:text-lg">
                <span className="text-easy tabular-nums">{data.medianMinutes.EASY}m</span>
                <span className="font-normal text-muted-foreground/60">/</span>
                <span className="text-medium tabular-nums">{data.medianMinutes.MEDIUM}m</span>
                <span className="font-normal text-muted-foreground/60">/</span>
                <span className="text-hard tabular-nums">{data.medianMinutes.HARD}m</span>
              </div>
            }
            subvalue="Easy / medium / hard, in minutes"
          />
        </SpecGrid>
      </SheetSection>

      <SheetSection innerClassName="space-y-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="type-heading text-foreground">Practice activity</h2>
            <span className="type-caption">Number of problems reviewed per day</span>
          </div>
          <Select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-[140px] h-8 text-xs py-1"
          >
            <option value="last365">Last 365 days</option>
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </Select>
        </div>
        <div className="border border-border bg-background p-4 sm:p-6 overflow-x-auto">
          <Heatmap data={data.activityMap} selectedYear={selectedYear} className="w-full" />
        </div>
      </SheetSection>

      <SheetSection innerClassName="grid grid-cols-1 gap-px border-y-0 bg-transparent py-6 md:grid-cols-2 md:gap-6">
        <div className="space-y-4">
          <h2 className="type-heading text-foreground">Problems practised by difficulty</h2>
          <div className="space-y-3.5">
            {Object.entries(data.countByDifficulty).map(([diff, count]) => {
              const diffInfo = formatDifficulty(diff as "EASY" | "MEDIUM" | "HARD");
              const percentage = data.totalEntries > 0 ? (count / data.totalEntries) * 100 : 0;

              return (
                <div key={diff} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <Badge variant={diffInfo.variant}>{diffInfo.label}</Badge>
                    <span className="tabular-nums type-caption">
                      {count} ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden bg-muted">
                    <div
                      className="h-full origin-left bg-foreground transition-transform duration-modal ease-in-out-strong"
                      style={{ transform: `scaleX(${percentage / 100})` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="type-heading text-foreground">Problems by source list</h2>
          <div className="space-y-3.5">
            {Object.entries(data.countBySourceList).map(([source, count]) => {
              const percentage = data.totalEntries > 0 ? (count / data.totalEntries) * 100 : 0;

              return (
                <div key={source} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{source}</span>
                    <span className="tabular-nums type-caption">
                      {count} ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden bg-muted">
                    <div
                      className="h-full origin-left bg-foreground/70 transition-transform duration-modal ease-in-out-strong"
                      style={{ transform: `scaleX(${percentage / 100})` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </SheetSection>

      <SheetSection innerClassName="space-y-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 type-heading text-destructive">
            <AlertTriangle className="h-4 w-4" /> Stuck problems
          </h2>
          <span className="tabular-nums type-caption text-destructive">
            {data.leechCount} problems
          </span>
        </div>

        {data.leechEntries.length === 0 ? (
          <div className="type-caption py-2">
            0 stuck problems. Nothing has reached three failures.
          </div>
        ) : (
          <div className="divide-y divide-border border border-border bg-background">
            {data.leechEntries.map((leech) => {
              const diff = formatDifficulty(leech.difficulty);

              return (
                <div key={leech.entryId} className="space-y-2.5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Badge variant="status-failed">Lapses: {leech.lapses}</Badge>
                      <Badge variant={diff.variant}>{diff.label}</Badge>
                      {safeHref(leech.url) ? (
                        <a
                          href={safeHref(leech.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 font-medium text-foreground transition-colors hover:text-orange-600"
                        >
                          {leech.title} <ExternalLink className="h-3 w-3 opacity-60" />
                        </a>
                      ) : (
                        <span className="font-medium text-foreground">{leech.title}</span>
                      )}
                    </div>
                    <Link
                      href={`/problems/${leech.entryId}`}
                      className="border border-border bg-background px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-muted"
                    >
                      View detail
                    </Link>
                  </div>

                  {leech.mistake && (
                    <div className="border-l-2 border-destructive bg-muted/30 p-2.5 text-xs text-foreground">
                      <span className="mb-1 block type-label text-destructive">Mistake note</span>
                      <div className="font-mono whitespace-pre-wrap leading-relaxed">
                        {leech.mistake}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SheetSection>

      <SheetSection innerClassName="py-6" last>
        <div className="divide-y divide-border border border-border bg-background text-xs">
          <div className="p-4">
            <h2 className="type-heading text-foreground">What these mean</h2>
          </div>
          {(
            [
              [
                "Solved without help",
                "You solved the problem without a hint.",
                "Good or Easy review ratings divided by all logged review attempts.",
              ],
              [
                "Stuck problems",
                "You have failed the same problem three or more times.",
                "Problems whose review card has at least three lapses.",
              ],
              [
                "Recall estimate",
                "The estimated chance you would remember a pattern now.",
                "FSRS retrievability calculated from each card's stability and last review.",
              ],
              [
                "Typical solve time",
                "The median time recorded for each difficulty.",
                "The middle recorded solve time among entries with a positive duration.",
              ],
            ] as const
          ).map(([term, definition, formula]) => (
            <div key={term} className="grid gap-1 p-3 sm:gap-2 sm:p-4 sm:grid-cols-[180px_1fr_1fr]">
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
