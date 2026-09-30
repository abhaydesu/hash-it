"use client";
import React from "react";

import Link from "next/link";
import { ArrowRight, CalendarRange, Check, Clock3, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { RecallCardItem } from "@/components/recall-card-item";
import { ReviewCardItem } from "@/components/review-card-item";
import { SpecGrid, SpecCell } from "@/components/ui/spec-sheet";
import { SheetSection } from "@/components/ui/sheet-section";
import { ShortcutKeycaps } from "@/components/ui/keycap-hint";
import type { PlanItemView, getActivePlan } from "@/lib/weekly-review";
import type { MonthlyStatus } from "@/lib/review-windows";
import { Countdown } from "@/components/ui/countdown";
import { ImportPromptBanner } from "@/components/import-prompt-banner";
import { cn } from "@/lib/utils";

type ReviewLane = "RECALL" | "RESOLVE";

interface QueueItem {
  entryId: string;
  problemId: string;
  title: string;
  number?: number | null;
  url: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD" | null;
  platform: string;
  lapses: number;
  reps: number;
  family?: string | null;
  lane: ReviewLane;
  lastRating?: string | null;
  revisit?: boolean;
  mistake?: string | null;
  idea?: string | null;
}

interface Snapshot {
  totalEntries: number;
  coldSolveRate: number;
  leechCount: number;
}

export interface TodayData {
  queue: QueueItem[];
  resolveCount: number;
  recallCount: number;
  /** Queue reviews already logged today (local day). */
  doneToday: number;
  snapshot: Snapshot;
  overdueCount: number;
  /** Owner-only roadmap; other users get a plain empty-state hint. */
  showRoadmap?: boolean;
  /** New sign-ups who haven't imported or dismissed the import banner. */
  showImportPrompt?: boolean;
  /** Time-of-day greeting, computed on the server in the user's timezone. */
  greeting: string;
  weeklyPlan: Awaited<ReturnType<typeof getActivePlan>>;
  monthlyStatus: MonthlyStatus;
  lastMock: { solved: number; total: number } | null;
}

function MonthlyTile({ status, lastMock }: { status: MonthlyStatus; lastMock: TodayData["lastMock"] }) {
  const locked = status.state === "locked";
  return (
    <div className="flex flex-col justify-between bg-background p-4 sm:p-5">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="type-heading text-foreground">Monthly mock</h2>
          {lastMock ? (
            <span className="type-caption tabular-nums">
              Last: {lastMock.solved}/{lastMock.total} cold
            </span>
          ) : (
            <Clock3 className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <p className="mt-2 type-caption leading-relaxed">
          Five blind problems, timed. No labels, no hints. Opens on the last day of each month.
        </p>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3 type-caption">
        <span className={cn(status.state === "open" && status.overdue && "font-medium text-medium")}>
          {status.state === "locked" ? (
            <>
              Opens <Countdown to={status.opensAt} showDate={false} />
            </>
          ) : status.state === "open" ? (
            status.overdue ? "Overdue" : "Due today"
          ) : (
            "Ready"
          )}
        </span>
        <Link href="/review/monthly" className="link-arrow font-medium text-orange-600 hover:text-orange-700">
          {locked ? "View" : "Start mock"} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

const PLAN_LABEL: Record<PlanItemView["kind"], string> = { REDO: "Redo", FRESH: "New", REVISIT: "Revisit" };

/** Today's view of the weekly review: the committed plan, or a nudge to do this week's review. */
function WeeklyTile({ plan }: { plan: TodayData["weeklyPlan"] }) {
  const items = plan.items;
  const done = items?.filter((i) => i.done).length ?? 0;
  return (
    <div className="flex flex-col justify-between bg-background p-4 sm:p-5">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="type-heading text-foreground">
            {items ? (plan.upcoming ? "Next week's plan" : "This week's plan") : "Weekly review"}
          </h2>
          {items ? (
            <span className="type-caption tabular-nums">
              {done} / {items.length}
            </span>
          ) : (
            <CalendarRange className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        {items ? (
          <ul className="mt-2 space-y-1.5">
            {items.map((i) => (
              <li key={i.kind} className="flex items-center gap-2 text-xs">
                <span className="w-14 shrink-0 type-label text-muted-foreground">{PLAN_LABEL[i.kind]}</span>
                <span className={cn("min-w-0 flex-1 truncate", i.done ? "text-muted-foreground line-through" : "text-foreground")}>
                  {i.number != null && <span className="tabular-nums text-muted-foreground">{i.number}. </span>}
                  {i.title}
                </span>
                {i.done && <Check className="h-3.5 w-3.5 shrink-0 text-easy" />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 type-caption leading-relaxed">
            Look back, catch what&apos;s slipping, plan three problems. About ten minutes.
          </p>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 type-caption">
        <span>
          {plan.reviewOpen && !plan.reviewDone ? (
            "Open now"
          ) : (
            <>
              {plan.reviewDone ? "Done · next" : "Opens"} <Countdown to={plan.nextReviewAt} showDate={false} />
            </>
          )}
        </span>
        <Link href="/review/weekly" className="link-arrow font-medium text-orange-600 hover:text-orange-700">
          {plan.reviewOpen && !plan.reviewDone ? "Start review" : "Open review"} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

const COLLAPSE_MS = 300;

export function TodayClient({ data }: { data: TodayData }) {
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [leavingIds, setLeavingIds] = useState<Set<string>>(new Set());
  const [overdueDismissed, setOverdueDismissed] = useState(false);
  const [overdueLeaving, setOverdueLeaving] = useState(false);

  // Collapse the card first, then drop it once siblings have slid up.
  const handleCardComplete = (entryId: string) => {
    setLeavingIds((prev) => new Set([...prev, entryId]));
    window.setTimeout(() => {
      setCompletedIds((prev) => new Set([...prev, entryId]));
    }, COLLAPSE_MS);
  };

  const { queue, resolveCount, recallCount, doneToday, snapshot, overdueCount } = data;
  const finished = queue.length > 0 || doneToday > 0;
  // Logging a review revalidates /today, so the server drops that card while it's
  // still showing its result. Keep cards we've shown until their own onComplete
  // removes them; only new arrivals come from the server list.
  const shown = useRef<QueueItem[]>(queue);
  const shownIds = new Set(shown.current.map((item) => item.entryId));
  const activeQueue = [
    ...shown.current.map((item) => queue.find((q) => q.entryId === item.entryId) ?? item),
    ...queue.filter((item) => !shownIds.has(item.entryId)),
  ].filter((item) => !completedIds.has(item.entryId));
  useEffect(() => {
    shown.current = activeQueue;
  });
  const estimateMinutes = recallCount * 3 + resolveCount * 25;

  return (
    <div>
      <SheetSection innerClassName="flex flex-col gap-3 py-6 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h1 className="type-title text-foreground">{data.greeting}</h1>
          <p className="mt-1 type-caption">
            Here&apos;s what to revisit today, most urgent first.
          </p>
        </div>
        <Link
          href="/problems"
          className="pressable inline-flex h-8 items-center self-start border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted"
        >
          Review catalogue
        </Link>
      </SheetSection>

      {data.showImportPrompt && <ImportPromptBanner />}

      <SheetSection innerClassName="py-6" band="neutral">
        <SpecGrid columns={4}>
          <SpecCell label="Problems logged" value={snapshot.totalEntries} />
          <SpecCell
            label="Solved without help"
            value={`${Math.round(snapshot.coldSolveRate * 100)}%`}
          />
          <SpecCell label="Due today" value={queue.length} />
          <SpecCell label="Stuck problems" value={snapshot.leechCount} />
        </SpecGrid>
      </SheetSection>

      {overdueCount > 20 && !overdueDismissed && (
        <SheetSection innerClassName="py-3">
          <div className="collapsible" data-leaving={overdueLeaving || undefined}>
          <div className="flex items-start justify-between gap-3 border border-warning/40 bg-background px-4 py-3 text-sm text-warning">
            <p>
              <span className="font-semibold tabular-numbers">{overdueCount} cards overdue.</span> Reviews
              are capped, so this clears slowly. Consider a catch-up session or{" "}
              <Link href="/settings" className="text-orange-600 underline underline-offset-2 hover:text-orange-700">
                lowering retention in settings
              </Link>
              .
            </p>
            <button
              type="button"
              onClick={() => {
                setOverdueLeaving(true);
                window.setTimeout(() => setOverdueDismissed(true), COLLAPSE_MS);
              }}
              className="pressable shrink-0 p-1 hover:bg-muted"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          </div>
        </SheetSection>
      )}

      <SheetSection innerClassName="space-y-4 py-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
          <h2 className="type-heading text-foreground">Review queue</h2>
          <p className="type-caption tabular-numbers">
            <span className="font-semibold text-foreground">{recallCount}</span> quick recall and{" "}
            <span className="font-semibold text-foreground">{resolveCount}</span> full re-solve, about{" "}
            {estimateMinutes} min.
          </p>
        </div>

        {activeQueue.length === 0 ? (
          <div className="idea-preview border border-border bg-muted/40 px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">
              {finished ? "Done for today." : "Nothing due today."}
            </p>
            <p className="mt-1 type-caption">
              {finished
                ? <>Log new problems with <ShortcutKeycaps className="align-middle" /> or review the catalogue.</>
                : <>Log new problems with <ShortcutKeycaps className="align-middle" />{data.showRoadmap ? ", or work through your roadmap." : "."}</>}
            </p>
          </div>
        ) : (
          <div className="stagger-in">
            {activeQueue.map((item) => (
              <div
                key={item.entryId}
                className="collapsible"
                data-leaving={leavingIds.has(item.entryId) || undefined}
              >
                {/* Spacing lives inside the collapsing row so the gap closes with it. */}
                <div className="pb-3">
                  {item.lane === "RECALL" ? (
                    <RecallCardItem item={item} onComplete={() => handleCardComplete(item.entryId)} />
                  ) : (
                    <ReviewCardItem item={item} onComplete={() => handleCardComplete(item.entryId)} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetSection>

      <SheetSection innerClassName="py-6" band="none" last>
        <div className="grid grid-cols-1 divide-y divide-border border border-border md:grid-cols-2 md:divide-x md:divide-y-0">
          <WeeklyTile plan={data.weeklyPlan} />

          <MonthlyTile status={data.monthlyStatus} lastMock={data.lastMock} />
        </div>
      </SheetSection>
    </div>
  );
}
