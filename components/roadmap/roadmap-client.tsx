"use client";
import React from 'react';

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

  // Specific canonical overrides for cleaner reading (sentence case)
  const lower = name.toLowerCase().trim();
  const overrides: Record<string, string> = {
    "two pointers": "Two pointers",
    "fast & slow pointers": "Fast & slow pointers",
    "sliding window": "Sliding window",
    "kadane": "Kadane's algorithm",
    "kadane pattern": "Kadane's algorithm",
    "prefix sum": "Prefix sum",
    "merge intervals": "Merge intervals",
    "in-place reversal of a linkedlist": "In-place reversal of a linked list",
    "stack": "Stack",
    "reverse a string": "Monotonic stack & string reversal",
    "hash maps": "Hash maps & sets",
    "binary search": "Binary search",
    "heap": "Heaps & priority queues",
    "recursion and backtracking": "Recursion & backtracking",
    "tree": "Trees & binary search trees",
    "graphs": "Graphs",
    "dp (dynamic programming)": "Dynamic programming",
    "dynamic programming": "Dynamic programming",
    "greedy": "Greedy algorithms",
  };

  if (overrides[lower]) {
    return overrides[lower];
  }

  // If ALL CAPS, convert to sentence case
  if (name === name.toUpperCase() && name.length > 3) {
    const lowered = name.toLowerCase();
    name = lowered.charAt(0).toUpperCase() + lowered.slice(1);
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

  // Clean up title capitalization if all caps (sentence case)
  if (title === title.toUpperCase() && title.length > 3 && !title.startsWith("KOKO")) {
    const lowered = title.toLowerCase();
    title = lowered.charAt(0).toUpperCase() + lowered.slice(1);
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
    <div>
      <SheetSection innerClassName="space-y-6 py-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-baseline">
          <div>
            <div className="flex items-center gap-2 type-label text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5 text-foreground" />
              <span>Curriculum</span>
            </div>
            <h1 className="mt-1 type-title text-foreground">Roadmap</h1>
            <p className="mt-1 type-caption">
              The full curriculum. Expand a pattern, solve its problems, track progress.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-4 bg-muted/30 px-4 py-3">
            <div>
              <div className="type-label">Overall progress</div>
              <div className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                {totalCompleted}{" "}
                <span className="font-normal text-muted-foreground">/ {totalItems}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold tabular-nums text-foreground">
                {completionPercentage}%
              </div>
              <div className="mt-1 h-1.5 w-24 overflow-hidden bg-muted">
                <div
                  className="h-full origin-left bg-orange-500 transition-transform duration-modal ease-in-out-strong"
                  style={{ transform: `scaleX(${completionPercentage / 100})` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-stretch justify-between gap-3 pt-2 text-xs sm:flex-row sm:items-center">
          <div className="relative w-full max-w-md flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search questions or patterns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-border bg-background py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="flex items-center border border-border bg-background p-0.5">
              <button
                type="button"
                onClick={() => setFilterSolved("ALL")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
                  filterSolved === "ALL"
                    ? "bg-orange-500 font-semibold text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                All ({totalItems})
              </button>
              <button
                type="button"
                onClick={() => setFilterSolved("UNSOLVED")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
                  filterSolved === "UNSOLVED"
                    ? "bg-orange-500 font-semibold text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Unsolved ({totalItems - totalCompleted})
              </button>
              <button
                type="button"
                onClick={() => setFilterSolved("SOLVED")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
                  filterSolved === "SOLVED"
                    ? "bg-orange-500 font-semibold text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Solved ({totalCompleted})
              </button>
            </div>

            <button
              type="button"
              onClick={collapsedSectionIds.size === 0 ? collapseAll : expandAll}
              className="flex items-center gap-1.5 border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ListCollapse className="h-3.5 w-3.5" />
              <span>{collapsedSectionIds.size === 0 ? "Collapse all" : "Expand all"}</span>
            </button>
          </div>
        </div>
      </SheetSection>

      <SheetSection innerClassName="py-6" last>
        <div className="divide-y divide-border border border-border bg-background">
          {filteredPatterns.map((section) => {
            const isCollapsed = collapsedSectionIds.has(section.id);
            const sectionTotal = section.items.length;
            const sectionSolved = section.items.filter((i) => i.isSolved).length;
            const sectionPercentage =
              sectionTotal > 0 ? Math.round((sectionSolved / sectionTotal) * 100) : 0;
            const displayName = section.displayName || formatPatternName(section.name);

            return (
              <div key={section.id}>
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="flex w-full items-center justify-between bg-muted/30 px-4 py-3 text-left transition-colors hover:bg-muted/60"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="shrink-0 text-muted-foreground">
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center bg-background text-[11px] font-medium tabular-nums text-foreground">
                      {section.order}
                    </span>
                    <h2 className="truncate type-heading text-foreground">{displayName}</h2>
                  </div>

                  <div className="ml-4 flex shrink-0 items-center gap-3">
                    <div className="text-xs tabular-nums text-muted-foreground">
                      <span className="font-semibold text-foreground">{sectionSolved}</span> /{" "}
                      {sectionTotal} solved
                    </div>
                    <div className="hidden h-1.5 w-16 overflow-hidden bg-muted sm:block">
                      <div
                        className="h-full origin-left bg-foreground transition-transform duration-modal ease-in-out-strong"
                        style={{ transform: `scaleX(${sectionPercentage / 100})` }}
                      />
                    </div>
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="divide-y divide-border border-t border-border">
                    {section.items.map((item, idx) => {
                      const parsed = parseRoadmapItemTitle(item.title);

                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "flex items-center justify-between px-4 py-2.5 text-xs transition-colors hover:bg-muted/40",
                            item.isSolved && "bg-muted/20"
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-3 pr-4">
                            <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                              {idx + 1}.
                            </span>

                            <button
                              type="button"
                              onClick={() => handleToggleSolve(section.id, item)}
                              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
                              aria-label={item.isSolved ? "Mark as unsolved" : "Mark as solved"}
                            >
                              {item.isSolved ? (
                                <CheckCircle2 className="h-4 w-4 text-orange-500" />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground/60 hover:text-foreground" />
                              )}
                            </button>

                            <span
                              onClick={() => handleToggleSolve(section.id, item)}
                              className={cn(
                                "cursor-pointer select-none truncate font-medium",
                                item.isSolved
                                  ? "text-muted-foreground line-through opacity-75"
                                  : "text-foreground hover:text-orange-600"
                              )}
                            >
                              {parsed.title}
                            </span>

                            {item.canonicalProblemNumber && (
                              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                                #{item.canonicalProblemNumber}
                              </span>
                            )}

                            {parsed.difficulty && (
                              <span
                                className={cn(
                                  "shrink-0 border px-1.5 py-0.5 text-[10px] font-medium",
                                  parsed.difficulty === "EASY" && "border-easy/35 text-easy",
                                  parsed.difficulty === "MEDIUM" && "border-medium/35 text-medium",
                                  parsed.difficulty === "HARD" && "border-hard/35 text-hard"
                                )}
                              >
                                {parsed.difficulty === "EASY"
                                  ? "Easy"
                                  : parsed.difficulty === "MEDIUM"
                                    ? "Med"
                                    : "Hard"}
                              </span>
                            )}

                            {item.isSolved && (
                              <span className="shrink-0 border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {item.solveStatus === "SOLVED_UNAIDED" ? "Unaided" : "Solved"}
                              </span>
                            )}
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5">
                            {safeHref(item.primaryUrl) && (
                              <a
                                href={safeHref(item.primaryUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-medium text-orange-600 transition-colors hover:text-orange-700"
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
                                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-orange-600 transition-colors hover:text-orange-700"
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
      </SheetSection>
    </div>
  );
}
