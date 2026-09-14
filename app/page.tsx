import Link from "next/link";
import { ArrowRight, BarChart3, BrainCircuit, CheckCircle2, Clock3, Database, Search, Sparkles, TrendingUp } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0] ?? "friend";

  const [problemCount, patternCount, dueCount, leechCount] = await Promise.all([
    prisma.problem.count(),
    prisma.pattern.count(),
    prisma.reviewCard.count({ where: { due: { lte: new Date() } } }),
    prisma.reviewCard.count({ where: { lapses: { gte: 3 } } }),
  ]);

  const problemCountLabel = new Intl.NumberFormat("en-US").format(problemCount);
  const patternCountLabel = new Intl.NumberFormat("en-US").format(patternCount);
  const dueCountLabel = new Intl.NumberFormat("en-US").format(dueCount);
  const leechCountLabel = new Intl.NumberFormat("en-US").format(leechCount);

  const features = [
    {
      icon: BrainCircuit,
      title: "FSRS Spaced Repetition",
      description: "Adaptive review scheduling keeps the forgetting curve in front of you instead of hidden behind a checklist.",
    },
    {
      icon: Database,
      title: "Your problem catalog",
      description: "Search the canonical DSA catalog and your own solved history in one place.",
    },
    {
      icon: TrendingUp,
      title: "Mistakes & insights log",
      description: "Capture the idea that worked, the mistake that broke it, and the next time you should revisit it.",
    },
    {
      icon: Sparkles,
      title: `${patternCountLabel} pattern taxonomy`,
      description: "See which recurring frameworks you recognise well and which ones deserve another cue drill.",
    },
    {
      icon: Clock3,
      title: "Roadmap + review rhythm",
      description: "Follow the roadmap while the queue surfaces the problems most likely to fade next.",
    },
    {
      icon: BarChart3,
      title: "Leech rule",
      description: "When a problem slips three times, it becomes a leech: a strong signal that it needs a focused review block.",
    },
  ];

  const metrics = [
    { value: patternCountLabel, label: "patterns" },
    { value: problemCountLabel, label: "problems" },
    { value: dueCountLabel, label: "due now" },
    { value: leechCountLabel, label: "leech flags" },
  ];

  return (
    <div className="pb-16 pt-4 sm:pt-8">
      <section className="relative overflow-hidden rounded-[28px] border border-border/70 bg-card/80 px-5 py-8 shadow-[0_24px_80px_-38px_rgba(15,23,42,0.72)] backdrop-blur-md sm:px-8 lg:px-10 lg:py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.14),transparent_32%)]" />
        <div className="relative grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300 font-pixel">
              <Sparkles className="h-3.5 w-3.5" />
              DSA RETENTION ENGINE
            </div>

            <div className="space-y-4">
              <h1 className="max-w-xl text-4xl font-semibold tracking-[-0.06em] text-foreground sm:text-5xl lg:text-6xl">
                Never Forget a <span className="font-pixel text-emerald-500 dark:text-emerald-400">LeetCode</span> Pattern Again.
              </h1>
              <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                HASH_IT turns every solved problem into a durable memory trace with FSRS review, pattern tagging, and interview-grade analytics built for competitive programmers.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              {session?.user ? (
                <Link href="/today" className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-medium text-background shadow-lg shadow-emerald-500/10 transition-all duration-150 hover:-translate-y-0.5 active:scale-[0.98]">
                  Welcome back, {firstName} <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <Link href="/auth/signin" className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-medium text-background shadow-lg shadow-emerald-500/10 transition-all duration-150 hover:-translate-y-0.5 active:scale-[0.98]">
                  Get Started <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <Link href="/problems" className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background/80 px-5 py-3 text-sm font-medium text-foreground transition-all duration-150 hover:border-border/80 hover:bg-muted active:scale-[0.98]">
                <Search className="h-4 w-4" />
                Explore Problem Catalog
              </Link>
            </div>

            <div className="grid max-w-lg grid-cols-2 gap-3 sm:grid-cols-4">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-border/80 bg-background/60 p-3">
                  <div className="font-pixel text-lg text-foreground sm:text-xl">{metric.value}</div>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{metric.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="rounded-[24px] border border-border bg-background/80 p-4 shadow-2xl shadow-slate-950/30 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Today</div>
                  <div className="mt-1 text-lg font-semibold text-foreground">Review Queue</div>
                </div>
                <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-emerald-600 dark:text-emerald-300">
                  {dueCountLabel} due
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {[
                  { title: "Two Pointers", retrievability: 92, next: "+10m", color: "emerald" },
                  { title: "Sliding Window", retrievability: 74, next: "+1d", color: "amber" },
                  { title: "DP", retrievability: 58, next: "+3d", color: "rose" },
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-border bg-muted/40 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Pattern</div>
                        <div className="mt-1 text-sm font-medium text-foreground">{item.title}</div>
                      </div>
                      <div className="font-pixel text-xs text-foreground">{item.next}</div>
                    </div>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border/70">
                      <div
                        className={`h-full rounded-full ${
                          item.color === "emerald"
                            ? "bg-emerald-500"
                            : item.color === "amber"
                              ? "bg-amber-500"
                              : "bg-rose-500"
                        }`}
                        style={{ width: `${item.retrievability}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      <span>Retrieval</span>
                      <span>{item.retrievability}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-16 space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="font-pixel text-[11px] uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">How it works</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-foreground">A small, daily review loop beats a big but forgotten backlog.</h2>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            "Log what you solve. Type a LeetCode number and the problem, difficulty, tags and pattern fill themselves in. You add the idea that cracked it and what you got wrong.",
            "The scheduler decides when you see it again. Each problem gets a predicted forgetting curve based on the solve outcome and the time it took relative to its difficulty baseline.",
            "Re-solve a few a day. The daily queue mixes patterns deliberately so you review memory under recall pressure instead of following a linear checklist.",
            "Check recognition weekly, technique monthly. A two-minute cue drill tests whether you can name the pattern; a monthly blind mock gives five timed problems with the labels stripped off.",
          ].map((step, index) => (
            <div key={step} className="rounded-2xl border border-border bg-card/70 p-5">
              <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-sm font-semibold text-emerald-600 dark:text-emerald-300">
                {index + 1}
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{step}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="font-pixel text-[11px] uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">Built for memory</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-foreground">Everything you need to retain algorithmic intuition.</h2>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-2xl border border-border bg-card/70 p-5 transition-all duration-150 hover:-translate-y-1 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 rounded-[24px] border border-border bg-card/80 p-6">
        <div className="font-pixel text-[11px] uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">Why it works</div>
        <h3 className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-foreground">Memory decay is a real problem. Your review system should be smarter than a checklist.</h3>
        <div className="mt-6 space-y-4">
          {[
            "FSRS-6 schedules each problem using stability, difficulty and retrievability rather than a fixed interval ladder.",
            "Patterns are tagged and recommended when the next review is most useful, which keeps weak areas from hiding behind a long backlog.",
            "A problem that slips three times becomes a leech: a clear signal to review it before it eats another interview cycle.",
          ].map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-xl border border-border/80 bg-background/50 p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
              <p className="text-sm leading-6 text-muted-foreground">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 rounded-[28px] border border-emerald-500/20 bg-emerald-500/5 px-6 py-10 text-center shadow-[0_20px_60px_-38px_rgba(16,185,129,0.7)] sm:px-8">
        <div className="font-pixel text-[11px] uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">Ready to level up</div>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground sm:text-4xl">Start building a stronger interview memory.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
          Review the right problems at the right time, spot your weak patterns early, and reduce the churn between solving and remembering.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {session?.user ? (
            <Link href="/today" className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-medium text-background active:scale-[0.98]">
              Go to Daily Queue <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <Link href="/auth/signin" className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-medium text-background active:scale-[0.98]">
              Sign in with Google <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          <Link href="/roadmap" className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background/80 px-5 py-3 text-sm font-medium text-foreground active:scale-[0.98]">
            Explore roadmap
          </Link>
        </div>
      </section>
    </div>
  );
}
