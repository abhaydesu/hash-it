"use client";
import React from "react";

import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, ExternalLink, Check, AlertCircle, HelpCircle, X, Plus, CornerDownLeft, History } from "lucide-react";
import { cn, formatDifficulty, safeHref, normalizePatternList } from "@/lib/utils";
import { isMarketingPath } from "@/lib/site";
import { titleFromProblemUrl } from "@/lib/problem-url";
import { createEntry, deleteEntry, getLoggedInfo } from "@/app/actions/entry-actions";
import { useDebounce } from "@/hooks/use-debounce";
import { useAlertDialog } from "@/components/ui/alert-dialog";
import { useIsMac } from "@/lib/use-is-mac";
import { getLogFormConfig } from "@/app/actions/settings-actions";
import { type CustomDraft } from "@/components/custom-field-inputs";
import { LogExtraFields } from "@/components/log-extra-fields";
import { TagCombobox } from "@/components/ui/tag-combobox";
import { suggestPatterns, canonicalPattern } from "@/lib/pattern-match";
import { filterNonOverlappingFields, type CustomFieldDef } from "@/lib/custom-fields";
import { formatAgo, formatDue, type LoggedInfo } from "@/lib/logged-format";
import { firstIntervalForStatus, type FirstIntervals, type LoggedStatus } from "@/lib/first-intervals";

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
  /** The user's existing entry for this problem, if they have logged it before. */
  logged?: LoggedInfo | null;
}

type Difficulty = "EASY" | "MEDIUM" | "HARD";

/** One shape for every text control in the form, so sizes and focus never drift apart. */
const controlClass =
  "h-9 w-full border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
const textareaClass =
  "w-full resize-none overflow-hidden border border-border bg-background px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
const labelClass = "block text-xs font-medium text-foreground";
const ghostButtonClass =
  "pressable h-9 border border-border bg-background px-3 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground";

const OUTCOMES: Array<{
  value: LoggedStatus;
  label: string;
  key: string;
  icon: typeof Check;
  fill: string;
}> = [
  { value: "SOLVED_UNAIDED", label: "Solved cold", key: "1", icon: Check, fill: "outcome-fill-good" },
  { value: "SOLVED_WITH_HELP", label: "Used hint", key: "2", icon: HelpCircle, fill: "outcome-fill-hint" },
  { value: "ATTEMPTED_FAILED", label: "Saw solution", key: "3", icon: AlertCircle, fill: "outcome-fill-failed" },
];

/** Pattern picker: suggests what the user and catalog already have so typing snaps instead of forking near-duplicates. */
function PatternField({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [known, setKnown] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/patterns")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && Array.isArray(d?.patterns)) setKnown(d.patterns);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <TagCombobox
      id="log-pattern"
      label="Pattern"
      noun="pattern"
      optional
      tags={tags}
      onTagsChange={onChange}
      getSuggestions={(draft, current) => suggestPatterns(draft, known, current)}
      normalize={(raw) => normalizePatternList([raw]).map((part) => canonicalPattern(part, known))}
      placeholder="Sliding Window, Strings…"
    />
  );
}

interface CommandBarProps {
  autoFocus?: boolean;
  inline?: boolean;
  onSuccess?: () => void;
}

