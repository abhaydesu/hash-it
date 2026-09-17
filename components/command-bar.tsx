"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { Search, ExternalLink, Check, AlertCircle, HelpCircle, X, Sparkles, Clock } from "lucide-react";
import { cn, formatDifficulty, safeHref } from "@/lib/utils";
import { createEntry, deleteEntry } from "@/app/actions/entry-actions";
import { useDebounce } from "@/hooks/use-debounce";

interface SearchResult {
  id: string;
  platform: string;
  number?: number | null;
  title: string;
  slug: string;
  url: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD" | null;
  acRate?: number | null;
  topicTags: string[];
  patterns: { id: string; name: string; family: string }[];
}

interface CommandBarProps {
  autoFocus?: boolean;
  inline?: boolean;
  onSuccess?: () => void;
}

export function CommandBar({ autoFocus = false, inline = false, onSuccess }: CommandBarProps) {
  const [isOpen, setIsOpen] = useState(inline);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedProblem, setSelectedProblem] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Form state
  const [status, setStatus] = useState<"SOLVED_UNAIDED" | "SOLVED_WITH_HELP" | "ATTEMPTED_FAILED">("SOLVED_UNAIDED");
  const [minutes, setMinutes] = useState<string>("");
  const [idea, setIdea] = useState("");
  const [mistake, setMistake] = useState("");
  const [revisit, setRevisit] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualDifficulty, setManualDifficulty] = useState<"EASY" | "MEDIUM" | "HARD">("MEDIUM");

  // Undo Toast state
  const [toast, setToast] = useState<{ id: string; title: string } | null>(null);

  const [isPending, startTransition] = useTransition();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const minutesInputRef = useRef<HTMLInputElement>(null);
  const ideaRef = useRef<HTMLTextAreaElement>(null);
  const mistakeRef = useRef<HTMLTextAreaElement>(null);

  // Listen to Cmd+K & global events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else if (e.key === "Escape" && isOpen && !inline) {
        setIsOpen(false);
      }
    };

    const handleCustomOpen = () => {
      setIsOpen(true);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-command-bar", handleCustomOpen);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-command-bar", handleCustomOpen);
    };
  }, [isOpen, inline]);

  useEffect(() => {
    if (autoFocus && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [autoFocus]);

  // Clear results immediately when query is emptied
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsSearching(false);
    }
  }, [query]);

  // Debounced 300ms search with cancellation against local Problem table
  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const abortController = new AbortController();
    setIsSearching(true);

    fetch("/api/search/problems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: trimmed }),
      signal: abortController.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Search request failed");
        return res.json();
      })
      .then((data) => {
        setResults(data.results || []);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Search error:", err);
        }
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setIsSearching(false);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [debouncedQuery]);

  const isDebouncing = query.trim().length > 0 && query !== debouncedQuery;
  const isLoading = isSearching || isDebouncing;

  // Form Keyboard Shortcuts (Keys 1, 2, 3 for status, Cmd+Enter to save)
  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
      return;
    }

    const targetTag = (e.target as HTMLElement).tagName;
    if (targetTag !== "TEXTAREA" && targetTag !== "INPUT") {
      if (e.key === "1") {
        e.preventDefault();
        setStatus("SOLVED_UNAIDED");
      } else if (e.key === "2") {
        e.preventDefault();
        setStatus("SOLVED_WITH_HELP");
      } else if (e.key === "3") {
        e.preventDefault();
        setStatus("ATTEMPTED_FAILED");
      }
    }
  };

  const selectProblem = (prob: SearchResult) => {
    setSelectedProblem(prob);
    setQuery("");
    setResults([]);
    setManualMode(false);
    setTimeout(() => minutesInputRef.current?.focus(), 50);
  };

  const resetForm = () => {
    setSelectedProblem(null);
    setManualMode(false);
    setQuery("");
    setResults([]);
    setStatus("SOLVED_UNAIDED");
    setMinutes("");
    setIdea("");
    setMistake("");
    setRevisit(false);
    if (!inline) setIsOpen(false);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const handleSubmit = () => {
    if (!selectedProblem && !manualMode) return;
    if (manualMode && !manualTitle && !manualUrl) return;

    const trimmedMinutes = minutes.trim();
    const parsedMinutes = trimmedMinutes === "" ? null : Number.parseInt(trimmedMinutes, 10);
    if (status !== "ATTEMPTED_FAILED" && parsedMinutes === null) {
      alert("Please enter the minutes spent before saving a solved problem.");
      setTimeout(() => minutesInputRef.current?.focus(), 50);
      return;
    }

    const probTitle = selectedProblem ? selectedProblem.title : manualTitle;

    startTransition(async () => {
      try {
        const res = await createEntry({
          problemId: selectedProblem ? selectedProblem.id : undefined,
          manualTitle: manualMode ? manualTitle : undefined,
          manualUrl: manualMode ? manualUrl : undefined,
          manualPlatform: manualUrl.includes("geeksforgeeks.org") ? "GFG" : "OTHER",
          manualDifficulty: manualDifficulty,
          status,
          minutes: parsedMinutes,
          idea: idea.trim() || null,
          mistake: mistake.trim() || null,
          revisit,
        });

        if (res.success && res.entryId) {
          setToast({ id: res.entryId, title: probTitle });
          resetForm();
          onSuccess?.();

          setTimeout(() => {
            setToast((prev) => (prev?.id === res.entryId ? null : prev));
          }, 6000);
        }
      } catch (err) {
        alert(`Failed to save: ${String(err)}`);
      }
    });
  };

  const handleUndo = async (entryId: string) => {
    try {
      await deleteEntry(entryId);
      setToast(null);
      onSuccess?.();
    } catch (err) {
      console.error("Undo failed:", err);
    }
  };

  if (!isOpen && !inline) return null;

  return (
    <>
      {/* Toast Notification with Undo */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 border border-border bg-background px-4 py-2.5 shadow-2xl animate-in slide-in-from-bottom-5">
          <div className="flex h-2 w-2 bg-easy" />
          <div className="text-xs text-foreground">
            Logged <span className="font-semibold">{toast.title}</span>
          </div>
          <button
            type="button"
            onClick={() => handleUndo(toast.id)}
            className="ml-2 border border-border bg-muted px-2 py-0.5 text-xs text-foreground hover:bg-muted/80 transition-colors"
          >
            Undo
          </button>
        </div>
      )}

      {/* Main Command Bar Container */}
      <div
        className={cn(
          "w-full border border-border bg-background shadow-2xl transition-all",
          !inline && "fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-2xl",
          inline && "relative"
        )}
        onKeyDown={handleFormKeyDown}
      >
        {/* Step 1: Search & Selection Input */}
        {!selectedProblem && !manualMode ? (
          <div className="p-3">
            <div className="relative flex items-center">
              <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type problem number (e.g. 15), title, or paste URL..."
                className="w-full border border-border bg-background py-2 pl-9 pr-24 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="absolute right-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {isLoading ? (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-1.5 w-1.5 animate-ping bg-primary rounded-full" />
                    Searching...
                  </span>
                ) : (
                  <kbd className="border border-border bg-muted/40 px-1 py-0.5 text-[10px]">Esc to exit</kbd>
                )}
              </div>
            </div>

            {/* Results Dropdown */}
            {results.length > 0 && (
              <div className="mt-2 max-h-64 overflow-y-auto border border-border bg-background divide-y divide-border text-xs">
                {results.map((prob) => {
                  const diff = formatDifficulty(prob.difficulty);
                  return (
                    <button
                      key={prob.id}
                      type="button"
                      onClick={() => selectProblem(prob)}
                      className="flex w-full items-center justify-between p-2.5 text-left hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        {prob.number != null && (
                          <span className="w-10 text-right text-muted-foreground tabular-numbers text-xs">
                            #{prob.number}
                          </span>
                        )}
                        <span className="truncate font-medium text-foreground group-hover:underline">
                          {prob.title}
                        </span>
                        {prob.patterns.length > 0 && (
                          <span className="border border-border bg-muted/40 px-1.5 py-0.2 text-[10px] text-muted-foreground">
                            {prob.patterns[0].name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {prob.acRate != null && (
                          <span className="text-[11px] text-muted-foreground tabular-numbers">
                            {prob.acRate.toFixed(1)}% ac
                          </span>
                        )}
                        <span className={cn("border px-1.5 py-0.2 text-[10px]", diff.className)}>
                          {diff.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Inline Manual Entry if No Results */}
            {query.trim().length > 0 && results.length === 0 && !isLoading && (
              <div className="mt-3 space-y-3 border border-border bg-muted/20 p-3.5 text-xs animate-in fade-in">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-xs font-semibold text-foreground">
                    {query.startsWith("http") ? "URL Problem Import" : "Manual Problem Entry"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">Not found in catalog</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">Problem Title</label>
                    <input
                      type="text"
                      placeholder="Title"
                      value={manualTitle || (query.startsWith("http") ? query.split("/").filter(Boolean).pop()?.replace(/[-_]+/g, " ") || "" : query)}
                      onChange={(e) => setManualTitle(e.target.value)}
                      className="w-full border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">Difficulty</label>
                    <select
                      value={manualDifficulty}
                      onChange={(e) => setManualDifficulty(e.target.value as any)}
                      className="w-full border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="EASY">Easy</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HARD">Hard</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">Problem URL (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. https://practice.geeksforgeeks.org/..."
                      value={manualUrl || (query.startsWith("http") ? query : "")}
                      onChange={(e) => setManualUrl(e.target.value)}
                      className="w-full border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>

                {/* Hot Fields */}
                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Status</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setStatus("SOLVED_UNAIDED")}
                        className={cn(
                          "flex items-center gap-1 px-2.5 py-1 text-xs transition-colors border",
                          status === "SOLVED_UNAIDED"
                            ? "border-easy/60 bg-easy/20 text-easy"
                            : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        )}
                      >
                        <Check className="h-3 w-3" />
                        <span>Unaided</span>
                        <kbd className="text-[10px] opacity-70">[1]</kbd>
                      </button>

                      <button
                        type="button"
                        onClick={() => setStatus("SOLVED_WITH_HELP")}
                        className={cn(
                          "flex items-center gap-1 px-2.5 py-1 text-xs transition-colors border",
                          status === "SOLVED_WITH_HELP"
                            ? "border-border bg-muted text-foreground font-medium"
                            : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        )}
                      >
                        <HelpCircle className="h-3 w-3" />
                        <span>With Help</span>
                        <kbd className="text-[10px] opacity-70">[2]</kbd>
                      </button>

                      <button
                        type="button"
                        onClick={() => setStatus("ATTEMPTED_FAILED")}
                        className={cn(
                          "flex items-center gap-1 px-2.5 py-1 text-xs transition-colors border",
                          status === "ATTEMPTED_FAILED"
                            ? "border-destructive/60 bg-destructive/20 text-destructive"
                            : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        )}
                      >
                        <AlertCircle className="h-3 w-3" />
                        <span>Failed</span>
                        <kbd className="text-[10px] opacity-70">[3]</kbd>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Minutes</span>
                      <input
                        type="number"
                        min="0"
                        max="600"
                        value={minutes}
                        onChange={(e) => setMinutes(e.target.value)}
                        placeholder="25"
                        className="w-20 border border-border bg-background px-2 py-1 text-xs tabular-numbers text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>

                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={revisit}
                        onChange={(e) => setRevisit(e.target.checked)}
                        className="border-border bg-background text-foreground focus:ring-ring"
                      />
                      <span>Flag for early revisit</span>
                    </label>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] font-medium text-muted-foreground">Idea / Core insight</div>
                    <textarea
                      value={idea}
                      onChange={(e) => setIdea(e.target.value)}
                      placeholder="Key observation, invariant, or technique..."
                      rows={2}
                      className="w-full border border-border bg-background p-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] font-medium text-muted-foreground">What I did wrong / Trap to avoid</div>
                    <textarea
                      value={mistake}
                      onChange={(e) => setMistake(e.target.value)}
                      placeholder="Mistake made, edge case missed..."
                      rows={2}
                      className="w-full border border-border bg-background p-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                    />
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <div className="text-[11px] text-muted-foreground">
                    <kbd className="border border-border bg-muted px-1 py-0.5 text-[10px]">⌘ + Enter</kbd> saves & resets
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        const effTitle = manualTitle || (query.startsWith("http") ? query.split("/").filter(Boolean).pop()?.replace(/[-_]+/g, " ") || "Untitled Problem" : query);
                        const effUrl = manualUrl || (query.startsWith("http") ? query : "");
                        setManualMode(true);
                        setManualTitle(effTitle);
                        setManualUrl(effUrl);
                        setTimeout(() => handleSubmit(), 10);
                      }}
                      className="border border-primary bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      {isPending ? <span>Saving...</span> : <span>Log Solve</span>}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Step 2: The Fast Add Form */
          <div className="p-4 space-y-3.5">
            {/* Prefilled Problem Summary Bar */}
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <div className="flex items-center gap-2.5 truncate">
                {selectedProblem?.number != null && (
                  <span className="text-xs text-muted-foreground tabular-numbers">
                    #{selectedProblem.number}
                  </span>
                )}
                <span className="font-semibold text-foreground truncate text-sm">
                  {selectedProblem ? selectedProblem.title : manualTitle || "Manual Problem"}
                </span>
                {selectedProblem && safeHref(selectedProblem.url) && (
                  <a
                    href={safeHref(selectedProblem.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {selectedProblem?.patterns.length ? (
                  <span className="flex items-center gap-1 border border-border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                    <Sparkles className="h-2.5 w-2.5 text-muted-foreground" />
                    {selectedProblem.patterns.map((p) => p.name).join(", ")}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Manual Edit Inputs */}
            {manualMode && (
              <div className="grid grid-cols-3 gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Problem Title"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  className="col-span-2 border border-border bg-background px-2.5 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <select
                  value={manualDifficulty}
                  onChange={(e) => setManualDifficulty(e.target.value as any)}
                  className="border border-border bg-background px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
                <input
                  type="text"
                  placeholder="URL (e.g. GeeksforGeeks)"
                  value={manualUrl}
                  onChange={(e) => setManualUrl(e.target.value)}
                  className="col-span-3 border border-border bg-background px-2.5 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            )}

            {/* The 4 Hot Fields */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Status</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStatus("SOLVED_UNAIDED")}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors border",
                      status === "SOLVED_UNAIDED"
                        ? "border-easy/60 bg-easy/20 text-easy"
                        : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                  >
                    <Check className="h-3 w-3" />
                    <span>Unaided</span>
                    <kbd className="text-[10px] opacity-70">[1]</kbd>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus("SOLVED_WITH_HELP")}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors border",
                      status === "SOLVED_WITH_HELP"
                        ? "border-border bg-muted text-foreground font-medium"
                        : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                  >
                    <HelpCircle className="h-3 w-3" />
                    <span>With Help</span>
                    <kbd className="text-[10px] opacity-70">[2]</kbd>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus("ATTEMPTED_FAILED")}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors border",
                      status === "ATTEMPTED_FAILED"
                        ? "border-destructive/60 bg-destructive/20 text-destructive"
                        : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                  >
                    <AlertCircle className="h-3 w-3" />
                    <span>Failed</span>
                    <kbd className="text-[10px] opacity-70">[3]</kbd>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Minutes</span>
                  <input
                    ref={minutesInputRef}
                    type="number"
                    min="0"
                    max="600"
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                    placeholder="25"
                    className="w-20 border border-border bg-background px-2 py-1 text-xs tabular-numbers text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={revisit}
                    onChange={(e) => setRevisit(e.target.checked)}
                    className="border-border bg-background text-foreground focus:ring-ring"
                  />
                  <span>Flag for early revisit</span>
                </label>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                  <span>Idea / Core insight</span>
                  <span className="text-muted-foreground/60 text-[10px]">Tab to mistake</span>
                </div>
                <textarea
                  ref={ideaRef}
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="Sort by start interval, maintain min-heap of active end times..."
                  rows={2}
                  className="w-full border border-border bg-background p-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                  <span>What I did wrong / Trap to avoid</span>
                  <span className="text-muted-foreground/60 text-[10px]">Highest-value artifact</span>
                </div>
                <textarea
                  ref={mistakeRef}
                  value={mistake}
                  onChange={(e) => setMistake(e.target.value)}
                  placeholder="Didn't handle negative numbers; missed off-by-one in binary search right boundary..."
                  rows={2}
                  className="w-full border border-border bg-background p-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                />
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between border-t border-border pt-3">
              <div className="text-[11px] text-muted-foreground">
                <kbd className="border border-border bg-muted px-1 py-0.5 text-[10px]">⌘ + Enter</kbd> saves & resets
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleSubmit}
                  className="border border-primary bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50"
                >
                  {isPending ? <span>Saving...</span> : <span>Log Solve</span>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
