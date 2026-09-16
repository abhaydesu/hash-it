"use client";

import { useState, useTransition } from "react";
import {
  ExternalLink,
  CheckCircle2,
  Circle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Search,
  ListCollapse,
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
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in pb-12">
      {/* Header & Overall Progress */}
      <div className="border-b border-border pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-mono">
              <BookOpen className="h-4 w-4 text-foreground" />
              <h1 className="text-lg font-bold text-foreground  tracking-tight">
                DSA_PATTERNS_STUDY_ROADMAP
              </h1>
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-sans">
              Curated DSA Patterns curriculum. Click any question checkbox to select or deselect solve status directly. Expand and collapse pattern sections as you study.
            </p>
          </div>

          <div className="flex items-center gap-4 border border-border bg-background px-4 py-2.5 rounded-none font-mono">
            <div>
              <div className="text-[10px] text-muted-foreground ">Roadmap Progress</div>
              <div className="text-sm font-bold text-foreground">
                {totalCompleted} <span className="text-muted-foreground font-normal">/ {totalItems}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-foreground font-bold ">{completionPercentage}%</div>
              <div className="w-24 bg-muted h-2 rounded-none overflow-hidden mt-1 border border-border">
                <div
                  className="bg-foreground h-full rounded-none transition-all duration-300"
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
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search roadmap questions or patterns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-none border border-border bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Filter Toggle */}
            <div className="flex items-center bg-background border border-border rounded-none p-0.5">
              <button
                onClick={() => setFilterSolved("ALL")}
                className={cn(
                  "px-2.5 py-1 rounded-none text-[11px] transition-colors",
                  filterSolved === "ALL"
                    ? "bg-foreground text-background font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All ({totalItems})
              </button>
              <button
                onClick={() => setFilterSolved("UNSOLVED")}
                className={cn(
                  "px-2.5 py-1 rounded-none text-[11px] transition-colors",
                  filterSolved === "UNSOLVED"
                    ? "bg-foreground text-background font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Unsolved ({totalItems - totalCompleted})
              </button>
              <button
                onClick={() => setFilterSolved("SOLVED")}
                className={cn(
                  "px-2.5 py-1 rounded-none text-[11px] transition-colors",
                  filterSolved === "SOLVED"
                    ? "bg-foreground text-background font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Solved ({totalCompleted})
              </button>
            </div>

            {/* Expand / Collapse All */}
            <button
              onClick={collapsedSectionIds.size === 0 ? collapseAll : expandAll}
              className="flex items-center gap-1.5 rounded-none border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <ListCollapse className="h-3.5 w-3.5 text-muted-foreground" />
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
              className="rounded-none border border-border bg-background overflow-hidden transition-all"
            >
              {/* Collapsible Section Header */}
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="w-full bg-muted/40 hover:bg-muted border-b border-border px-4 py-3 flex items-center justify-between font-mono text-left transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="text-muted-foreground hover:text-foreground">
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                  <span className="flex h-5 w-5 items-center justify-center rounded-none bg-background border border-border text-foreground text-[10px]">
                    {section.order}
                  </span>
                  <h2 className="text-xs font-bold text-foreground tracking-wide ">
                    {section.name}
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-[11px] text-muted-foreground">
                    <span className="text-foreground font-semibold">{sectionSolved}</span> / {sectionTotal} solved
                  </div>
                  <div className="w-16 bg-background border border-border h-2 rounded-none overflow-hidden hidden sm:block">
                    <div
                      className="bg-foreground h-full rounded-none transition-all duration-300"
                      style={{ width: `${sectionPercentage}%` }}
                    />
                  </div>
                </div>
              </button>

              {/* Questions List (Collapsible Body) */}
              {!isCollapsed && (
                <div className="divide-y divide-border">
                  {section.items.map((item, idx) => (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-center justify-between px-4 py-2.5 hover:bg-muted/50 transition-colors text-xs font-mono",
                        item.isSolved && "bg-muted/30"
                      )}
                    >
                      {/* Left: Interactive Checkbox + Title */}
                      <div className="flex items-center gap-3 min-w-0 pr-4">
                        <span className="text-muted-foreground text-[10px] w-5 text-right shrink-0">
                          {idx + 1}.
                        </span>

                        {/* Interactive Checkbox Button */}
                        <button
                          type="button"
                          onClick={() => handleToggleSolve(section.id, item)}
                          className="text-muted-foreground hover:text-foreground shrink-0 focus:outline-hidden transition-colors"
                          title={item.isSolved ? "Click to mark as unsolved" : "Click to mark as solved"}
                        >
                          {item.isSolved ? (
                            <CheckCircle2 className="h-4 w-4 text-foreground" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                          )}
                        </button>

                        <span
                          onClick={() => handleToggleSolve(section.id, item)}
                          className={cn(
                            "font-sans font-medium truncate cursor-pointer select-none",
                            item.isSolved
                              ? "text-muted-foreground line-through opacity-80"
                              : "text-foreground hover:text-muted-foreground"
                          )}
                        >
                          {item.title}
                        </span>

                        {item.canonicalProblemNumber && (
                          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                            #{item.canonicalProblemNumber}
                          </span>
                        )}

                        {item.isSolved && (
                          <span className="rounded-none bg-background border border-border px-1.5 py-0.2 text-[9px] text-foreground shrink-0 ">
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
                            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors border border-border bg-background hover:bg-muted px-2 py-0.5 rounded-none"
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
                            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors border border-border bg-muted/30 hover:bg-muted px-1.5 py-0.5 rounded-none"
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
