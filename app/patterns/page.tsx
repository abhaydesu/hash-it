"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RefreshCw, Sparkles, AlertTriangle, ExternalLink, Search } from "lucide-react";
import { formatDifficulty, formatSolveStatus, safeHref } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { SheetSection } from "@/components/ui/sheet-section";

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

function PatternsContent() {
  const [patterns, setPatterns] = useState<PatternData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const initialSelectedId = searchParams.get("selected");
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(initialSelectedId);
  const [problemSearch, setProblemSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const fetchPatterns = async () => {
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
  };

  useEffect(() => {
    fetchPatterns();
  }, []);

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
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3 font-mono">
        <div className="h-6 w-48 bg-dither-25" />
        <span className="text-xs text-muted-foreground tracking-wider ">Computing pattern heatmap...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <div className="text-destructive font-mono text-xs">{error}</div>
        <button
          onClick={fetchPatterns}
          className="rounded-none border border-border bg-background px-3 py-1 text-xs font-mono text-foreground hover:bg-muted"
        >
          Retry
        </button>
      </div>
    );
  }

  // Mastery score color badge helper
  const getMasteryVisuals = (r: number | null) => {
    if (r === null) {
      return {
        bg: "bg-background hover:bg-muted/40 border-border text-muted-foreground",
        texture: "",
        bar: "bg-muted-foreground",
        label: "new",
        textColor: "text-muted-foreground",
      };
    }
    if (r >= 0.9) {
      return {
        bg: "bg-background hover:bg-muted/60 border-border text-foreground",
        texture: "bg-dither-25",
        bar: "bg-foreground",
        label: `${(r * 100).toFixed(0)}%`,
        textColor: "text-foreground font-semibold",
      };
    }
    if (r >= 0.8) {
      return {
        bg: "bg-background hover:bg-muted/50 border-border text-foreground",
        texture: "bg-dither-25",
        bar: "bg-foreground/80",
        label: `${(r * 100).toFixed(0)}%`,
        textColor: "text-foreground font-medium",
      };
    }
    if (r >= 0.6) {
      return {
        bg: "bg-background hover:bg-muted/30 border-border text-foreground",
        texture: "bg-dither-50",
        bar: "bg-foreground/60",
        label: `${(r * 100).toFixed(0)}%`,
        textColor: "text-muted-foreground",
      };
    }
    return {
      bg: "bg-background hover:bg-muted/70 border-border text-foreground",
      texture: "bg-dither-50",
      bar: "bg-foreground/40",
      label: `${(r * 100).toFixed(0)}%`,
      textColor: "text-foreground",
    };
  };

  return (
    <div className="pb-12">
      <SheetSection innerClassName="flex flex-wrap items-center justify-between gap-4 py-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Pattern mastery
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            FSRS mean retrievability across the pattern taxonomy. Select a pattern to inspect weak spots.
          </p>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono  text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 bg-foreground" /> strong (≥90%)</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 bg-foreground/60" /> medium (60-89%)</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 bg-foreground/40" /> weak (&lt;60%)</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 bg-muted-foreground" /> new</span>
        </div>
      </SheetSection>

      {/* Hero: Pattern Mastery Grid */}
      <SheetSection innerClassName="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 py-6" band="none">
        {patterns.map((pattern) => {
          const isSelected = selectedPattern?.id === pattern.id;
          const visuals = getMasteryVisuals(pattern.meanRetrievability);
          const percent = pattern.meanRetrievability != null ? Math.round(pattern.meanRetrievability * 100) : 0;

          return (
            <button
              key={pattern.id}
              onClick={() => setSelectedPatternId(pattern.id)}
              className={cn(
                "relative text-left p-3 border transition-all flex flex-col justify-between overflow-hidden rounded-none",
                visuals.bg,
                isSelected ? "border-foreground ring-1 ring-foreground z-10" : ""
              )}
            >
              {visuals.texture && <span aria-hidden="true" className={cn("pointer-events-none absolute inset-0", visuals.texture)} />}
              <div className="relative z-10">
                <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                  <span className="text-muted-foreground  truncate max-w-[80px]">{pattern.family}</span>
                  <span className={cn(visuals.textColor)}>
                    {visuals.label}
                  </span>
                </div>
                <div className="text-xs font-medium text-foreground line-clamp-1">
                  {pattern.name}
                </div>
              </div>

              <div className="relative z-10 mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground tabular-numbers">
                  <span>{pattern.solvedCount}/{pattern.totalProblems} solved</span>
                  {pattern.leechCount > 0 && (
                    <span className="text-destructive font-medium flex items-center gap-0.5">
                      <AlertTriangle className="h-2.5 w-2.5" /> {pattern.leechCount}
                    </span>
                  )}
                </div>

                {/* Mini retrievability progress bar */}
                <div className="w-full bg-muted border border-border h-1.5 overflow-hidden rounded-none">
                  <div
                    className={cn("h-full transition-all duration-300 rounded-none", visuals.bar)}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </SheetSection>

      {/* Detail Section: Selected Pattern Problem List */}
      {selectedPattern && (
        <SheetSection innerClassName="space-y-4 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-mono">
                <h2 className="text-base font-semibold text-foreground">
                  {selectedPattern.name}
                </h2>
                <span className="border border-border bg-muted/30 px-2 py-0.5 text-[11px] font-mono text-muted-foreground ">
                  {selectedPattern.family}
                </span>
                {selectedPattern.meanRetrievability != null && (
                  <span className="border border-border bg-background px-2 py-0.5 text-[11px] font-mono text-foreground font-semibold">
                    {(selectedPattern.meanRetrievability * 100).toFixed(0)}% Retrievability
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground">
                  Last drilled: {selectedPattern.lastDrilledAt ? new Date(selectedPattern.lastDrilledAt).toLocaleDateString() : "Never"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 italic max-w-2xl font-sans">
                "{selectedPattern.cue}"
              </p>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex items-center gap-2 font-mono text-xs">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter problems..."
                  value={problemSearch}
                  onChange={(e) => setProblemSearch(e.target.value)}
                  className="rounded-none border border-border bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-none border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="ALL">All status</option>
                <option value="SOLVED">Solved</option>
                <option value="UNSOLVED">Unsolved / Failed</option>
                <option value="LEECH">Leeches only</option>
              </select>
            </div>
          </div>

          {/* Problem Table */}
          <div className="border border-border rounded-none overflow-hidden bg-background font-mono text-xs">
            <table className="w-full text-left">
              <thead className="bg-muted/40 border-b border-border text-[11px] text-muted-foreground  font-mono">
                <tr>
                  <th className="py-2.5 px-4 font-medium">#</th>
                  <th className="py-2.5 px-4 font-medium">Problem</th>
                  <th className="py-2.5 px-4 font-medium">Difficulty</th>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                  <th className="py-2.5 px-4 text-center font-medium">Retrievability</th>
                  <th className="py-2.5 px-4 text-center font-medium">Lapses</th>
                  <th className="py-2.5 px-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredProblems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground font-sans text-xs">
                      No problems found matching filters for this pattern.
                    </td>
                  </tr>
                ) : (
                  filteredProblems.map((prob) => {
                    const diff = formatDifficulty(prob.difficulty);
                    const statusInfo = formatSolveStatus(prob.status);

                    return (
                      <tr key={prob.problemId} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-4 text-muted-foreground tabular-numbers">
                          {prob.number != null ? `#${prob.number}` : "-"}
                        </td>
                        <td className="py-2.5 px-4 font-sans">
                          <div className="flex items-center gap-2">
                            {safeHref(prob.url) ? (
                            <a
                              href={safeHref(prob.url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-foreground hover:underline transition-colors flex items-center gap-1 font-sans text-xs"
                            >
                              {prob.title}
                              <ExternalLink className="h-3 w-3 opacity-40 hover:opacity-100" />
                            </a>
                            ) : (
                              <span className="font-medium text-foreground font-sans text-xs">{prob.title}</span>
                            )}
                            {prob.revisit && (
                              <span className="rounded-none bg-muted border border-border px-1.5 py-0.2 text-[9px] font-mono text-foreground ">
                                Revisit
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className={cn("rounded-none border px-1.5 py-0.2 text-[10px]  font-mono", diff.className)}>
                            {diff.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          {prob.status ? (
                            <span className={cn("rounded-none px-2 py-0.5 text-[10px] border font-mono ", statusInfo.className)}>
                              {statusInfo.label}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[10px]  font-mono">Unattempted</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-center tabular-numbers">
                          {prob.retrievability != null ? (
                            <span
                              className={cn(
                                "font-semibold font-mono",
                                prob.retrievability >= 0.8
                                  ? "text-foreground"
                                  : prob.retrievability >= 0.6
                                  ? "text-foreground/80"
                                  : "text-muted-foreground"
                              )}
                            >
                              {(prob.retrievability * 100).toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-center tabular-numbers">
                          {prob.lapses != null && prob.lapses > 0 ? (
                            <span
                              className={cn(
                                "rounded-none px-1.5 py-0.2 text-[10px] font-mono",
                                prob.lapses >= 3
                                  ? "bg-destructive/10 border border-destructive/40 text-destructive font-semibold"
                                  : "text-muted-foreground"
                              )}
                            >
                              {prob.lapses >= 3 ? `Leech (${prob.lapses})` : prob.lapses}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          {prob.entryId ? (
                            <Link
                              href={`/problems/${prob.entryId}`}
                              className="rounded-none border border-border bg-background px-2.5 py-1 text-[11px] text-foreground hover:bg-muted transition-colors font-mono"
                            >
                              Detail
                            </Link>
                          ) : (
                            <button
                              onClick={() => {
                                window.dispatchEvent(
                                  new CustomEvent("open-command-bar-with-query", {
                                    detail: { query: prob.title },
                                  })
                                );
                              }}
                              className="rounded-none border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors font-mono"
                            >
                              + Log
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
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3 font-mono">
          <RefreshCw className="h-5 w-5 text-foreground animate-spin" />
          <span className="text-xs text-muted-foreground tracking-wider ">Computing pattern heatmap...</span>
        </div>
      }
    >
      <PatternsContent />
    </Suspense>
  );
}

