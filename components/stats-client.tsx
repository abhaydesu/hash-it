"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ExternalLink, SlidersHorizontal } from "lucide-react";
import { cn, formatDifficulty, safeHref } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SpecGrid, SpecCell } from "@/components/ui/spec-sheet";
import { SheetSection } from "@/components/ui/sheet-section";
import { Heatmap } from "@/components/ui/heatmap";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StreakBadge } from "@/components/streak-badge";
import { StatsConfigurator } from "@/components/stats-configurator";
import { resolveSectionLayout, type StatsPreferences } from "@/lib/stats-preferences";
import { LEECH_LAPSES } from "@/lib/scheduler";
import type { AllStats, HeadlineStats, StatsSection, StreakStats } from "@/lib/stats-engine";

type SectionOf<K extends StatsSection["kind"]> = Extract<StatsSection, { kind: K }>;

const DIFFICULTY_BAR: Record<string, string> = { EASY: "bg-easy", MEDIUM: "bg-medium", HARD: "bg-hard" };

const GLOSSARY = [
  ["Re-solved without help", "Share of full re-solves from your queue rated Good or Easy. Recall checks are not counted."],
  ["Practice streak", "Consecutive days with at least one review. Stays alive until you miss a full day."],
  ["Times forgotten", "Average lapses per carded problem — how often a problem you knew slipped away."],
  ["Typical solve time", "Median recorded minutes for each difficulty, ignoring entries without a time."],
  ["Stuck problems", `Problems whose review card has ${LEECH_LAPSES} or more lapses.`],
] as const;

/* ── Fixed blocks ── */

function Headline({ headline: h, streak }: { headline: HeadlineStats; streak: StreakStats }) {
  const minutes = (n: number) => (n > 0 ? Math.round(n) : "–");
  return (
    <SpecGrid columns={5}>
      <StreakBadge streak={streak} className="col-span-2 lg:col-span-1" />
      <SpecCell
        label="Re-solved without help"
        value={h.totalAttempts > 0 ? <span className="text-easy">{(h.coldSolveRate * 100).toFixed(0)}%</span> : "–"}
        subvalue={`${h.coldSolveAttempts} of ${h.totalAttempts} re-solves`}
      />
      <SpecCell label="Problems practised" value={h.totalEntries} subvalue={`${h.totalCards} in review rotation`} />
      <SpecCell
        label="Times forgotten"
        value={h.lapseRate.toFixed(2)}
        subvalue={`${h.totalLapses} lapses, per problem`}
      />
      <SpecCell
        label="Typical solve time"
        value={
          <span className="flex items-baseline gap-1.5 tabular-nums">
            <span className="text-easy">{minutes(h.medianMinutes.EASY)}</span>
            <span className="font-normal text-muted-foreground/60">/</span>
            <span className="text-medium">{minutes(h.medianMinutes.MEDIUM)}</span>
            <span className="font-normal text-muted-foreground/60">/</span>
            <span className="text-hard">{minutes(h.medianMinutes.HARD)}</span>
          </span>
        }
        subvalue="Minutes · easy / med / hard"
      />
    </SpecGrid>
  );
}

function Activity({ activityMap }: { activityMap: Record<string, number> }) {
  const [selectedYear, setSelectedYear] = useState("last365");

  const years = useMemo(() => {
    const set = new Set(Object.keys(activityMap).map((d) => d.slice(0, 4)));
    set.add(String(new Date().getFullYear()));
    return [...set].sort().reverse();
  }, [activityMap]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="type-heading text-foreground">Practice activity</h2>
          <span className="type-caption">Reviews logged per day</span>
        </div>
        <Select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="h-8 w-[140px] py-1 text-xs"
          aria-label="Heatmap range"
        >
          <option value="last365">Last 365 days</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </Select>
      </div>
      <div className="overflow-x-auto border border-border bg-background p-4 sm:p-6">
        <Heatmap data={activityMap} selectedYear={selectedYear} className="w-full" />
      </div>
    </>
  );
}

/* ── Configurable section renderers ── */

function SectionHeading({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="type-heading text-foreground">{children}</h2>
      {aside && <span className="tabular-nums type-caption">{aside}</span>}
    </div>
  );
}

function Bar({ fraction, className }: { fraction: number; className?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden bg-muted">
      <div
        className={cn("h-full origin-left transition-transform duration-modal ease-in-out-strong", className ?? "bg-foreground/70")}
        style={{ transform: `scaleX(${fraction})` }}
      />
    </div>
  );
}

