"use client";
import React from 'react';

import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ExternalLink, Search } from "lucide-react";
import { formatDifficulty, formatSolveStatus, safeHref } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { SheetSection } from "@/components/ui/sheet-section";
import { FigureCaption } from "@/components/ui/spec-sheet";
import { PageSkeleton } from "@/components/ui/loader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ProblemItem {
  problemId: string;
  title: string;
  number: number | null;
  url: string;
  difficulty: "EASY" | "MEDIUM" | "HARD" | null;
  platform: string;
  entryId?: string;
  status?: "SOLVED_UNAIDED" | "SOLVED_WITH_HELP" | "ATTEMPTED_FAILED";
  retrievability?: number;
  lapses?: number;
  due?: Date;
  lastReview?: Date | null;
  revisit?: boolean;
}

interface PatternData {
  id: string;
  name: string;
  family: string;
  sortOrder: number;
  cue: string;
  totalProblems: number;
  loggedCount: number;
  solvedCount: number;
  cardCount: number;
  leechCount: number;
  meanRetrievability: number | null;
  lastDrilledAt: string | null;
  problems: ProblemItem[];
}

/** Map mean retrievability → dither density (0 empty/low … 4 high). */
function masteryLevel(r: number | null): 0 | 1 | 2 | 3 | 4 {
  if (r === null) return 0;
  if (r < 0.6) return 1;
  if (r < 0.8) return 2;
  if (r < 0.9) return 3;
  return 4;
}