export function CommandBar({ autoFocus = false, inline = false, onSuccess }: CommandBarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(inline);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 200);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedProblem, setSelectedProblem] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Form state
  const [status, setStatus] = useState<LoggedStatus>("SOLVED_UNAIDED");
  const [minutes, setMinutes] = useState<string>("");
  const [minutesError, setMinutesError] = useState(false);
  const [idea, setIdea] = useState("");
  const [mistake, setMistake] = useState("");
  const [revisit, setRevisit] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [manualDifficulty, setManualDifficulty] = useState<Difficulty>("MEDIUM");
  const [patternTags, setPatternTags] = useState<string[]>([]);
  /** Set when a pasted link was recognised on another platform and its details were fetched. */
  const [fetchedFrom, setFetchedFrom] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);
  const [customDraft, setCustomDraft] = useState<CustomDraft>({});
  const [sources, setSources] = useState<string[]>([]);
  const [source, setSource] = useState("");
  const [firstIntervals, setFirstIntervals] = useState<FirstIntervals | null>(null);

  // Undo Toast state
  const [toast, setToast] = useState<{ id: string; title: string } | null>(null);

  const isMac = useIsMac();
  const [isPending, startTransition] = useTransition();
  const { showAlert, alertDialog } = useAlertDialog();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const minutesInputRef = useRef<HTMLInputElement>(null);
  const ideaRef = useRef<HTMLTextAreaElement>(null);
  const mistakeRef = useRef<HTMLTextAreaElement>(null);
  const manualModeRef = useRef(false);
  manualModeRef.current = manualMode;

  // The user's own columns, sources and review waits, refreshed each time the bar opens (they change in Settings/Import).
  useEffect(() => {
    if (!isOpen && !inline) return;
    let cancelled = false;
    getLogFormConfig()
      .then((cfg) => {
        if (cancelled) return;
        setCustomFields(filterNonOverlappingFields(cfg.customFields));
        setSources(cfg.sources);
        setFirstIntervals(cfg.firstIntervals ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen, inline]);

  useEffect(() => {
    if (!isOpen || inline) return;
    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;
    };
  }, [isOpen, inline]);

  useEffect(() => {
    const resize = (textarea: HTMLTextAreaElement | null) => {
      if (!textarea) return;
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    };
    resize(ideaRef.current);
    resize(mistakeRef.current);
  }, [idea, mistake, isOpen, manualMode, selectedProblem]);

  // Listen to Cmd+K & global events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        if (pathname && (isMarketingPath(pathname) || pathname.startsWith("/auth/"))) {
          return;
        }
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else if (e.key === "Escape" && isOpen && !inline) {
        setIsOpen(false);
      }
    };

    const handleCustomOpen = (e: Event) => {
      setIsOpen(true);
      const customEvent = e as CustomEvent<{ problem?: SearchResult }>;
      if (customEvent.detail?.problem) {
        const p = customEvent.detail.problem;
        setQuery("");
        setResults([]);
        setManualMode(false);
        setMinutes("");
        setStatus("SOLVED_UNAIDED");
        setIdea("");
        setMistake("");
        setRevisit(false);
        setPatternTags([]);
        setSelectedProblem({
          id: p.id,
          platform: p.platform ?? "LEETCODE",
          number: p.number ?? null,
          title: p.title,
          slug: p.slug ?? "",
          url: p.url ?? "",
          difficulty: p.difficulty ?? null,
          topicTags: p.topicTags ?? [],
          patterns: p.patterns ?? [],
          logged: p.logged,
        });
        if (p.logged === undefined) {
          getLoggedInfo(p.id)
            .then((logged) => setSelectedProblem((prev) => (prev?.id === p.id ? { ...prev, logged } : prev)))
            .catch(() => {});
        }
        setTimeout(() => minutesInputRef.current?.focus(), 50);
      } else {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-command-bar", handleCustomOpen as EventListener);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-command-bar", handleCustomOpen as EventListener);
    };
  }, [isOpen, inline, pathname]);

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

  // Debounced search against the catalog; a pasted URL also returns metadata to prefill a custom problem.
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
        setActiveIndex(0);
        const enrichment = data.enrichment as
          | { title?: string; url?: string; difficulty?: Difficulty | null; topicTags?: string[]; source?: string }
          | undefined;

        // A late response must not overwrite a custom problem the user is already editing.
        if (enrichment && !manualModeRef.current) {
          if (enrichment.title) setManualTitle(enrichment.title);
          if (enrichment.url) setManualUrl(enrichment.url);
          if (enrichment.difficulty) setManualDifficulty(enrichment.difficulty);
          setPatternTags(Array.isArray(enrichment.topicTags) ? normalizePatternList(enrichment.topicTags) : []);
          setFetchedFrom(enrichment.source === "gfg" ? "GeeksforGeeks" : null);
        } else if (!enrichment && !manualModeRef.current) {
          // Nothing recognised: drop details left over from an earlier link.
          setManualTitle("");
          setManualUrl("");
          setManualDifficulty("MEDIUM");
          setPatternTags([]);
          setFetchedFrom(null);
        }
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

  const trimmedQuery = query.trim();
  const isLoading = isSearching || (trimmedQuery.length > 0 && query !== debouncedQuery);
  const isUrlQuery = trimmedQuery.startsWith("http");
  const inferredUrlTitle = isUrlQuery ? titleFromProblemUrl(trimmedQuery) || "" : trimmedQuery;

  // The last row is always "log it as a custom problem", so an unlisted problem is one keystroke away.
  const customRowIndex = results.length;
  const rowCount = trimmedQuery ? results.length + 1 : 0;
  const showList = rowCount > 0 && !isLoading;

  useEffect(() => {
    document.getElementById(`problem-option-${activeIndex}`)?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, showList]);

  // Form Keyboard Shortcuts (Keys 1, 2, 3 for status, Cmd+Enter to save)
  const handleFormKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
      return;
    }

    const targetTag = (e.target as HTMLElement).tagName;
    if (targetTag !== "TEXTAREA" && targetTag !== "INPUT") {
      const outcome = OUTCOMES.find((o) => o.key === e.key);
      if (outcome) {
        e.preventDefault();
        setStatus(outcome.value);
      }
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (rowCount === 0) return;
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((i) => (i + step + rowCount) % rowCount);
    } else if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
      if (!showList) return;
      e.preventDefault();
      if (activeIndex < results.length) selectProblem(results[activeIndex]);
      else startCustomProblem();
    }
  };

  const selectProblem = (prob: SearchResult) => {
    setSelectedProblem(prob);
    setQuery("");
    setResults([]);
    setManualMode(false);
    // Topic tags already appear under the title; leave pattern blank for the solve pattern.
    setPatternTags([]);
    setTimeout(() => minutesInputRef.current?.focus(), 50);
  };

  const startCustomProblem = () => {
    setManualMode(true);
    setManualTitle((prev) => prev || inferredUrlTitle);
    setManualUrl((prev) => prev || (isUrlQuery ? trimmedQuery : ""));
    setQuery("");
    setResults([]);
    setTimeout(() => minutesInputRef.current?.focus(), 50);
  };

  const resetForm = () => {
    setSelectedProblem(null);
    setManualMode(false);
    setQuery("");
    setResults([]);
    setStatus("SOLVED_UNAIDED");
    setMinutes("");
    setMinutesError(false);
    setIdea("");
    setMistake("");
    setRevisit(false);
    setManualTitle("");
    setManualUrl("");
    setManualDifficulty("MEDIUM");
    setPatternTags([]);
    setFetchedFrom(null);
    setCustomDraft({});
    setSource("");
    if (!inline) setIsOpen(false);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const canSubmit = selectedProblem != null || (manualMode && Boolean(manualTitle.trim() || manualUrl.trim()));

  const handleSubmit = () => {
    if (!canSubmit || isPending) return;

    const trimmedMinutes = minutes.trim();
    const parsedMinutes = trimmedMinutes === "" ? null : Number.parseInt(trimmedMinutes, 10);
    if (status !== "ATTEMPTED_FAILED" && parsedMinutes === null) {
      setMinutesError(true);
      minutesInputRef.current?.focus();
      return;
    }

    const isCustom = manualMode && !selectedProblem;
    const title = isCustom ? manualTitle.trim() || "Untitled problem" : selectedProblem!.title;
    const tags = normalizePatternList(patternTags);

    startTransition(async () => {
      try {
        const res = await createEntry({
          problemId: isCustom ? undefined : selectedProblem!.id,
          manualTitle: isCustom ? title : undefined,
          manualUrl: isCustom ? manualUrl.trim() : undefined,
          manualPlatform: manualUrl.includes("geeksforgeeks.org") ? "GFG" : "OTHER",
          manualDifficulty,
          manualTopicTags: isCustom ? tags : [],
          patternOverride: tags,
          status,
          minutes: parsedMinutes,
          idea: idea.trim() || null,
          mistake: mistake.trim() || null,
          revisit,
          sourceList: source.trim() || undefined,
          ...(Object.keys(customDraft).length > 0 ? { customValues: customDraft } : {}),
        });

        if (res.success && res.entryId) {
          window.dispatchEvent(
            new CustomEvent("problem-logged", {
              detail: { problemId: isCustom ? undefined : selectedProblem!.id, entryId: res.entryId },
            }),
          );
          setToast({ id: res.entryId, title });
          resetForm();
          onSuccess?.();

          setTimeout(() => {
            setToast((prev) => (prev?.id === res.entryId ? null : prev));
          }, 6000);
        }
      } catch (err) {
        showAlert(`Failed to save: ${String(err)}`);
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

  if (!isOpen && !inline && !toast) return null;

  const inForm = selectedProblem != null || manualMode;
  const logged = selectedProblem?.logged ?? null;
  const modKey = isMac ? "⌘" : "Ctrl";
  // A first-review wait only applies to a problem that is not in rotation yet.
  const reviewDays = firstIntervals && !logged ? firstIntervalForStatus(status, revisit, firstIntervals) : null;
  // The problem shown in the form header: a catalog pick, or a pasted link recognised on another platform.
  const display = selectedProblem
    ? {
        number: selectedProblem.number ?? null,
        title: selectedProblem.title,
        url: selectedProblem.url,
        difficulty: selectedProblem.difficulty ?? null,
        tags: normalizePatternList(
          selectedProblem.patterns.length > 0 ? selectedProblem.patterns.map((p) => p.name) : selectedProblem.topicTags ?? []
        ),
        platform: selectedProblem.platform === "GFG" ? "GeeksforGeeks" : null,
      }
    : fetchedFrom && manualMode
      ? {
          number: null,
          title: manualTitle,
          url: manualUrl,
          difficulty: manualDifficulty,
          tags: patternTags,
          platform: fetchedFrom,
        }
      : null;
  const displayDifficulty = display ? formatDifficulty(display.difficulty) : null;
  const recognisedLink = Boolean(fetchedFrom && isUrlQuery && results.length === 0);

  return (
    <>
      {toast && (
        <div className="ui-toast fixed bottom-5 right-5 z-[60] flex items-center gap-3 border border-border bg-background px-4 py-2.5 shadow-2xl">
          <div className="flex h-2 w-2 bg-easy" />
          <div className="text-sm text-foreground">
            Logged <span className="font-semibold">{toast.title}</span>
          </div>
          <button
            type="button"
            onClick={() => handleUndo(toast.id)}
            className="pressable ml-2 border border-border bg-muted px-2 py-0.5 text-xs text-foreground hover:bg-muted/80"
          >
            Undo
          </button>
        </div>
      )}

      {isOpen && !inline && (
        <button
          type="button"
          className="fixed inset-0 z-40 cursor-default bg-background/40"
          aria-label="Dismiss command bar"
          onClick={() => setIsOpen(false)}
        />
      )}

      {(isOpen || inline) && (
        <div
          role={inline ? undefined : "dialog"}
          aria-modal={inline ? undefined : true}
          aria-label="Log a problem"
          className={cn(
            "w-full overscroll-contain border border-border bg-background shadow-2xl",
            !inline && "max-h-[calc(100dvh-5rem)] overflow-y-auto",
            !inline && "fixed top-16 left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2",
            inline && "relative"
          )}
          onKeyDown={handleFormKeyDown}
        >
          {!inForm ? (
            /* Step 1: find the problem */
            <div className="p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  role="combobox"
                  aria-expanded={showList}
                  aria-controls="problem-listbox"
                  aria-autocomplete="list"
                  aria-activedescendant={showList ? `problem-option-${activeIndex}` : undefined}
                  autoComplete="off"
                  spellCheck={false}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Type problem number (e.g. 15), title, or paste URL..."
                  aria-label="Search problems"
                  className={cn(controlClass, "h-10 pl-9 pr-24")}
                />
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {isLoading ? (
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 animate-ping rounded-full bg-primary" />
                      Searching
                    </span>
                  ) : (
                    <span className="hidden items-center gap-1 sm:inline-flex">
                      <span className="keycap">Esc</span>
                    </span>
                  )}
                </div>
              </div>

              {showList && (
                <ul
                  id="problem-listbox"
                  role="listbox"
                  aria-label="Problems"
                  className="mt-2 max-h-72 overflow-y-auto border border-border bg-background"
                >
                  {results.map((prob, i) => {
                    const diff = formatDifficulty(prob.difficulty);
                    return (
                      <li
                        key={prob.id}
                        id={`problem-option-${i}`}
                        role="option"
                        aria-selected={i === activeIndex}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectProblem(prob)}
                        onMouseEnter={() => setActiveIndex(i)}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 border-l-2 px-3 py-2.5 text-sm",
                          i === activeIndex ? "border-l-primary bg-primary/10" : "border-l-transparent"
                        )}
                      >
                        <span className="w-10 shrink-0 text-right text-xs tabular-numbers text-muted-foreground">
                          {prob.number != null ? `#${prob.number}` : ""}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{prob.title}</span>
                        {prob.patterns.length > 0 && (
                          <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                            {prob.patterns[0].name}
                          </span>
                        )}
                        {prob.logged && (
                          <span className="shrink-0 border border-hint/40 bg-hint/10 px-1.5 py-0.5 text-[11px] text-hint">
                            Logged
                          </span>
                        )}
                        <span className={cn("shrink-0 border px-1.5 py-0.5 text-[11px]", diff.className)}>
                          {diff.label}
                        </span>
                      </li>
                    );
                  })}
                  <li
                    id={`problem-option-${customRowIndex}`}
                    role="option"
                    aria-selected={activeIndex === customRowIndex}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={startCustomProblem}
                    onMouseEnter={() => setActiveIndex(customRowIndex)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 border-l-2 px-3 py-2.5 text-sm",
                      results.length > 0 && "border-t border-t-border",
                      activeIndex === customRowIndex ? "border-l-primary bg-primary/10" : "border-l-transparent"
                    )}
                  >
                    {recognisedLink ? (
                      <>
                        <span className="w-10 shrink-0 text-right text-xs font-semibold text-primary">GfG</span>
                        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{manualTitle}</span>
                        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{fetchedFrom}</span>
                        <span className={cn("shrink-0 border px-1.5 py-0.5 text-[11px]", formatDifficulty(manualDifficulty).className)}>
                          {formatDifficulty(manualDifficulty).label}
                        </span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1 truncate text-foreground">
                          {isUrlQuery ? "Add this link as a custom problem" : <>Log &ldquo;{trimmedQuery}&rdquo; as a custom problem</>}
                        </span>
                        {results.length === 0 && <span className="shrink-0 text-xs text-muted-foreground">Not in catalog</span>}
                      </>
                    )}
                  </li>
                </ul>
              )}

              {showList && (
                <p className="mt-2 hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
                  <span className="inline-flex items-center gap-1"><span className="keycap">↑</span><span className="keycap">↓</span> move</span>
                  <span className="inline-flex items-center gap-1"><span className="keycap"><CornerDownLeft className="h-3 w-3" /></span> select</span>
                </p>
              )}
            </div>
          ) : (
            /* Step 2: log it */
            <>
              <div className="space-y-5 px-5 pb-5 pt-4">
                {/* Problem */}
                {display ? (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex min-w-0 items-center gap-2">
                        {display.number != null && (
                          <span className="shrink-0 text-sm tabular-numbers text-muted-foreground">#{display.number}</span>
                        )}
                        <h2 className="min-w-0 truncate text-base font-semibold text-foreground">{display.title}</h2>
                        {safeHref(display.url) && (
                          <a
                            href={safeHref(display.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Open problem"
                            className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                      <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        {displayDifficulty && display.difficulty && (
                          <span className={cn("border px-1.5 py-0.5 text-[11px]", displayDifficulty.className)}>
                            {displayDifficulty.label}
                          </span>
                        )}
                        {display.platform && <span className="font-medium text-foreground">{display.platform}</span>}
                        {display.tags.slice(0, 4).join(" · ")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={resetForm}
                      aria-label="Choose a different problem"
                      className="shrink-0 p-1 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-primary">Custom problem</span>
                      <button
                        type="button"
                        onClick={resetForm}
                        aria-label="Choose a different problem"
                        className="p-1 text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-[1fr_8rem] gap-3">
                      <div className="space-y-1.5">
                        <label htmlFor="manual-title" className={labelClass}>Title</label>
                        <input
                          id="manual-title"
                          type="text"
                          value={manualTitle}
                          onChange={(e) => setManualTitle(e.target.value)}
                          className={controlClass}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="manual-difficulty" className={labelClass}>Difficulty</label>
                        <select
                          id="manual-difficulty"
                          value={manualDifficulty}
                          onChange={(e) => setManualDifficulty(e.target.value as Difficulty)}
                          className={controlClass}
                        >
                          <option value="EASY">Easy</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HARD">Hard</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="manual-url" className={labelClass}>
                        Link <span className="font-normal text-muted-foreground">optional</span>
                      </label>
                      <input
                        id="manual-url"
                        type="text"
                        inputMode="url"
                        value={manualUrl}
                        onChange={(e) => setManualUrl(e.target.value)}
                        className={controlClass}
                      />
                    </div>
                  </div>
                )}

                {logged && (
                  <div role="status" className="flex items-start gap-2.5 border border-hint/40 bg-hint/10 px-3 py-2.5">
                    <History className="mt-0.5 h-4 w-4 shrink-0 text-hint" />
                    <div className="space-y-0.5 text-xs">
                      <p className="text-sm font-medium text-foreground">Already logged</p>
                      <p className="text-muted-foreground">
                        {OUTCOMES.find((o) => o.value === logged.status)?.label ?? "Logged"} {formatAgo(logged.lastAt)}
                        {logged.nextDue && <> · next review {formatDue(logged.nextDue)}</>}
                      </p>
                      <p className="font-medium text-foreground">
                        Logging a new attempt overwrites the previous attempt, and reschedules the review. You can{" "}
                        <Link
                          href={`/problems/${logged.entryId}`}
                          onClick={resetForm}
                          className="text-primary hover:underline"
                        >
                          view / edit the existing log here
                        </Link>
                        .
                      </p>
                    </div>
                  </div>
                )}

                {/* Outcome */}
                <div className="space-y-2">
                  <span id="outcome-label" className={labelClass}>How did it go?</span>
                  <div role="radiogroup" aria-labelledby="outcome-label" className="grid grid-cols-3 gap-2">
                    {OUTCOMES.map((o) => {
                      const Icon = o.icon;
                      const selected = status === o.value;
                      return (
                        <button
                          key={o.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setStatus(o.value)}
                          className={cn(
                            "pressable flex h-10 items-center justify-center gap-1.5 whitespace-nowrap border px-2 text-sm",
                            selected
                              ? o.fill
                              : "border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span>{o.label}</span>
                          <kbd className="hidden text-[10px] opacity-70 sm:inline">{o.key}</kbd>
                        </button>
                      );
                    })}
                  </div>
                  {reviewDays != null && (
                    <p className="text-xs text-muted-foreground">
                      First review in <span className="font-medium text-foreground">{reviewDays} days</span>
                      {revisit ? " · full re-solve" : " · quick recall check"}
                    </p>
                  )}
                </div>

                {/* Time + flag */}
                <div className="grid grid-cols-[8rem_1fr] items-end gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="log-minutes" className={labelClass}>
                      Time spent
                      {status === "ATTEMPTED_FAILED" && <span className="ml-1.5 font-normal text-muted-foreground">optional</span>}
                    </label>
                    <div className="relative">
                      <input
                        id="log-minutes"
                        ref={minutesInputRef}
                        type="number"
                        min="0"
                        max="600"
                        value={minutes}
                        onChange={(e) => {
                          setMinutes(e.target.value);
                          setMinutesError(false);
                        }}
                        placeholder="25"
                        aria-invalid={minutesError}
                        className={cn(controlClass, "pr-10 tabular-numbers [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none", minutesError && "border-destructive focus:border-destructive focus:ring-destructive")}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">min</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={revisit}
                    onClick={() => setRevisit((v) => !v)}
                    className={cn(
                      "pressable flex h-9 items-center gap-2 border px-3 text-sm",
                      revisit
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center border",
                        revisit ? "border-primary bg-primary text-primary-foreground" : "border-border"
                      )}
                    >
                      {revisit && <Check className="h-3 w-3" />}
                    </span>
                    Revisit early
                  </button>
                  {minutesError && (
                    <p role="alert" className="col-span-2 -mt-1 text-xs text-destructive">
                      Enter the minutes you spent, or pick &ldquo;Saw solution&rdquo;.
                    </p>
                  )}
                </div>

                {/* Notes */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="log-idea" className={labelClass}>Key idea</label>
                    <textarea
                      id="log-idea"
                      ref={ideaRef}
                      value={idea}
                      onChange={(e) => setIdea(e.target.value)}
                      placeholder="Sort by start, keep a min-heap of end times…"
                      rows={2}
                      className={textareaClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="log-mistake" className={labelClass}>Mistake or trap</label>
                    <textarea
                      id="log-mistake"
                      ref={mistakeRef}
                      value={mistake}
                      onChange={(e) => setMistake(e.target.value)}
                      placeholder="Missed the off-by-one on the right boundary…"
                      rows={2}
                      className={textareaClass}
                    />
                  </div>
                </div>

                {/* Optional fields: pattern, source and the user's own columns */}
                <LogExtraFields
                  fields={customFields}
                  onFieldsChange={setCustomFields}
                  values={customDraft}
                  onValuesChange={setCustomDraft}
                  sources={sources}
                  source={source}
                  onSourceChange={setSource}
                  leading={<PatternField tags={patternTags} onChange={setPatternTags} />}
                />
              </div>

              {/* Actions */}
              <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-5 py-3">
                <p className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                  <span className="keycap">{modKey}</span>
                  <span className="keycap"><CornerDownLeft className="h-3 w-3" /></span>
                  <span className="ml-1">to save</span>
                </p>
                <div className="ml-auto flex items-center gap-2">
                  <button type="button" onClick={resetForm} className={ghostButtonClass}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isPending || !canSubmit}
                    onClick={handleSubmit}
                    className="pressable h-9 border border-primary bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isPending ? "Saving…" : logged ? "Log new attempt" : "Log problem"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {alertDialog}
    </>
  );
}
