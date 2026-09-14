"use client";

import { useState, useTransition } from "react";
import {
  ExternalLink,
  CheckCircle2,
  Circle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Search,
  Check,
  ChevronsUpDown,
  ListCollapse,
  ListFilter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleRoadmapItemSolve } from "@/app/actions/entry-actions";

export interface RoadmapItemData {
  id: string;
  title: string;
  order: number;
  primaryUrl?: string | null;
  additionalUrls: string[];
  canonicalProblemId?: string | null;
  canonicalProblemNumber?: number | null;
  isSolved: boolean;
  entryId?: string | null;
  solveStatus?: string | null;
}

export interface RoadmapPatternData {
  id: string;
  name: string;
  order: number;
  items: RoadmapItemData[];
}

export function RoadmapClient({ initialPatterns }: { initialPatterns: RoadmapPatternData[] }) {
  const [patterns, setPatterns] = useState<RoadmapPatternData[]>(initialPatterns);
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSolved, setFilterSolved] = useState<"ALL" | "UNSOLVED" | "SOLVED">("ALL");
  const [isPending, startTransition] = useTransition();

  // Toggle Collapse on a single section
  const toggleSection = (id: string) => {
    setCollapsedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Expand All / Collapse All
  const expandAll = () => setCollapsedSectionIds(new Set());
  const collapseAll = () =>
    setCollapsedSectionIds(new Set(patterns.map((p) => p.id)));

  // Toggle Solve Checkbox with Optimistic UI Update
  const handleToggleSolve = (
    patternId: string,
    item: RoadmapItemData
  ) => {
    const newSolvedState = !item.isSolved;

    // Optimistic state update
    setPatterns((prev) =>
      prev.map((section) => {
        if (section.id !== patternId) return section;
        return {
          ...section,
          items: section.items.map((i) => {
            if (i.id !== item.id) return i;
            return {
              ...i,
              isSolved: newSolvedState,
              solveStatus: newSolvedState ? "SOLVED_UNAIDED" : null,
            };
          }),
        };
      })
    );

    // Server Action
    startTransition(async () => {
      try {
        const res = await toggleRoadmapItemSolve({
          canonicalProblemId: item.canonicalProblemId,
          itemTitle: item.title,
          itemPrimaryUrl: item.primaryUrl,
          currentlySolved: item.isSolved,
          entryId: item.entryId,
        });

        if (res.entryId) {
          // Update entryId in state if newly created
          setPatterns((prev) =>
            prev.map((section) => ({
              ...section,
              items: section.items.map((i) =>
                i.id === item.id ? { ...i, entryId: res.entryId } : i
              ),
            }))
          );
        }
      } catch (err) {
        console.error("Failed to toggle roadmap item solve status:", err);
        // Revert on error
        setPatterns((prev) =>
          prev.map((section) => {
            if (section.id !== patternId) return section;
            return {
              ...section,
              items: section.items.map((i) =>
                i.id === item.id ? { ...i, isSolved: item.isSolved, entryId: item.entryId } : i
              ),
            };
          })
        );
      }
    });
  };

  // Calculate Overall Progress
  const totalItems = patterns.reduce((acc, p) => acc + p.items.length, 0);
  const totalCompleted = patterns.reduce(
    (acc, p) => acc + p.items.filter((item) => item.isSolved).length,
    0
  );
  const completionPercentage = totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 0;

  // Filtered patterns for display
  const filteredPatterns = patterns
    .map((section) => {
      const filteredItems = section.items.filter((item) => {
        // Search filter
        if (
          searchQuery &&
          !item.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !section.name.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          return false;
        }

        // Status filter
        if (filterSolved === "SOLVED" && !item.isSolved) return false;
        if (filterSolved === "UNSOLVED" && item.isSolved) return false;

        return true;
      });

      return {
        ...section,
        items: filteredItems,
      };
    })
    .filter((section) => section.items.length > 0 || !searchQuery);

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in">
      {/* Header & Overall Progress */}
      <div className="border-b border-zinc-800 pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-mono">
              <BookOpen className="h-4 w-4 text-emerald-400" />
              <h1 className="text-lg font-bold text-zinc-100 uppercase tracking-tight">
                DSA_PATTERNS_STUDY_ROADMAP
              </h1>
            </div>
            <p className="text-xs text-zinc-400 mt-1 font-sans">
              Curated DSA Patterns curriculum. Click any question checkbox to select or deselect solve status directly. Expand and collapse pattern sections as you study.
            </p>
          </div>

          <div className="flex items-center gap-4 border border-zinc-800 bg-zinc-950 px-4 py-2.5 rounded-lg font-mono">
            <div>
              <div className="text-[10px] text-zinc-500 uppercase">Roadmap Progress</div>
              <div className="text-sm font-bold text-zinc-100">
                {totalCompleted} <span className="text-zinc-500 font-normal">/ {totalItems}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-emerald-400 font-bold uppercase">{completionPercentage}%</div>
              <div className="w-24 bg-zinc-800 h-2 rounded-full overflow-hidden mt-1">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar: Search, Solved Filter, Expand/Collapse */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 font-mono text-xs">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search roadmap questions or patterns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded border border-zinc-800 bg-zinc-900/80 pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Filter Toggle */}
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded p-0.5">
              <button
                onClick={() => setFilterSolved("ALL")}
                className={cn(
                  "px-2.5 py-1 rounded text-[11px] transition-colors",
                  filterSolved === "ALL"
                    ? "bg-zinc-800 text-zinc-100 font-bold"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                All ({totalItems})
              </button>
              <button
                onClick={() => setFilterSolved("UNSOLVED")}
                className={cn(
                  "px-2.5 py-1 rounded text-[11px] transition-colors",
                  filterSolved === "UNSOLVED"
                    ? "bg-zinc-800 text-zinc-100 font-bold"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                Unsolved ({totalItems - totalCompleted})
              </button>
              <button
                onClick={() => setFilterSolved("SOLVED")}
                className={cn(
                  "px-2.5 py-1 rounded text-[11px] transition-colors",
                  filterSolved === "SOLVED"
                    ? "bg-emerald-950 text-emerald-300 font-bold"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                Solved ({totalCompleted})
              </button>
            </div>

            {/* Expand / Collapse All */}
            <button
              onClick={collapsedSectionIds.size === 0 ? collapseAll : expandAll}
              className="flex items-center gap-1.5 rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
            >
              <ListCollapse className="h-3.5 w-3.5 text-zinc-400" />
              <span>{collapsedSectionIds.size === 0 ? "Collapse All" : "Expand All"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pattern Sections */}
      <div className="space-y-4">
        {filteredPatterns.map((section) => {
          const isCollapsed = collapsedSectionIds.has(section.id);
          const sectionTotal = section.items.length;
          const sectionSolved = section.items.filter((i) => i.isSolved).length;
          const sectionPercentage =
            sectionTotal > 0 ? Math.round((sectionSolved / sectionTotal) * 100) : 0;

          return (
            <div
              key={section.id}
              className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 overflow-hidden transition-all"
            >
              {/* Collapsible Section Header */}
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="w-full bg-zinc-900/80 hover:bg-zinc-900 border-b border-zinc-800/80 px-4 py-3 flex items-center justify-between font-mono text-left transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="text-zinc-500 hover:text-zinc-300">
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px]">
                    {section.order}
                  </span>
                  <h2 className="text-xs font-bold text-zinc-200 tracking-wide uppercase">
                    {section.name}
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-[11px] text-zinc-400">
                    <span className="text-emerald-400 font-semibold">{sectionSolved}</span> / {sectionTotal} solved
                  </div>
                  <div className="w-16 bg-zinc-800 h-1.5 rounded-full overflow-hidden hidden sm:block">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${sectionPercentage}%` }}
                    />
                  </div>
                </div>
              </button>

              {/* Questions List (Collapsible Body) */}
              {!isCollapsed && (
                <div className="divide-y divide-zinc-900">
                  {section.items.map((item, idx) => (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-center justify-between px-4 py-2.5 hover:bg-zinc-900/30 transition-colors text-xs font-mono",
                        item.isSolved && "bg-emerald-950/10"
                      )}
                    >
                      {/* Left: Interactive Checkbox + Title */}
                      <div className="flex items-center gap-3 min-w-0 pr-4">
                        <span className="text-zinc-600 text-[10px] w-5 text-right shrink-0">
                          {idx + 1}.
                        </span>

                        {/* Interactive Checkbox Button */}
                        <button
                          type="button"
                          onClick={() => handleToggleSolve(section.id, item)}
                          className="text-zinc-500 hover:text-emerald-400 shrink-0 focus:outline-hidden transition-colors"
                          title={item.isSolved ? "Click to mark as unsolved" : "Click to mark as solved"}
                        >
                          {item.isSolved ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <Circle className="h-4 w-4 text-zinc-700 hover:text-zinc-400" />
                          )}
                        </button>

                        <span
                          onClick={() => handleToggleSolve(section.id, item)}
                          className={cn(
                            "font-sans font-medium truncate cursor-pointer select-none",
                            item.isSolved
                              ? "text-zinc-300 line-through opacity-80"
                              : "text-zinc-200 hover:text-emerald-300"
                          )}
                        >
                          {item.title}
                        </span>

                        {item.canonicalProblemNumber && (
                          <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                            #{item.canonicalProblemNumber}
                          </span>
                        )}

                        {item.isSolved && (
                          <span className="rounded bg-emerald-950 border border-emerald-800/80 px-1.5 py-0.2 text-[9px] text-emerald-400 shrink-0 uppercase">
                            {item.solveStatus === "SOLVED_UNAIDED" ? "Unaided" : "Solved"}
                          </span>
                        )}
                      </div>

                      {/* Right: Practice Links */}
                      <div className="flex items-center gap-2 shrink-0">
                        {item.primaryUrl && (
                          <a
                            href={item.primaryUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-emerald-400 transition-colors border border-zinc-800 bg-zinc-900/80 hover:border-zinc-700 px-2 py-0.5 rounded"
                          >
                            <span>Link 1</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}

                        {item.additionalUrls.map((url, uIdx) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors border border-zinc-850 bg-zinc-900/40 hover:border-zinc-700 px-1.5 py-0.5 rounded"
                          >
                            <span>Link {uIdx + 2}</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