function PatternsContent() {
  const [patterns, setPatterns] = useState<PatternData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const initialSelectedId = searchParams.get("selected");
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(initialSelectedId);
  const [problemSearch, setProblemSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const fetchPatterns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/patterns");
      if (!res.ok) throw new Error("Failed to load patterns");
      const data = await res.json();
      setPatterns(data.patterns || []);
      if (!selectedPatternId && data.patterns?.length > 0) {
        setSelectedPatternId(data.patterns[0].id);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedPatternId]);

  useEffect(() => {
    fetchPatterns();
  }, [fetchPatterns]);

  const selectedPattern = useMemo(() => {
    return patterns.find((p) => p.id === selectedPatternId) || patterns[0] || null;
  }, [patterns, selectedPatternId]);

  const filteredProblems = useMemo(() => {
    if (!selectedPattern) return [];
    return selectedPattern.problems.filter((p) => {
      if (problemSearch) {
        const query = problemSearch.toLowerCase();
        const matchesTitle = p.title.toLowerCase().includes(query);
        const matchesNum = p.number != null && p.number.toString().includes(query);
        if (!matchesTitle && !matchesNum) return false;
      }
      if (statusFilter === "SOLVED") {
        return p.status === "SOLVED_UNAIDED" || p.status === "SOLVED_WITH_HELP";
      }
      if (statusFilter === "UNSOLVED") {
        return !p.status || p.status === "ATTEMPTED_FAILED";
      }
      if (statusFilter === "LEECH") {
        return p.lapses != null && p.lapses >= 3;
      }
      return true;
    });
  }, [selectedPattern, problemSearch, statusFilter]);

  if (loading) {
    return <PatternsSkeleton />;
  }

  if (error) {
    return (
      <SheetSection band="none" last innerClassName="flex flex-col items-center justify-center min-h-[50vh] gap-3 py-12">
        <div className="type-caption text-destructive">{error}</div>
        <Button variant="secondary" size="sm" onClick={fetchPatterns}>
          Retry
        </Button>
      </SheetSection>
    );
  }

  return (
    <div>
      <SheetSection innerClassName="flex flex-wrap items-center justify-between gap-4 py-6">
        <div>
          <h1 className="type-title text-foreground">Pattern mastery</h1>
          <p className="mt-1 type-caption">
            FSRS mean retrievability across the pattern taxonomy. Select a pattern to inspect weak spots.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 type-caption">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 dither-mastery-4 border border-border" /> Strong
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 dither-mastery-2 border border-border" /> Medium
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 dither-mastery-1 border border-border" /> Weak
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 dither-mastery-0 border border-border" /> New
          </span>
        </div>
      </SheetSection>

      <SheetSection innerClassName="py-6" band="none">
        <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {patterns.map((pattern) => {
            const isSelected = selectedPattern?.id === pattern.id;
            const level = masteryLevel(pattern.meanRetrievability);
            const label =
              pattern.meanRetrievability != null
                ? `${Math.round(pattern.meanRetrievability * 100)}%`
                : "New";

            return (
              <button
                key={pattern.id}
                type="button"
                onClick={() => setSelectedPatternId(pattern.id)}
                className={cn(
                  "relative flex flex-col justify-between overflow-hidden bg-background p-3 text-left transition-colors hover:bg-muted/40",
                  `dither-mastery-${level}`,
                  isSelected && "ring-1 ring-inset ring-orange-500"
                )}
              >
                <div className="relative z-10">
                  <div className="mb-1 flex items-center justify-between gap-2 type-label">
                    <span className="truncate text-muted-foreground">{pattern.family}</span>
                    <span className="tabular-nums text-foreground">{label}</span>
                  </div>
                  <div className="type-heading line-clamp-1 text-foreground">{pattern.name}</div>
                </div>

                <div className="relative z-10 mt-3 flex items-center justify-between type-caption tabular-nums">
                  <span>
                    {pattern.solvedCount}/{pattern.totalProblems} solved
                  </span>
                  {pattern.leechCount > 0 && (
                    <span className="flex items-center gap-0.5 font-medium text-destructive">
                      <AlertTriangle className="h-2.5 w-2.5" /> {pattern.leechCount}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <FigureCaption fig={1} title="Pattern mastery by mean retrievability." />
      </SheetSection>

      {selectedPattern && (
        <SheetSection innerClassName="space-y-4 py-6" last>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="type-heading text-foreground">{selectedPattern.name}</h2>
                <Badge variant="pattern">{selectedPattern.family}</Badge>
                {selectedPattern.meanRetrievability != null && (
                  <Badge variant="outline" className="tabular-nums">
                    {Math.round(selectedPattern.meanRetrievability * 100)}% retrievability
                  </Badge>
                )}
                <span className="type-caption">
                  Last drilled:{" "}
                  {selectedPattern.lastDrilledAt
                    ? new Date(selectedPattern.lastDrilledAt).toLocaleDateString()
                    : "Never"}
                </span>
              </div>
              <p className="mt-1.5 max-w-2xl type-body italic text-muted-foreground">
                &ldquo;{selectedPattern.cue}&rdquo;
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter problems..."
                  value={problemSearch}
                  onChange={(e) => setProblemSearch(e.target.value)}
                  className="rounded-none border border-border bg-background py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-none border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="ALL">All status</option>
                <option value="SOLVED">Solved</option>
                <option value="UNSOLVED">Unsolved / failed</option>
                <option value="LEECH">Leeches only</option>
              </select>
            </div>
          </div>

          <div className="overflow-hidden border border-border bg-background text-xs">
            <table className="w-full text-left">
              <thead className="border-b border-border bg-muted/40 type-label text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">#</th>
                  <th className="px-4 py-2.5 font-medium">Problem</th>
                  <th className="px-4 py-2.5 font-medium">Difficulty</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-center font-medium">Retrievability</th>
                  <th className="px-4 py-2.5 text-center font-medium">Lapses</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredProblems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center type-caption">
                      No problems found matching filters for this pattern.
                    </td>
                  </tr>
                ) : (
                  filteredProblems.map((prob) => {
                    const diff = formatDifficulty(prob.difficulty);
                    const statusInfo = formatSolveStatus(prob.status);

                    return (
                      <tr key={prob.problemId} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                          {prob.number != null ? `#${prob.number}` : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {safeHref(prob.url) ? (
                              <a
                                href={safeHref(prob.url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs font-medium text-foreground transition-colors hover:text-orange-600"
                              >
                                {prob.title}
                                <ExternalLink className="h-3 w-3 opacity-40 hover:opacity-100" />
                              </a>
                            ) : (
                              <span className="text-xs font-medium text-foreground">{prob.title}</span>
                            )}
                            {prob.revisit && <Badge variant="overdue">Revisit</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant={diff.variant}>{diff.label}</Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          {prob.status ? (
                            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                          ) : (
                            <span className="type-caption">Unattempted</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center tabular-nums">
                          {prob.retrievability != null ? (
                            <span className="font-semibold text-foreground">
                              {Math.round(prob.retrievability * 100)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center tabular-nums">
                          {prob.lapses != null && prob.lapses > 0 ? (
                            prob.lapses >= 3 ? (
                              <Badge variant="status-failed">Leech ({prob.lapses})</Badge>
                            ) : (
                              <span className="text-muted-foreground">{prob.lapses}</span>
                            )
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {prob.entryId ? (
                            <Link
                              href={`/problems/${prob.entryId}`}
                              className="inline-flex border border-border bg-background px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-muted"
                            >
                              Detail
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                window.dispatchEvent(
                                  new CustomEvent("open-command-bar-with-query", {
                                    detail: { query: prob.title },
                                  })
                                );
                              }}
                              className="inline-flex border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                              Log
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </SheetSection>
      )}
    </div>
  );
}

export default function PatternsPage() {
  return (
    <Suspense fallback={<PatternsSkeleton />}>
      <PatternsContent />
    </Suspense>
  );
}

function PatternsSkeleton() {
  return (
    <div className="animate-pulse">
      <SheetSection innerClassName="flex flex-wrap items-center justify-between gap-4 py-6">
        <div>
          <div className="h-7 w-48 bg-muted rounded"></div>
          <div className="mt-2 h-4 w-96 bg-muted rounded"></div>
        </div>
        <div className="flex gap-3">
          <div className="h-4 w-16 bg-muted rounded"></div>
          <div className="h-4 w-16 bg-muted rounded"></div>
          <div className="h-4 w-16 bg-muted rounded"></div>
        </div>
      </SheetSection>

      <SheetSection innerClassName="py-6" band="none">
        <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="h-20 bg-background p-3 flex flex-col justify-between">
              <div className="h-3 w-20 bg-muted rounded"></div>
              <div className="flex justify-between">
                <div className="h-4 w-8 bg-muted rounded"></div>
                <div className="h-3 w-12 bg-muted rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </SheetSection>
    </div>
  );
}
