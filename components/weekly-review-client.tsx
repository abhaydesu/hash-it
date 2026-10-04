"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import { CalendarClock, Check, CircleCheck, ExternalLink, RefreshCw, Trophy, X } from "lucide-react";
import { recordRecallCheck, commitWeeklyPlan } from "@/app/actions/weekly-actions";
import { WeeklyPlanItems } from "@/components/weekly-plan-items";
import type { Confidence, PlanItemView, PlanKind, ProblemRef, RecallCheckItem, WeeklyReviewData } from "@/lib/weekly-review";
import type { Contest } from "@/lib/contests";
import { useMounted } from "@/lib/use-mounted";
import { Countdown } from "@/components/ui/countdown";
import { cn, formatDifficulty, safeHref } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SheetSection } from "@/components/ui/sheet-section";
import { SpecGrid, SpecCell } from "@/components/ui/spec-sheet";
import { weekRangeLabel } from "@/lib/dates";

const CONFIDENCE: Array<{ value: Confidence; label: string; hint: string }> = [
  { value: "BLANK", label: "Blank", hint: "No idea" },
  { value: "HAZY", label: "Hazy", hint: "Rough idea" },
  { value: "CLEAR", label: "Clear", hint: "Could code it" },
];

const REASON_LABEL: Record<RecallCheckItem["reason"], string> = {
  lapsed: "Forgot this week",
  weak: "Weak spot",
  stale: "Not reviewed in a while",
};

const PLAN_COPY: Record<PlanKind, { title: string; why: string }> = {
  REDO: { title: "Redo a stuck problem", why: "Solve it cold, from scratch." },
  FRESH: { title: "Try an unseen problem", why: "From your weakest pattern — tests whether it transfers." },
  REVISIT: { title: "Revisit an old one", why: "Something you haven't touched in a month." },
};
const PLAN_ORDER: PlanKind[] = ["REDO", "FRESH", "REVISIT"];

const pct = (n: number) => `${Math.round(n * 100)}%`;

function StepHeading({ step, title, aside, children }: { step: number; title: string; aside?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="type-heading text-foreground">
          <span className="mr-2 tabular-nums text-muted-foreground">{step}</span>
          {title}
        </h2>
        {children && <p className="mt-1 type-caption">{children}</p>}
      </div>
      {aside && <div className="type-caption tabular-nums">{aside}</div>}
    </div>
  );
}

function ProblemLink({ problem, className }: { problem: ProblemRef; className?: string }) {
  const href = safeHref(problem.url);
  const label = (
    <>
      {problem.number != null && <span className="tabular-nums text-muted-foreground">{problem.number}.</span>} {problem.title}
    </>
  );
  if (!href) return <span className={cn("font-medium text-foreground", className)}>{label}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex min-w-0 items-center gap-1 font-medium text-foreground hover:text-orange-600", className)}
    >
      <span className="truncate">{label}</span>
      <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
    </a>
  );
}

/* ── Step 1 ── */

