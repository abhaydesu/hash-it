"use client";
import React from "react";

import { useState } from "react";
import Link from "next/link";
import { Eye, CheckCircle2 } from "lucide-react";
import { safeHref } from "@/lib/utils";
import { SheetSection } from "@/components/ui/sheet-section";
import { SpecGrid, SpecCell } from "@/components/ui/spec-sheet";
import { Button } from "@/components/ui/button";

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

export interface WeeklyData {
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

export function WeeklyReviewClient({ data }: { data: WeeklyData }) {
  const [revealedPatterns, setRevealedPatterns] = useState<Record<string, boolean>>({});
  const [answers, setAnswers] = useState<Record<string, boolean>>({});

  const toggleReveal = (id: string) => {
    setRevealedPatterns((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const revealAll = () => {
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
    } catch (err) {
      console.error("Failed to record drill", err);
    }
  };

  return (
    <div>
      <SheetSection innerClassName="py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="type-title text-foreground">Pattern recognition drill</h1>
            <p className="mt-1 type-caption">
              Read the description, name the technique. Tests recognition, not implementation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="type-caption">
              Target: you should recall{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {Math.round(data.targetRetention * 10)}
              </span>{" "}
              in 10
            </div>
            {data.belowTarget.length > 0 && (
              <Button variant="secondary" size="sm" onClick={revealAll}>
                Reveal all
              </Button>
            )}
          </div>
        </div>
      </SheetSection>

      <SheetSection innerClassName="py-6" band="neutral">
        <SpecGrid columns={4}>
          <SpecCell label="Need review" value={data.summary.belowTargetCount} />
          <SpecCell label="Not practised in 2 weeks" value={data.summary.untouchedCount} />
          <SpecCell label="Solid" value={data.summary.healthyCount} />
          <SpecCell label="Never practised" value={data.summary.unpracticedCount} />
        </SpecGrid>
      </SheetSection>

      <SheetSection innerClassName="space-y-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="type-heading text-foreground">Patterns that need review</h2>
          <span className="type-caption tabular-nums">{data.belowTarget.length} need review</span>
        </div>

        {data.belowTarget.length === 0 ? (
          <div className="border border-border bg-dither-25 px-4 py-8 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-foreground" />
            <p className="text-sm font-medium text-foreground">
              All reviewed patterns are above target retention.
            </p>
            <p className="mt-1 type-caption">
              Check untouched patterns or log new problems to expand your repertoire.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border border border-border bg-background">
            {data.belowTarget.map((pattern) => {
              const isRevealed = revealedPatterns[pattern.id];
              const answer = answers[pattern.id];
              const retrievabilityPct = Math.round(pattern.avgRetrievability * 100);

              return (
                <div key={pattern.id} className="space-y-4 p-4 sm:p-5">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(140px,180px)_auto] lg:items-start">
                    <div className="min-w-0 space-y-2">
                      <p className="type-body italic leading-relaxed text-foreground">
                        &ldquo;{pattern.cue}&rdquo;
                      </p>
                      {isRevealed && (
                        <div className="type-heading text-foreground">
                          {pattern.name}{" "}
                          <span className="type-caption font-normal">({pattern.family})</span>
                        </div>
                      )}
                    </div>

                    <SpecCell
                      label="Retrievability"
                      value={`${retrievabilityPct}%`}
                      subvalue="Chance you'd recall this"
                      className="bg-transparent p-0"
                    />

                    <div className="shrink-0">
                      {!isRevealed ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => toggleReveal(pattern.id)}
                          className="hover:border-orange-500 hover:text-orange-600"
                        >
                          <Eye className="h-3.5 w-3.5" /> Reveal pattern
                        </Button>
                      ) : answer == null ? (
                        <div className="space-y-2 text-xs">
                          <div className="type-label">Did you name it?</div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => answerPattern(pattern.id, true)}
                            >
                              Yes
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => answerPattern(pattern.id, false)}
                            >
                              No
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <span className="type-caption">Answered — {pattern.name}</span>
                      )}
                    </div>
                  </div>

                  {isRevealed && pattern.sampleProblems.length > 0 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-3 type-caption">
                      {pattern.sampleProblems.map((sp) => (
                        <a
                          key={sp.id}
                          href={safeHref(sp.url) || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-600 hover:text-orange-700 hover:underline"
                        >
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

      <SheetSection innerClassName="space-y-4 py-6" last>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="type-heading text-foreground">Not practised in 2 weeks</h2>
          <span className="type-caption tabular-nums">
            {data.untouched14Days.length} need practice
          </span>
        </div>

        {data.untouched14Days.length === 0 ? (
          <div className="border border-border bg-dither-25 px-4 py-6 type-caption">
            No patterns have been idle for more than 14 days. Good consistency.
          </div>
        ) : (
          <div className="divide-y divide-border border border-border bg-background">
            {data.untouched14Days.map((pattern) => (
              <div key={pattern.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="type-heading text-foreground">{pattern.name}</span>
                  <span className="type-caption tabular-nums">
                    {pattern.daysSinceReview != null
                      ? `${pattern.daysSinceReview}d ago`
                      : "Never reviewed"}
                  </span>
                </div>
                <p className="type-caption italic line-clamp-2">
                  &ldquo;{pattern.cue}&rdquo;
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 type-caption">
                  <span>{pattern.family}</span>
                  <Link
                    href={`/patterns?selected=${pattern.id}`}
                    className="font-medium text-orange-600 hover:text-orange-700 hover:underline"
                  >
                    View problems
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
