"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RefreshCw, Sparkles, AlertTriangle, CheckCircle, HelpCircle, ExternalLink, Search, Filter } from "lucide-react";
import { formatDifficulty, formatSolveStatus } from "@/lib/utils";
import { cn } from "@/lib/utils";

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
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3 font-mono">
        <RefreshCw className="h-6 w-6 text-emerald-500 animate-spin" />
        <span className="text-xs text-zinc-500 tracking-wider">COMPUTING_MASTERY_HEATMAP...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <div className="text-rose-400 font-mono text-sm">{error}</div>
        <button
          onClick={fetchPatterns}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-mono text-zinc-200 hover:bg-zinc-800"
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
        bg: "bg-background hover:bg-card border-border text-muted-foreground",
        bar: "bg-muted-foreground",
        label: "new",
        textColor: "text-muted-foreground",
      };
    }
    if (r >= 0.9) {
      return {
        bg: "bg-[#E9DCC6] hover:bg-[#E0C7A1] border-[#C3A57D] text-[#2A211A]",
        bar: "bg-[#7E553C]",
        label: `${(r * 100).toFixed(0)}%`,
        textColor: "text-[#2A211A]",
      };
    }
    if (r >= 0.8) {
      return {
        bg: "bg-[#E7D3B4] hover:bg-[#DEC299] border-[#C9A879] text-[#2A211A]",
        bar: "bg-[#9B6C45]",
        label: `${(r * 100).toFixed(0)}%`,
        textColor: "text-[#2A211A]",
      };
    }
    if (r >= 0.6) {
      return {
        bg: "bg-[#E0C7A1] hover:bg-[#D9B987] border-[#C59D6C] text-[#2A211A]",
        bar: "bg-[#B67C4C]",
        label: `${(r * 100).toFixed(0)}%`,
        textColor: "text-[#2A211A]",
      };
    }
    return {
      bg: "bg-[#E8D4C2] hover:bg-[#DDBDA6] border-[#C68F6B] text-[#2A211A]",
      bar: "bg-[#A55B42]",
      label: `${(r * 100).toFixed(0)}%`,
      textColor: "text-[#2A211A]",
    };
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-foreground" />
            <h1 className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
              Pattern mastery
            </h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            FSRS mean retrievability across the pattern taxonomy. Select a pattern to inspect weak spots.
          </p>
        </div>

        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#7E553C]" /> strong</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#B67C4C]" /> medium</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#A55B42]" /> weak</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted" /> new</span>
        </div>
      </div>

      {/* Hero: Pattern Mastery Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
        {patterns.map((pattern) => {
          const isSelected = selectedPattern?.id === pattern.id;
          const visuals = getMasteryVisuals(pattern.meanRetrievability);
          const percent = pattern.meanRetrievability != null ? Math.round(pattern.meanRetrievability * 100) : 0;

          return (
            <button
              key={pattern.id}
              onClick={() => setSelectedPatternId(pattern.id)}
              className={cn(
                "relative text-left p-3 rounded-lg border transition-all flex flex-col justify-between overflow-hidden",
                visuals.bg,
                isSelected ? "ring-2 ring-emerald-500 border-emerald-500 z-10" : ""
              )}
            >
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                  <span className="text-zinc-500 truncate max-w-[80px]">{pattern.family}</span>
                  <span className={cn("font-bold", visuals.textColor)}>
                    {visuals.label}
                  </span>
                </div>
                <div className="text-xs font-mono font-bold text-zinc-200 line-clamp-1">
                  {pattern.name}
                </div>
              </div>

              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                  <span>{pattern.solvedCount}/{pattern.totalProblems} solved</span>
                  {pattern.leechCount > 0 && (
                    <span className="text-rose-400 font-semibold flex items-center gap-0.5">
                      <AlertTriangle className="h-2.5 w-2.5" /> {pattern.leechCount}
                    </span>
                  )}
                </div>

                {/* Mini retrievability progress bar */}
                <div className="w-full bg-zinc-900 rounded-full h-1 overflow-hidden">
                  <div
                    className={cn("h-full transition-all duration-300", visuals.bar)}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail Section: Selected Pattern Problem List */}
      {selectedPattern && (
        <div className="space-y-4 pt-4 border-t border-zinc-800">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 font-mono">
                <h2 className="text-base font-bold text-zinc-100">
                  {selectedPattern.name}
                </h2>
                <span className="rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[11px] font-mono text-zinc-400">
                  {selectedPattern.family}
                </span>
                {selectedPattern.meanRetrievability != null && (
                  <span className="rounded bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 text-[11px] font-mono text-emerald-400 font-semibold">
                    {(selectedPattern.meanRetrievability * 100).toFixed(0)}% Retrievability
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-1.5 italic max-w-2xl font-sans">
                "{selectedPattern.cue}"
              </p>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex items-center gap-2 font-mono text-xs">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Filter problems..."
                  value={problemSearch}
                  onChange={(e) => setProblemSearch(e.target.value)}
                  className="rounded border border-zinc-800 bg-zinc-900 pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-300 focus:border-emerald-500 focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="SOLVED">Solved</option>
                <option value="UNSOLVED">Unsolved / Failed</option>
                <option value="LEECH">Leeches Only</option>
              </select>
            </div>
          </div>

          {/* Problem Table */}
          <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950 font-mono text-xs">
            <table className="w-full text-left">
              <thead className="bg-zinc-900/60 border-b border-zinc-800 text-[10px] text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">#</th>
                  <th className="py-2.5 px-4">Problem</th>
                  <th className="py-2.5 px-4">Difficulty</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-center">Retrievability</th>
                  <th className="py-2.5 px-4 text-center">Lapses</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredProblems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-zinc-500">
                      No problems found matching filters for this pattern.
                    </td>
                  </tr>
                ) : (
                  filteredProblems.map((prob) => {
                    const diff = formatDifficulty(prob.difficulty);
                    const statusInfo = formatSolveStatus(prob.status);

                    return (
                      <tr key={prob.problemId} className="hover:bg-zinc-900/40 transition-colors">
                        <td className="py-2.5 px-4 text-zinc-500">
                          {prob.number != null ? `#${prob.number}` : "-"}
                        </td>
                        <td className="py-2.5 px-4 font-sans">
                          <div className="flex items-center gap-2">
                            <a
                              href={prob.url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-zinc-200 hover:text-emerald-400 transition-colors flex items-center gap-1 font-mono text-xs"
                            >
                              {prob.title}
                              <ExternalLink className="h-3 w-3 opacity-40 hover:opacity-100" />
                            </a>
                            {prob.revisit && (
                              <span className="rounded bg-amber-950/60 border border-amber-800/40 px-1 py-0.2 text-[9px] font-mono text-amber-400">
                                Revisit
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className={cn("rounded border px-1.5 py-0.2 text-[10px]", diff.className)}>
                            {diff.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          {prob.status ? (
                            <span className={cn("rounded px-2 py-0.5 text-[10px] border", statusInfo.className)}>
                              {statusInfo.label}
                            </span>
                          ) : (
                            <span className="text-zinc-600 text-[10px]">Unattempted</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {prob.retrievability != null ? (
                            <span
                              className={cn(
                                "font-semibold",
                                prob.retrievability >= 0.8
                                  ? "text-emerald-400"
                                  : prob.retrievability >= 0.6
                                  ? "text-amber-400"
                                  : "text-rose-400"
                              )}
                            >
                              {(prob.retrievability * 100).toFixed(0)}%
                            </span>
                          ) : (
                            <span className="text-zinc-600">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {prob.lapses != null && prob.lapses > 0 ? (
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.2 text-[10px]",
                                prob.lapses >= 3
                                  ? "bg-rose-950 border border-rose-800 text-rose-400 font-bold"
                                  : "text-zinc-400"
                              )}
                            >
                              {prob.lapses >= 3 ? `Leech (${prob.lapses})` : prob.lapses}
                            </span>
                          ) : (
                            <span className="text-zinc-600">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          {prob.entryId ? (
                            <Link
                              href={`/problems/${prob.entryId}`}
                              className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
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
                              className="rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-[11px] text-zinc-400 hover:text-emerald-400 transition-colors"
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
        </div>
      )}
    </div>
  );
}

export default function PatternsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3 font-mono">
          <RefreshCw className="h-6 w-6 text-emerald-500 animate-spin" />
          <span className="text-xs text-zinc-500 tracking-wider">COMPUTING_MASTERY_HEATMAP...</span>
        </div>
      }
    >
      <PatternsContent />
    </Suspense>
  );
}