function LookBack({ data }: { data: WeeklyReviewData["lookBack"] }) {
  const rows: Array<[string, React.ReactNode]> = [];
  if (data.lastPlan) rows.push(["Last week's plan", `${data.lastPlan.done} of ${data.lastPlan.total} done`]);
  else if (data.lastWeekSkipped) rows.push(["Last week's review", "Skipped. No catching up needed, this week's check covers it."]);
  if (data.weakestPatterns.length > 0)
    rows.push([
      "Weakest patterns",
      <span key="w" className="flex flex-wrap gap-x-3 gap-y-1">
        {data.weakestPatterns.map((p) => (
          <span key={p.name}>
            <span className="font-medium text-foreground">{p.name}</span>{" "}
            <span className="tabular-nums">
              · {p.belowTarget} below target, lowest {pct(p.weakestRecall)}
            </span>
          </span>
        ))}
      </span>,
    ]);
  if (data.newlyStuck.length > 0)
    rows.push([
      "Newly stuck",
      <span key="s" className="flex flex-wrap gap-x-3 gap-y-1">
        {data.newlyStuck.map((p) => (
          <ProblemLink key={p.problemId} problem={p} />
        ))}
      </span>,
    ]);

  return (
    <div className="space-y-4">
      <StepHeading step={1} title="Last 7 days" />
      <SpecGrid columns={4}>
        <SpecCell label="Reviews done" value={data.reviewsDone} />
        <SpecCell label="New problems" value={data.newLogged} />
        <SpecCell
          label="Forgotten"
          value={<span className={cn(data.forgotten > 0 && "text-hard")}>{data.forgotten}</span>}
          subvalue="Rated Again this week"
        />
        <SpecCell
          label="Overdue now"
          value={<span className={cn(data.overdueNow > 0 && "text-medium")}>{data.overdueNow}</span>}
        />
      </SpecGrid>
      {rows.length > 0 && (
        <dl className="divide-y divide-border border border-border bg-background text-xs">
          {rows.map(([term, value]) => (
            <div key={term} className="grid gap-1 p-3 sm:grid-cols-[160px_1fr] sm:gap-4">
              <dt className="font-medium text-foreground">{term}</dt>
              <dd className="min-w-0 text-muted-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/* ── Step 2 ── */

function RecallCheckCard({
  item,
  onAnswered,
}: {
  item: RecallCheckItem;
  onAnswered: (entryId: string, result: { confidence: Confidence; recalled: boolean }) => void;
}) {
  const [confidence, setConfidence] = useState<Confidence | null>(item.result?.confidence ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const result = item.result;
  const revealed = confidence != null;
  const diff = formatDifficulty(item.difficulty);

  const answer = (recalled: boolean) => {
    if (!confidence) return;
    setError(null);
    startTransition(async () => {
      try {
        await recordRecallCheck({ entryId: item.entryId, confidence, recalled });
        onAnswered(item.entryId, { confidence, recalled });
      } catch {
        setError("Couldn't save that answer. Try again.");
      }
    });
  };

  const falseConfidence = result?.confidence === "CLEAR" && !result.recalled;

  return (
    <div className={cn("space-y-3 p-4 sm:p-5", result && "bg-muted/20")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant={diff.variant}>{diff.label}</Badge>
          <ProblemLink problem={item} />
        </div>
        <span className="type-caption">{REASON_LABEL[item.reason]}</span>
      </div>

      {!revealed ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Recall the approach and the trap. How sure are you?</p>
          <div className="grid grid-cols-3 gap-2 sm:flex">
            {CONFIDENCE.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setConfidence(c.value)}
                className="pressable flex flex-col items-start border border-border bg-background px-3 py-1.5 text-left hover:border-orange-500 hover:bg-muted/40 sm:min-w-28"
              >
                <span className="text-xs font-medium text-foreground">{c.label}</span>
                <span className="text-[10px] text-muted-foreground">{c.hint}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-2 border-l-2 border-border pl-3 text-xs">
            {item.patterns.length > 0 && (
              <div className="type-label text-muted-foreground">{item.patterns.join(" · ")}</div>
            )}
            <div>
              <span className="type-label text-muted-foreground">Idea</span>
              <p className="mt-0.5 whitespace-pre-wrap text-foreground">{item.idea || "No idea note."}</p>
            </div>
            <div className={cn(falseConfidence && "border-l-2 border-destructive bg-destructive/5 -ml-[14px] pl-3 py-1.5")}>
              <span className={cn("type-label", falseConfidence ? "text-destructive" : "text-muted-foreground")}>Trap</span>
              <p className="mt-0.5 whitespace-pre-wrap font-mono text-foreground">{item.mistake || "No mistake note."}</p>
            </div>
          </div>

          {result ? (
            <p className={cn("flex items-center gap-1.5 text-xs", result.recalled ? "text-easy" : falseConfidence ? "text-destructive" : "text-muted-foreground")}>
              {result.recalled ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              {result.recalled
                ? "Had it. Schedule unchanged."
                : falseConfidence
                  ? "You were sure and missed it. It's due tomorrow — read the trap above once more."
                  : "Missed. It's due tomorrow."}
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                You said <span className="font-medium text-foreground">{CONFIDENCE.find((c) => c.value === confidence)?.label}</span>. Did you have it?
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={isPending} onClick={() => answer(false)}>
                  Missed it
                </Button>
                <Button variant="primary" size="sm" disabled={isPending} onClick={() => answer(true)}>
                  Had it
                </Button>
              </div>
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </>
      )}
    </div>
  );
}

function RecallCheck({
  items,
  onAnswered,
}: {
  items: RecallCheckItem[];
  onAnswered: (entryId: string, result: { confidence: Confidence; recalled: boolean }) => void;
}) {
  const answered = items.filter((i) => i.result);
  const certain = answered.filter((i) => i.result!.confidence === "CLEAR");
  const certainRight = certain.filter((i) => i.result!.recalled).length;

  return (
    <div className="space-y-4">
      <StepHeading
        step={2}
        title="Recall check"
        aside={items.length > 0 ? `${answered.length} / ${items.length}` : undefined}
      >
        Title only. Recall the approach and the trap, say how sure you are, then check against your notes.
      </StepHeading>

      {items.length === 0 ? (
        <div className="border border-border bg-muted/40 px-4 py-8 text-center">
          <CircleCheck className="mx-auto mb-2 h-5 w-5 text-foreground" />
          <p className="text-sm font-medium text-foreground">Nothing is slipping.</p>
          <p className="mt-1 type-caption">Every problem you&apos;ve reviewed is above your target recall.</p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-border border border-border bg-background">
            {items.map((item) => (
              <RecallCheckCard key={item.entryId} item={item} onAnswered={onAnswered} />
            ))}
          </div>
          {answered.length === items.length && (
            <p className="text-xs text-muted-foreground">
              Done.{" "}
              {certain.length > 0 ? (
                <>
                  You were certain on <span className="font-medium text-foreground tabular-nums">{certain.length}</span> and right on{" "}
                  <span className="font-medium text-foreground tabular-nums">{certainRight}</span>.
                </>
              ) : (
                "You weren't certain on any — that's honest, and the misses are queued for tomorrow."
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/* ── Step 3 ── */

function ContestLine({ contest }: { contest: Contest }) {
  // Local time only after mount, so the server-rendered HTML matches.
  const mounted = useMounted();
  const when = mounted && new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(
    contest.startTime,
  );
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 p-3 sm:p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <Trophy className="h-3.5 w-3.5 text-orange-600" /> Cold-solve test
        </div>
        <p className="type-caption">Unseen problems under a clock — the honest check.</p>
      </div>
      <a
        href={contest.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:text-orange-600"
      >
        {contest.title} {when && <span className="font-normal text-muted-foreground">· {when}</span>}
        <ExternalLink className="h-3 w-3 opacity-60" />
      </a>
    </div>
  );
}

function toDraftItems(
  chosen: Array<{ kind: PlanKind; problem: ProblemRef }>,
  previous: WeeklyReviewData["plan"]["committed"],
): PlanItemView[] {
  return chosen.map(({ kind, problem }) => {
    const prev = previous?.find((i) => i.kind === kind && i.problemId === problem.problemId);
    return { ...problem, kind, done: prev?.done ?? false, entryId: prev?.entryId ?? null };
  });
}

function Plan({
  plan,
  contest,
  open,
  onCommitted,
}: {
  plan: WeeklyReviewData["plan"];
  contest: Contest | null;
  open: boolean;
  onCommitted?: (hasPlan: boolean) => void;
}) {
  const [editing, setEditing] = useState(open && plan.committed == null);
  const [index, setIndex] = useState<Record<PlanKind, number>>(() => {
    // Start editing from what's already committed, when possible.
    const at = (kind: PlanKind) =>
      Math.max(0, plan.candidates[kind].findIndex((c) => c.problemId === plan.committed?.find((i) => i.kind === kind)?.problemId));
    return { REDO: at("REDO"), FRESH: at("FRESH"), REVISIT: at("REVISIT") };
  });
  const [skipped, setSkipped] = useState<Set<PlanKind>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<PlanItemView[] | null>(null);
  const [isPending, startTransition] = useTransition();

  const chosen = PLAN_ORDER.flatMap((kind) => {
    const c = plan.candidates[kind][index[kind]];
    return c && !skipped.has(kind) ? [{ kind, problem: c }] : [];
  });

  const commit = () => {
    setError(null);
    const items = toDraftItems(chosen, plan.committed);
    setOptimistic(items);
    setEditing(false);
    onCommitted?.(true);
    startTransition(async () => {
      try {
        await commitWeeklyPlan({ items: chosen.map((c) => ({ kind: c.kind, problemId: c.problem.problemId })) });
      } catch {
        setOptimistic(null);
        setEditing(true);
        onCommitted?.(plan.committed != null);
        setError("Couldn't save the plan. Try again.");
      }
    });
  };

  useEffect(() => {
    if (!optimistic || !plan.committed) return;
    const match =
      plan.committed.length === optimistic.length &&
      plan.committed.every((i, n) => i.kind === optimistic[n].kind && i.problemId === optimistic[n].problemId);
    if (match) setOptimistic(null);
  }, [plan.committed, optimistic]);

  const toggleSkip = (kind: PlanKind) =>
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  const committed = optimistic ?? plan.committed;
  const doneCount = committed?.filter((i) => i.done).length ?? 0;

  return (
    <div className="space-y-4">
      <StepHeading
        step={3}
        title="Plan the week"
        aside={
          isPending
            ? "Saving…"
            : !editing && committed
              ? `${doneCount} / ${committed.length} done`
              : undefined
        }
      >
        Three problems, mixed on purpose. They show up on Today until they&apos;re done.
      </StepHeading>

      <div
        className={cn("divide-y divide-border border border-border bg-background", isPending && "pointer-events-none")}
        aria-busy={isPending || undefined}
      >
        {!editing && !committed && (
          <p className="p-3 text-xs text-muted-foreground sm:p-4">No plan for this week.</p>
        )}
        {!editing && committed ? (
          <WeeklyPlanItems
            items={committed}
            renderProblem={(item, done) => (
              <ProblemLink problem={item} className={cn("text-xs", done && "text-muted-foreground line-through")} />
            )}
          />
        ) : editing && PLAN_ORDER.map((kind) => {
              const options = plan.candidates[kind];
              const current = options[index[kind]];
              const isSkipped = skipped.has(kind);
              return (
                <div key={kind} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                  <div className={cn("min-w-0 space-y-0.5", isSkipped && "opacity-50")}>
                    <div className="type-label text-muted-foreground">{PLAN_COPY[kind].title}</div>
                    {current ? (
                      <ProblemLink problem={current} className="text-xs" />
                    ) : (
                      <p className="text-xs text-muted-foreground">Nothing fits yet.</p>
                    )}
                    <p className="type-caption">{PLAN_COPY[kind].why}</p>
                  </div>
                  {current && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      {options.length > 1 && !isSkipped && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() => setIndex((prev) => ({ ...prev, [kind]: (prev[kind] + 1) % options.length }))}
                        >
                          <RefreshCw className="h-3 w-3" /> Swap
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => toggleSkip(kind)}>
                        {isSkipped ? "Include" : "Skip"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
        {contest && <ContestLine contest={contest} />}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        {editing ? (
          <>
            {committed && (
              <Button variant="secondary" size="sm" onClick={() => setEditing(false)} disabled={isPending}>
                Cancel
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={commit} disabled={isPending || chosen.length === 0}>
              {isPending ? "Saving…" : committed ? "Update plan" : "Commit plan"}
            </Button>
          </>
        ) : (
          open && (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)} disabled={isPending}>
              {isPending ? "Saving…" : "Change plan"}
            </Button>
          )
        )}
      </div>
    </div>
  );
}

/* ── Page ── */

export function WeeklyReviewClient({ data, contests }: { data: WeeklyReviewData; contests: Contest[] }) {
  const [checks, setChecks] = useState(data.checks);
  const [hasPlan, setHasPlan] = useState(data.plan.committed != null);
  const onAnswered = (entryId: string, result: { confidence: Confidence; recalled: boolean }) =>
    setChecks((prev) => prev.map((i) => (i.entryId === entryId ? { ...i, result } : i)));

  useEffect(() => {
    if (data.plan.committed != null) setHasPlan(true);
  }, [data.plan.committed]);

  // Done = every recall check answered and a plan committed. The page stays open either way.
  const complete = hasPlan && checks.every((c) => c.result);

  // Pure UTC calendar math, identical on server and client.
  const weekLabel = useMemo(() => weekRangeLabel(data.weekStart), [data.weekStart]);

  return (
    <div>
      <SheetSection innerClassName="py-6">
        <h1 className="type-title text-foreground">Weekly review</h1>
        <p className="mt-1 type-caption">
          {data.open ? (
            <>{weekLabel}. Look back on your week, check what you still remember, and plan the next one. About ten minutes.</>
          ) : (
            <>{weekLabel}.</>
          )}
        </p>
        {!data.open && (
          <div className="mt-4 flex items-start gap-2 border border-border bg-muted/40 px-4 py-3 text-xs text-foreground">
            <CalendarClock className="mt-px h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              The review opens on Sunday to plan the week ahead —{" "}
              <span className="font-medium">
                <Countdown to={data.nextReviewAt} />
              </span>
              . Monday works too if you miss it.
            </span>
          </div>
        )}
        {data.open && complete && (
          <div className="mt-4 flex items-start gap-2 border border-easy/40 bg-easy/10 px-4 py-3 text-xs text-foreground">
            <CircleCheck className="mt-px h-4 w-4 shrink-0 text-easy" />
            <span>
              <span className="font-medium">Review done for {weekLabel}.</span> The next one opens{" "}
              <span className="font-medium">
                <Countdown to={data.nextReviewAt} />
              </span>
              . Come back any time to check your plan.
            </span>
          </div>
        )}
      </SheetSection>

      {data.open && (
        <>
          <SheetSection innerClassName="py-6" band="neutral">
            <LookBack data={data.lookBack} />
          </SheetSection>

          <SheetSection innerClassName="py-6">
            <RecallCheck items={checks} onAnswered={onAnswered} />
          </SheetSection>
        </>
      )}

      <SheetSection innerClassName="py-6" last>
        <Plan
          plan={data.plan}
          contest={data.open ? (contests[0] ?? null) : null}
          open={data.open}
          onCommitted={setHasPlan}
        />
      </SheetSection>
    </div>
  );
}
