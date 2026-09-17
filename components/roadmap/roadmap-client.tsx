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
import { cn, safeHref } from "@/lib/utils";
import { toggleRoadmapItemSolve } from "@/app/actions/entry-actions";
import { SheetSection } from "@/components/ui/sheet-section";

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

/**
 * Normalizes roadmap section names from raw CSV/DB names
 * e.g. "1. Pattern: Two Pointers" -> "Two Pointers"
 * e.g. "PATTERN: PREFIX SUM" -> "Prefix Sum"
 * e.g. "Pattern: Kadane pattern" -> "Kadane's Algorithm"
 * e.g. "HEAP PATTERN" -> "Heaps & Priority Queues"
 */
export function formatPatternName(raw: string): string {
  if (!raw) return "";
  let name = raw.trim();

  // Strip leading number prefix (e.g. "1. ", "10. ", "4: ")
  name = name.replace(/^\d+[\.\:\)]\s*/, "");

  // Strip leading "Pattern:" or "PATTERN:" with optional colon/dash
  name = name.replace(/^pattern\s*[:\-]?\s*/i, "");

  // Strip trailing "Pattern" or "PATTERN"
  name = name.replace(/\s+pattern$/i, "");

  // Specific canonical overrides for cleaner reading
  const lower = name.toLowerCase().trim();
  const overrides: Record<string, string> = {
    "two pointers": "Two Pointers",
    "fast & slow pointers": "Fast & Slow Pointers",
    "sliding window": "Sliding Window",
    "kadane": "Kadane's Algorithm",
    "kadane pattern": "Kadane's Algorithm",
    "prefix sum": "Prefix Sum",
    "merge intervals": "Merge Intervals",
    "in-place reversal of a linkedlist": "In-Place Reversal of a Linked List",
    "stack": "Stack",
    "reverse a string": "Monotonic Stack & String Reversal",
    "hash maps": "Hash Maps & Sets",
    "binary search": "Binary Search",
    "heap": "Heaps & Priority Queues",
    "recursion and backtracking": "Recursion & Backtracking",
    "tree": "Trees & Binary Search Trees",
    "graphs": "Graphs",
    "dp (dynamic programming)": "Dynamic Programming",
    "dynamic programming": "Dynamic Programming",
    "greedy": "Greedy Algorithms",
  };

  if (overrides[lower]) {
    return overrides[lower];
  }

  // If ALL CAPS, convert to Title Case
  if (name === name.toUpperCase() && name.length > 3) {
    name = name
      .toLowerCase()
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  return name;
}

/**
 * Extracts difficulty suffix from problem title if present
 * e.g. "Pair with Target Sum (easy)" -> title: "Pair with Target Sum", difficulty: "EASY"
 * e.g. "MInimum Size Substring (HARD)" -> title: "Minimum Size Substring", difficulty: "HARD"
 */
