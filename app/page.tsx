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
      title: "FSRS review logic",
      description: "Adaptive review scheduling keeps the forgetting curve visible instead of hiding it behind a checklist.",
    },
    {
      icon: Database,
      title: "Your problem catalog",
      description: "Search the canonical DSA catalog and your own history in one place.",
    },
    {
      icon: TrendingUp,
      title: "Mistakes and insight log",
      description: "Capture the idea that worked, the bug in your reasoning, and the next time you should revisit it.",
    },
    {
      icon: Sparkles,
      title: `${patternCountLabel} pattern taxonomy`,
      description: "See which recurring frameworks you know well and which ones deserve another pass.",
    },
    {
      icon: Clock3,
      title: "Roadmap and review rhythm",
      description: "Follow the roadmap while the queue surfaces the problems most likely to fade next.",
    },
    {
      icon: BarChart3,
      title: "Leech rule",
      description: "When a problem slips three times, it becomes a strong signal that it needs a review block.",
    },
  ];

  const metrics = [
    { value: patternCountLabel, label: "patterns" },
    { value: problemCountLabel, label: "problems" },
    { value: dueCountLabel, label: "due now" },
    { value: leechCountLabel, label: "leech flags" },
  ];

  return (
    <div className="pb-16 pt-6">
      <section className="mx-auto max-w-6xl rounded-[30px] border border-border bg-card p-6 sm:p-8 lg:p-10">
        <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              DSA retention engine
            </div>

            <div className="space-y-4">
              <h1 className="max-w-xl text-4xl font-semibold tracking-[-0.06em] text-foreground sm:text-5xl lg:text-6xl">
                Build a memory for every problem you solve.
              </h1>
              <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                HASH_IT turns solved problems into durable recall by combining your notes, pattern tags, and spaced repetition.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              {session?.user ? (
                <Link href="/today" className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-medium text-background">
                  Welcome back, {firstName}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <Link href="/auth/signin" className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-medium text-background">
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <Link href="/problems" className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3 text-sm font-medium text-foreground">
                <Search className="h-4 w-4" />
                Explore catalog
              </Link>
            </div>

            <div className="grid max-w-lg grid-cols-2 gap-3 sm:grid-cols-4">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-xl border border-border bg-background p-3">
                  <div className="tabular-numbers text-xl font-semibold text-foreground">{metric.value}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{metric.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-border bg-background p-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <div className="text-sm font-medium text-foreground">Daily review queue</div>
              </div>
              <div className="rounded-full border border-border bg-card px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                {dueCountLabel} due
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {[
                { title: "Two pointers", retention: 92, next: "+10 min" },
                { title: "Sliding window", retention: 74, next: "+1 day" },
                { title: "DP", retention: 58, next: "+3 days" },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">pattern</div>
                      <div className="mt-1 text-sm font-medium text-foreground">{item.title}</div>
                    </div>
                    <div className="tabular-numbers text-xs text-muted-foreground">{item.next}</div>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#E7D3B4_0%,#D5B083_35%,#B67C4C_75%,#7E553C_100%)]"
                      style={{ width: `${item.retention}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    <span>retrieval</span>
                    <span>{item.retention}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl">
        <div className="mb-6 max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-[-0.05em] text-foreground">A small daily review loop beats a large forgotten backlog.</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            "Log the problem and the idea that cracked it. The system remembers the pattern, the mistake, and the next time it should resurface.",
            "The scheduler chooses the next review based on how quickly the concept decays, not on a static checklist.",
            "Re-solve a few problems a day rather than chasing a large backlog. The queue stays intentionally small and relevant.",
            "Use weekly cue drills and monthly blind mocks to check recognition and transfer, not just raw recall.",
          ].map((step, index) => (
            <div key={step} className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-sm font-medium text-foreground">
                {index + 1}
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{step}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {features.map(({ icon: Icon, title, description }) => (
          <div key={title} className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background text-foreground">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto mt-16 max-w-6xl rounded-[28px] border border-border bg-card p-6 sm:p-8">
        <h3 className="max-w-2xl text-2xl font-semibold tracking-[-0.05em] text-foreground">
          Memory decay is a real problem. The review system should be smarter than a checklist.
        </h3>
        <div className="mt-6 space-y-3">
          {[
            "FSRS schedules each problem using stability, difficulty and retrievability rather than a fixed ladder.",
            "Patterns are tagged and suggested when the next review is most useful.",
            "Problems that repeat too often become clear signals to slow down and focus.",
          ].map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-foreground" />
              <p className="text-sm leading-6 text-muted-foreground">{item}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