function Distribution({ section }: { section: SectionOf<"distribution"> }) {
  const { counts, total, isDifficulty } = section.data;
  const rows = Object.entries(counts);
  // Difficulty keeps its natural Easy→Hard order; everything else ranks by count.
  if (!isDifficulty) rows.sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <SectionHeading aside={`${total} total`}>{section.label}</SectionHeading>
      <div className="space-y-3">
        {rows.map(([key, count]) => {
          const fraction = total > 0 ? count / total : 0;
          const diff = isDifficulty ? formatDifficulty(key) : null;
          return (
            <div key={key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-xs">
                {diff ? (
                  <Badge variant={diff.variant}>{diff.label}</Badge>
                ) : (
                  <span className="truncate font-medium text-foreground">{key}</span>
                )}
                <span className="shrink-0 tabular-nums type-caption">
                  {count} · {Math.round(fraction * 100)}%
                </span>
              </div>
              <Bar fraction={fraction} className={isDifficulty ? DIFFICULTY_BAR[key] : undefined} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NumberSummary({ section }: { section: SectionOf<"number_summary"> }) {
  const { min, max, median, mean, count } = section.data;
  const fmt = (n: number) => (Number.isInteger(n) ? n : n.toFixed(1));
  return (
    <div className="space-y-4">
      <SectionHeading aside={`${count} values`}>{section.label}</SectionHeading>
      <SpecGrid columns={2}>
        <SpecCell label="Median" value={fmt(median)} />
        <SpecCell label="Average" value={fmt(mean)} />
        <SpecCell label="Min" value={fmt(min)} />
        <SpecCell label="Max" value={fmt(max)} />
      </SpecGrid>
    </div>
  );
}

function BooleanRatio({ section }: { section: SectionOf<"boolean_ratio"> }) {
  const { trueCount, falseCount, total } = section.data;
  const fraction = total > 0 ? trueCount / total : 0;
  return (
    <div className="space-y-4">
      <SectionHeading aside={`${Math.round(fraction * 100)}% yes`}>{section.label}</SectionHeading>
      <div className="space-y-1.5">
        <Bar fraction={fraction} className="bg-foreground/70" />
        <div className="flex items-center justify-between text-xs tabular-nums type-caption">
          <span>Yes · {trueCount}</span>
          <span>No · {falseCount}</span>
        </div>
      </div>
    </div>
  );
}

function KeywordCloud({ section }: { section: SectionOf<"keyword_cloud"> }) {
  const { keywords } = section.data;
  const top = keywords[0]?.count ?? 1;
  return (
    <div className="space-y-4">
      <SectionHeading>{section.label}</SectionHeading>
      <div className="flex flex-wrap gap-1.5">
        {keywords.map((kw) => (
          <span
            key={kw.word}
            className={cn(
              "inline-flex items-center gap-1.5 border border-border px-2 py-0.5 text-xs",
              kw.count / top > 0.5 ? "bg-muted text-foreground" : "bg-background text-muted-foreground",
            )}
          >
            <span className="font-medium">{kw.word}</span>
            <span className="tabular-nums opacity-70">{kw.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function LeechList({ section }: { section: SectionOf<"leech_list"> }) {
  const { leechEntries } = section.data;

  if (leechEntries.length === 0) {
    return (
      <div className="space-y-4">
        <SectionHeading>{section.label}</SectionHeading>
        <p className="type-caption">Nothing has been forgotten {LEECH_LAPSES}+ times. Nice.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 type-heading text-destructive">
          <AlertTriangle className="h-4 w-4" /> {section.label}
        </h2>
        <span className="tabular-nums type-caption text-destructive">
          {leechEntries.length} {leechEntries.length === 1 ? "problem" : "problems"}
        </span>
      </div>

      <div className="divide-y divide-border border border-border bg-background">
        {leechEntries.map((leech) => {
          const diff = formatDifficulty(leech.difficulty);
          const href = safeHref(leech.url);
          return (
            <div key={leech.entryId} className="space-y-2.5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                  <Badge variant="status-failed">{leech.lapses} lapses</Badge>
                  <Badge variant={diff.variant}>{diff.label}</Badge>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 font-medium text-foreground transition-colors hover:text-orange-600"
                    >
                      {leech.title} <ExternalLink className="h-3 w-3 opacity-60" />
                    </a>
                  ) : (
                    <span className="font-medium text-foreground">{leech.title}</span>
                  )}
                </div>
                <Link
                  href={`/problems/${leech.entryId}`}
                  className="border border-border bg-background px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-muted"
                >
                  View detail
                </Link>
              </div>

              {leech.mistake && (
                <div className="border-l-2 border-destructive bg-muted/30 p-2.5 text-xs text-foreground">
                  <span className="mb-1 block type-label text-destructive">Mistake note</span>
                  <div className="whitespace-pre-wrap font-mono leading-relaxed">{leech.mistake}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderSection(section: StatsSection) {
  switch (section.kind) {
    case "distribution":
      return <Distribution section={section} />;
    case "number_summary":
      return <NumberSummary section={section} />;
    case "boolean_ratio":
      return <BooleanRatio section={section} />;
    case "keyword_cloud":
      return <KeywordCloud section={section} />;
    case "leech_list":
      return <LeechList section={section} />;
  }
}

/** A populated leech list needs the full width; everything else can share a row. */
const isWide = (s: StatsSection) => s.kind === "leech_list" && s.data.leechEntries.length > 0;

/** Group visible sections into rows: wide sections alone, compact ones in pairs. */
function toRows(sections: StatsSection[]): StatsSection[][] {
  const rows: StatsSection[][] = [];
  let pending: StatsSection | null = null;
  for (const s of sections) {
    if (isWide(s)) {
      if (pending) rows.push([pending]);
      pending = null;
      rows.push([s]);
    } else if (pending) {
      rows.push([pending, s]);
      pending = null;
    } else {
      pending = s;
    }
  }
  if (pending) rows.push([pending]);
  return rows;
}

/* ── Page ── */

export function StatsClient({ allStats, preferences }: { allStats: AllStats; preferences: StatsPreferences }) {
  const [showConfig, setShowConfig] = useState(false);
  const { headline, streak, activityMap, sections } = allStats;

  const rows = useMemo(() => {
    const byId = new Map(sections.map((s) => [s.sectionId, s]));
    const visible = resolveSectionLayout([...byId.keys()], preferences)
      .filter((r) => r.visible)
      .map((r) => byId.get(r.id)!);
    return toRows(visible);
  }, [sections, preferences]);

  const isEmpty = headline.totalEntries === 0;

  return (
    <div>
      <SheetSection innerClassName="flex items-start justify-between gap-4 py-6">
        <div>
          <h1 className="type-title text-foreground">Stats</h1>
          <p className="mt-1 type-caption">A summary of the problems you&apos;ve logged and how you&apos;ve done so far.</p>
        </div>
        {!isEmpty && (
          <Button
            variant={showConfig ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowConfig((v) => !v)}
            aria-expanded={showConfig}
            className="shrink-0 gap-1.5"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Customize</span>
          </Button>
        )}
      </SheetSection>

      {showConfig && (
        <StatsConfigurator
          sections={sections.map((s) => ({ id: s.sectionId, label: s.label }))}
          preferences={preferences}
          onClose={() => setShowConfig(false)}
        />
      )}

      <SheetSection innerClassName="py-6" band="neutral">
        <div className="space-y-4">
          <Headline headline={headline} streak={streak} />
          <SpecGrid columns={2}>
            <SpecCell
              label="Never solved without help"
              value={headline.neverSolvedWithoutHelp}
              subvalue="Entries with no cold-solve attempt on record."
            />
            <SpecCell
              label="Learned from a solution, never re-solved"
              value={headline.learnedFromSolutionNeverResolved}
              subvalue="Of those, passed a recall check; a first real solve is queued."
            />
          </SpecGrid>
        </div>
      </SheetSection>

      <SheetSection innerClassName="space-y-4 py-6" last={isEmpty}>
        <Activity activityMap={activityMap} />
        {isEmpty && (
          <p className="type-caption">
            No problems logged yet.{" "}
            <Link href="/import" className="text-foreground underline underline-offset-2 hover:text-orange-600">
              Import your history
            </Link>{" "}
            to see your stats fill in.
          </p>
        )}
      </SheetSection>

      {!isEmpty && (
        <>
          {rows.map((row) => (
            <SheetSection key={row.map((s) => s.sectionId).join("--")} innerClassName="py-6">
              <div className={cn("grid grid-cols-1 gap-8", row.length === 2 && "md:grid-cols-2")}>
                {row.map((s) => (
                  <div key={s.sectionId}>{renderSection(s)}</div>
                ))}
              </div>
            </SheetSection>
          ))}

          <SheetSection innerClassName="py-6" last>
            <details className="group border border-border bg-background text-xs">
              <summary className="cursor-pointer list-none p-4 type-heading text-foreground marker:hidden">
                <span className="mr-2 inline-block transition-transform group-open:rotate-90">›</span>
                What these mean
              </summary>
              <dl className="divide-y divide-border border-t border-border">
                {GLOSSARY.map(([term, definition]) => (
                  <div key={term} className="grid gap-1 p-3 sm:grid-cols-[180px_1fr] sm:gap-4 sm:p-4">
                    <dt className="font-medium text-foreground">{term}</dt>
                    <dd className="text-muted-foreground">{definition}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </SheetSection>
        </>
      )}
    </div>
  );
}
