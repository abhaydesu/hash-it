import Link from "next/link";
import { ArrowRight, BarChart3, BrainCircuit, CheckCircle2, Clock3, Database, Search, Sparkles, TrendingUp } from "lucide-react";
import { auth } from "@/lib/auth";

const features = [
  {
    icon: BrainCircuit,
    title: "FSRS Spaced Repetition",
    description: "Adaptive review scheduling prevents the solve-and-forget loop for real interview prep.",
  },
  {
    icon: Database,
    title: "4,055 Problem Catalog",
    description: "Search the canonical DSA catalog and your own solved history in one place.",
  },
  {
    icon: TrendingUp,
    title: "Mistakes & Insights Log",
    description: "Capture mental blockers, bug patterns, and edge-case mistakes before they recur.",
  },
  {
    icon: Sparkles,
    title: "14 Core Patterns",
    description: "Master the recurring frameworks behind sliding windows, DP, graphs, and more.",
  },
  {
    icon: Clock3,
    title: "Roadmap + Drills",
    description: "Follow a YouTuber roadmap while drilling weekly and monthly mock sessions.",
  },
  {
    icon: BarChart3,
    title: "Leech Detection",
    description: "Spot recurring failures early with analytics that flag weak areas before interviews.",
  },
];

const metrics = [
  { value: "92%", label: "retrievability" },
  { value: "14", label: "core patterns" },
  { value: "4,055", label: "problems" },
  { value: "3+", label: "lapses = leech" },
];

export default async function HomePage() {
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0] ?? "friend";

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
                  12 due
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

      <section className="mt-16 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[24px] border border-border bg-card/80 p-6">
          <div className="font-pixel text-[11px] uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">Why it works</div>
          <h3 className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-foreground">Memory decay is a real problem. Your review system should be smarter than a checklist.</h3>
          <div className="mt-6 space-y-4">
            {[
              "FSRS schedules each problem based on how quickly it decays in your memory.",
              "Patterns are tagged and recommended when the next review is most useful.",
              "Leeches are surfaced before they derail your interview confidence.",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-xl border border-border/80 bg-background/50 p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                <p className="text-sm leading-6 text-muted-foreground">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-border bg-background/80 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-pixel text-[11px] uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">Benchmark</div>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-foreground">Retain what matters</h3>
            </div>
            <div className="rounded-full border border-border bg-muted px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Live</div>
          </div>

          <div className="mt-6 space-y-5">
            {[
              { label: "Graph problems", value: 82 },
              { label: "Two pointers", value: 91 },
              { label: "DP / memoization", value: 67 },
              { label: "Monotonic stacks", value: 49 },
            ].map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  <span>{item.label}</span>
                  <span>{item.value}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-border/80">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500" style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
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