export function parseRoadmapItemTitle(rawTitle: string): {
  title: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD";
} {
  let title = rawTitle.trim();
  let difficulty: "EASY" | "MEDIUM" | "HARD" | undefined;

  const diffMatch = title.match(/\((easy|medium|hard|med)\)\s*$/i);
  if (diffMatch) {
    const d = diffMatch[1].toLowerCase();
    if (d === "easy") difficulty = "EASY";
    else if (d === "medium" || d === "med") difficulty = "MEDIUM";
    else if (d === "hard") difficulty = "HARD";
    title = title.replace(/\((easy|medium|hard|med)\)\s*$/i, "").trim();
  }

  // Clean up title capitalization if all caps (e.g. "FIND DUPLICATE NUMBER" -> "Find Duplicate Number")
  if (title === title.toUpperCase() && title.length > 3 && !title.startsWith("KOKO")) {
    title = title
      .toLowerCase()
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  return { title, difficulty };
}

export function RoadmapClient({ initialPatterns }: { initialPatterns: RoadmapPatternData[] }) {
  const [patterns, setPatterns] = useState<RoadmapPatternData[]>(initialPatterns);
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSolved, setFilterSolved] = useState<"ALL" | "UNSOLVED" | "SOLVED">("ALL");
  const [, startTransition] = useTransition();

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
      const displayName = formatPatternName(section.name);
      const filteredItems = section.items.filter((item) => {
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matchesTitle = item.title.toLowerCase().includes(query);
          const matchesPattern =
            section.name.toLowerCase().includes(query) ||
            displayName.toLowerCase().includes(query);
          if (!matchesTitle && !matchesPattern) return false;
        }

        // Status filter
        if (filterSolved === "SOLVED" && !item.isSolved) return false;
        if (filterSolved === "UNSOLVED" && item.isSolved) return false;

        return true;
      });

      return {
        ...section,
        displayName,
        items: filteredItems,
      };
    })
    .filter((section) => section.items.length > 0 || !searchQuery);

  return (
    <div className="pb-12 space-y-6">
      {/* Header & Overall Progress */}
      <SheetSection innerClassName="py-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5 text-foreground" />
              <span>Curriculum</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground mt-1">
              Roadmap
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Curated DSA patterns curriculum. Expand patterns, review questions, and check off completed problems.
            </p>
          </div>

          <div className="flex items-center gap-4 border border-border bg-background px-4 py-3 shrink-0">
            <div>
              <div className="text-[11px] font-medium text-muted-foreground">Overall progress</div>
              <div className="text-sm font-semibold text-foreground tabular-nums mt-0.5">
                {totalCompleted} <span className="text-muted-foreground font-normal">/ {totalItems}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold text-foreground tabular-nums">{completionPercentage}%</div>
              <div className="w-24 bg-muted h-1.5 overflow-hidden mt-1 border border-border">
                <div
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar: Search, Solved Filter, Expand/Collapse */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 font-sans text-xs">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search questions or patterns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-border bg-background pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring font-sans"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Filter Toggle */}
            <div className="flex items-center bg-background border border-border p-0.5">
              <button
                onClick={() => setFilterSolved("ALL")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium transition-colors tabular-nums",
                  filterSolved === "ALL"
                    ? "bg-foreground text-background font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All ({totalItems})
              </button>
              <button
                onClick={() => setFilterSolved("UNSOLVED")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium transition-colors tabular-nums",
                  filterSolved === "UNSOLVED"
                    ? "bg-foreground text-background font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Unsolved ({totalItems - totalCompleted})
              </button>
              <button
                onClick={() => setFilterSolved("SOLVED")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium transition-colors tabular-nums",
                  filterSolved === "SOLVED"
                    ? "bg-foreground text-background font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Solved ({totalCompleted})
              </button>
            </div>

            {/* Expand / Collapse All */}
            <button
              onClick={collapsedSectionIds.size === 0 ? collapseAll : expandAll}
              className="flex items-center gap-1.5 border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <ListCollapse className="h-3.5 w-3.5" />
              <span>{collapsedSectionIds.size === 0 ? "Collapse all" : "Expand all"}</span>
            </button>
          </div>
        </div>
      </SheetSection>

      {/* Pattern Sections */}
      <div className="space-y-4">
        {filteredPatterns.map((section) => {
          const isCollapsed = collapsedSectionIds.has(section.id);
          const sectionTotal = section.items.length;
          const sectionSolved = section.items.filter((i) => i.isSolved).length;
          const sectionPercentage =
            sectionTotal > 0 ? Math.round((sectionSolved / sectionTotal) * 100) : 0;
          const displayName = section.displayName || formatPatternName(section.name);

          return (
            <div
              key={section.id}
              className="border border-border bg-background overflow-hidden transition-all"
            >
              {/* Collapsible Section Header */}
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="w-full bg-muted/30 hover:bg-muted/60 border-b border-border px-4 py-3 flex items-center justify-between text-left transition-colors font-sans"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-muted-foreground shrink-0">
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                  <span className="flex h-5 w-5 items-center justify-center bg-background border border-border text-foreground text-[11px] font-medium tabular-nums shrink-0">
                    {section.order}
                  </span>
                  <h2 className="text-sm font-semibold text-foreground tracking-tight truncate">
                    {displayName}
                  </h2>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <div className="text-xs text-muted-foreground tabular-nums">
                    <span className="text-foreground font-semibold">{sectionSolved}</span> / {sectionTotal} solved
                  </div>
                  <div className="w-16 bg-muted h-1.5 overflow-hidden hidden sm:block border border-border">
                    <div
                      className="bg-foreground h-full transition-all duration-300"
                      style={{ width: `${sectionPercentage}%` }}
                    />
                  </div>
                </div>
              </button>

              {/* Questions List (Collapsible Body) */}
              {!isCollapsed && (
                <div className="divide-y divide-border">
                  {section.items.map((item, idx) => {
                    const parsed = parseRoadmapItemTitle(item.title);

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors text-xs font-sans",
                          item.isSolved && "bg-muted/20"
                        )}
                      >
                        {/* Left: Interactive Checkbox + Title + Metadata */}
                        <div className="flex items-center gap-3 min-w-0 pr-4">
                          <span className="text-muted-foreground text-[11px] tabular-nums w-5 text-right shrink-0">
                            {idx + 1}.
                          </span>

                          {/* Interactive Checkbox Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleSolve(section.id, item)}
                            className="text-muted-foreground hover:text-foreground shrink-0 focus:outline-none transition-colors"
                            aria-label={item.isSolved ? "Mark as unsolved" : "Mark as solved"}
                          >
                            {item.isSolved ? (
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground/60 hover:text-foreground" />
                            )}
                          </button>

                          <span
                            onClick={() => handleToggleSolve(section.id, item)}
                            className={cn(
                              "font-medium truncate cursor-pointer select-none",
                              item.isSolved
                                ? "text-muted-foreground line-through opacity-75"
                                : "text-foreground hover:text-primary transition-colors"
                            )}
                          >
                            {parsed.title}
                          </span>

                          {item.canonicalProblemNumber && (
                            <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">
                              #{item.canonicalProblemNumber}
                            </span>
                          )}

                          {parsed.difficulty && (
                            <span
                              className={cn(
                                "px-1.5 py-0.5 text-[10px] font-medium shrink-0 border",
                                parsed.difficulty === "EASY" && "border-easy/40 text-easy bg-easy/5",
                                parsed.difficulty === "MEDIUM" && "border-medium/40 text-medium bg-medium/5",
                                parsed.difficulty === "HARD" && "border-hard/40 text-hard bg-hard/5"
                              )}
                            >
                              {parsed.difficulty === "EASY" ? "Easy" : parsed.difficulty === "MEDIUM" ? "Med" : "Hard"}
                            </span>
                          )}

                          {item.isSolved && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium shrink-0 border border-border text-muted-foreground bg-muted/40">
                              {item.solveStatus === "SOLVED_UNAIDED" ? "Unaided" : "Solved"}
                            </span>
                          )}
                        </div>

                        {/* Right: Practice Links */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {safeHref(item.primaryUrl) && (
                            <a
                              href={safeHref(item.primaryUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors border border-border bg-background hover:bg-muted px-2.5 py-0.5"
                            >
                              <span>Link 1</span>
                              <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                            </a>
                          )}

                          {item.additionalUrls.map((url, uIdx) => {
                            const href = safeHref(url);
                            if (!href) return null;
                            return (
                              <a
                                key={url}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors border border-border bg-background hover:bg-muted px-2 py-0.5"
                              >
                                <span>Link {uIdx + 2}</span>
                                <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
