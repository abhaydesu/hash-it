"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { Search, Plus, ExternalLink, Check, AlertCircle, HelpCircle, X, Sparkles, Clock } from "lucide-react";
import { cn, formatDifficulty } from "@/lib/utils";
import { createEntry, deleteEntry } from "@/app/actions/entry-actions";

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

  // Debounced 150ms search against local Problem table
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch("/api/search/problems", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: query.trim() }),
        });
        const data = await res.json();
        setResults(data.results || []);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  // Form Keyboard Shortcuts (Keys 1, 2, 3 for status, Cmd+Enter to save)
  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
      return;
    }

    // Only trigger 1/2/3 when not typing in textareas or inputs
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

  const startManualMode = () => {
    setManualMode(true);
    setManualTitle(query.startsWith("http") ? "" : query);
    setManualUrl(query.startsWith("http") ? query : "");
    setSelectedProblem(null);
    setResults([]);
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
          minutes: minutes ? parseInt(minutes, 10) : null,
          idea: idea.trim() || null,
          mistake: mistake.trim() || null,
          revisit,
        });

        if (res.success && res.entryId) {
          setToast({ id: res.entryId, title: probTitle });
          resetForm();
          onSuccess?.();

          // Clear toast after 6s
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
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-lg border border-emerald-500/40 bg-zinc-950 px-4 py-2.5 shadow-2xl animate-in slide-in-from-bottom-5">
          <div className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <div className="text-xs text-zinc-200">
            Logged <span className="font-semibold text-emerald-300">"{toast.title}"</span>
          </div>
          <button
            onClick={() => handleUndo(toast.id)}
            className="ml-2 rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
          >
            Undo
          </button>
        </div>
      )}

      {/* Main Command Bar Container */}
      <div
        className={cn(
          "w-full rounded-lg border border-zinc-800 bg-zinc-950/95 shadow-xl transition-all",
          !inline && "fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-2xl backdrop-blur-md",
          inline && "relative"
        )}
        onKeyDown={handleFormKeyDown}
      >
        {/* Step 1: Search & Selection Input */}
        {!selectedProblem && !manualMode ? (
          <div className="p-3">
            <div className="relative flex items-center">
              <Search className="absolute left-3 h-4 w-4 text-zinc-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type problem number (e.g. 15), title, or paste URL..."
                className="w-full rounded-md border border-zinc-800 bg-zinc-900/90 py-2 pl-9 pr-20 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:border-emerald-500/80 focus:outline-hidden focus:ring-1 focus:ring-emerald-500/50"
              />
              <div className="absolute right-3 flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
                {isSearching ? (
                  <span>searching...</span>
                ) : (
                  <kbd className="rounded border border-zinc-800 bg-zinc-950 px-1 py-0.5">Esc to exit</kbd>
                )}
              </div>
            </div>

            {/* Results Dropdown */}
            {results.length > 0 && (
              <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-900/95 divide-y divide-zinc-800/60 font-mono text-xs">
                {results.map((prob) => {
                  const diff = formatDifficulty(prob.difficulty);
                  return (
                    <button
                      key={prob.id}
                      type="button"
                      onClick={() => selectProblem(prob)}
                      className="flex w-full items-center justify-between p-2.5 text-left hover:bg-zinc-800/80 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        {prob.number != null && (
                          <span className="w-10 text-right text-zinc-400 text-xs">#{prob.number}</span>
                        )}
                        <span className="truncate font-sans font-medium text-zinc-200 group-hover:text-emerald-300">
                          {prob.title}
                        </span>
                        {prob.patterns.length > 0 && (
                          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                            {prob.patterns[0].name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {prob.acRate != null && (
                          <span className="text-[11px] text-zinc-500">{prob.acRate.toFixed(1)}% ac</span>
                        )}
                        <span className={cn("rounded border px-1.5 py-0.2 text-[10px]", diff.className)}>
                          {diff.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* If no results, offer manual entry */}
            {query.trim().length > 0 && results.length === 0 && !isSearching && (
              <div className="mt-2 flex items-center justify-between rounded-md border border-dashed border-zinc-800 bg-zinc-900/50 p-2.5 text-xs">
                <span className="text-zinc-400">Problem not in local dataset.</span>
                <button
                  type="button"
                  onClick={startManualMode}
                  className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add manually</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Step 2: The Fast Add Form (<15 sec) */
          <div className="p-4 space-y-3.5">
            {/* Prefilled Problem Summary Bar */}
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
              <div className="flex items-center gap-2.5 truncate">
                {selectedProblem?.number != null && (
                  <span className="font-mono text-xs text-zinc-400">#{selectedProblem.number}</span>
                )}
                <span className="font-medium text-zinc-100 truncate text-sm">
                  {selectedProblem ? selectedProblem.title : manualTitle || "Manual Problem"}
                </span>
                {selectedProblem?.url && (
                  <a
                    href={selectedProblem.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-zinc-500 hover:text-zinc-300"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {selectedProblem?.patterns.length ? (
                  <span className="flex items-center gap-1 rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400 font-mono">
                    <Sparkles className="h-2.5 w-2.5 text-emerald-400" />
                    {selectedProblem.patterns.map((p) => p.name).join(", ")}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Manual Edit Inputs if manualMode */}
            {manualMode && (
              <div className="grid grid-cols-3 gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Problem Title"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  className="col-span-2 rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-200 focus:border-zinc-600 focus:outline-hidden"
                />
                <select
                  value={manualDifficulty}
                  onChange={(e) => setManualDifficulty(e.target.value as any)}
                  className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-zinc-200 focus:border-zinc-600 focus:outline-hidden"
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
                  className="col-span-3 rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-200 focus:border-zinc-600 focus:outline-hidden"
                />
              </div>
            )}

            {/* The 4 Hot Fields: Status, Minutes, Idea, Mistake */}
            <div className="space-y-3">
              {/* Field 1: Solve Status (Keys 1 / 2 / 3) */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-zinc-400">Status</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStatus("SOLVED_UNAIDED")}
                    className={cn(
                      "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors border",
                      status === "SOLVED_UNAIDED"
                        ? "border-emerald-700 bg-emerald-950/80 text-emerald-300"
                        : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                    )}
                  >
                    <Check className="h-3 w-3" />
                    <span>Unaided</span>
                    <kbd className="text-[10px] opacity-70 font-mono">[1]</kbd>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus("SOLVED_WITH_HELP")}
                    className={cn(
                      "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors border",
                      status === "SOLVED_WITH_HELP"
                        ? "border-sky-700 bg-sky-950/80 text-sky-300"
                        : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                    )}
                  >
                    <HelpCircle className="h-3 w-3" />
                    <span>With Help</span>
                    <kbd className="text-[10px] opacity-70 font-mono">[2]</kbd>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus("ATTEMPTED_FAILED")}
                    className={cn(
                      "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors border",
                      status === "ATTEMPTED_FAILED"
                        ? "border-rose-700 bg-rose-950/80 text-rose-300"
                        : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                    )}
                  >
                    <AlertCircle className="h-3 w-3" />
                    <span>Failed</span>
                    <kbd className="text-[10px] opacity-70 font-mono">[3]</kbd>
                  </button>
                </div>
              </div>

              {/* Field 2: Minutes & Revisit flag */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-zinc-500" />
                  <span className="text-xs font-mono text-zinc-400">Minutes</span>
                  <input
                    ref={minutesInputRef}
                    type="number"
                    min="0"
                    max="600"
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                    placeholder="e.g. 25"
                    className="w-20 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs font-mono text-zinc-100 focus:border-zinc-600 focus:outline-hidden"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={revisit}
                    onChange={(e) => setRevisit(e.target.checked)}
                    className="rounded border-zinc-800 bg-zinc-900 text-emerald-500 focus:ring-0"
                  />
                  <span>Flag for early revisit</span>
                </label>
              </div>

              {/* Field 3: Idea ("How I cracked it" - Markdown textarea) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                  <span>Idea / Core insight (markdown)</span>
                  <span className="text-zinc-600 text-[10px]">Tab to mistake</span>
                </div>
                <textarea
                  ref={ideaRef}
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="e.g. Sort by start interval, maintain min-heap of active end times..."
                  rows={2}
                  className="w-full rounded border border-zinc-800 bg-zinc-900/90 p-2 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:border-emerald-500/80 focus:outline-hidden resize-y"
                />
              </div>

              {/* Field 4: Mistake ("What I did wrong" - Markdown textarea) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                  <span>What I did wrong / Trap to avoid</span>
                  <span className="text-zinc-600 text-[10px]">Highest-value artifact</span>
                </div>
                <textarea
                  ref={mistakeRef}
                  value={mistake}
                  onChange={(e) => setMistake(e.target.value)}
                  placeholder="e.g. Didn't handle negative numbers; missed off-by-one in binary search right boundary..."
                  rows={2}
                  className="w-full rounded border border-zinc-800 bg-zinc-900/90 p-2 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:border-emerald-500/80 focus:outline-hidden resize-y"
                />
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between border-t border-zinc-800/80 pt-3">
              <div className="text-[11px] font-mono text-zinc-500">
                <kbd className="rounded border border-zinc-800 bg-zinc-900 px-1 py-0.5">⌘ + Enter</kbd> saves & resets
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleSubmit}
                  className="flex items-center gap-1.5 rounded bg-emerald-600 hover:bg-emerald-500 px-3 py-1 text-xs font-medium text-white transition-colors disabled:opacity-50"
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
