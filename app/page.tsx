import Link from "next/link";
import { Search, ExternalLink } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SheetSection } from "@/components/ui/sheet-section";

export default async function HomePage() {
  const session = await auth();

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

  return (
    <div className="relative min-h-screen bg-background text-foreground font-sans selection:bg-foreground selection:text-background flex justify-center w-full">
      {/* Background hatch/texture outside the main column (optional, using plain background for now to keep it clean) */}

      {/*
        The main center column
        Has vertical rules running the full height of the page, unbroken.
      */}
      <main className="w-full min-h-screen">

        {/* Section 1: Hero */}
        <SheetSection className="relative overflow-hidden" band="accent">
          <div aria-hidden="true" className="pointer-events-none absolute -left-4 -right-4 top-0 h-64 bg-dither-orange opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent)] sm:-left-6 sm:-right-6" />
          <div className="relative z-10 px-6 py-24 sm:py-32 flex flex-col items-start max-w-3xl">
            <h1 className="text-4xl sm:text-6xl font-medium tracking-tight mb-8">
              A practice log for LeetCode that decides when you should solve each problem again.
            </h1>

            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              {session?.user ? (
                <Link
                  href="/today"
                  className="inline-flex items-center justify-center gap-2 border border-orange-500 bg-orange-500 px-6 py-2.5 text-sm text-white hover:bg-orange-600 transition-colors"
                >
                  Open your queue
                </Link>
              ) : (
                <Link
                  href="/auth/signin"
                  className="inline-flex items-center justify-center gap-2 border border-orange-500 bg-orange-500 px-6 py-2.5 text-sm text-white hover:bg-orange-600 transition-colors"
                >
                  Get started
                </Link>
              )}
              <Link
                href="/problems"
                className="inline-flex items-center justify-center gap-2 border border-border bg-background px-6 py-2.5 text-sm font-mono text-foreground hover:bg-muted transition-colors"
              >
                <Search className="h-4 w-4" />
                Explore catalog
              </Link>
            </div>
          </div>

          {/* Hero Figure (Static render of daily review queue) */}
          <div className="-mx-4 border-t border-border bg-dither-25 p-6 sm:-mx-6 sm:p-12">
            <div className="max-w-2xl mx-auto border border-border bg-background">
              <div className="border-b border-border bg-muted/40 p-2 px-3 flex justify-between items-center text-[10px] font-mono text-muted-foreground  tracking-wider">
                <span>Daily queue</span>
                <span className="text-orange-600">3 due</span>
              </div>
              <div className="divide-y divide-border font-mono text-xs">
                <div className="flex justify-between items-center p-3 hover:bg-muted/30">
                  <span className="text-foreground">#206. Reverse Linked List</span>
                  <span className="text-muted-foreground">Due today</span>
                </div>
                <div className="flex justify-between items-center p-3 hover:bg-muted/30">
                  <span className="text-foreground">#15. 3Sum</span>
                  <span className="text-muted-foreground">Due today</span>
                </div>
                <div className="flex justify-between items-center p-3 hover:bg-muted/30">
                  <span className="text-foreground">#42. Trapping Rain Water</span>
                  <span className="text-destructive">Overdue</span>
                </div>
              </div>
            </div>
            <div className="mt-3 text-center text-[11px] font-mono text-muted-foreground">
              <span className="text-orange-600">Fig 1.</span> The daily review queue.
            </div>
          </div>
        </SheetSection>

        {/* Section 2: The Problem */}
        <SheetSection>
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
            <div className="p-6 sm:p-12">
              <h2 className="text-lg font-medium mb-4">The problem with spreadsheets</h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                Most developers track their LeetCode progress using a massive spreadsheet. You mark a problem green when you solve it, but a month later, you realize you've completely forgotten the core idea. A spreadsheet is a static checklist, not a memory system. It cannot tell you when you are about to forget a pattern.
              </p>
            </div>
            <div className="p-6 sm:p-12 bg-muted/10">
              <h2 className="text-lg font-medium mb-4">One keystroke logging</h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                Hash-It replaces the spreadsheet. Hit <kbd className="font-mono text-[10px] border border-border px-1 py-0.5 bg-background">⌘K</kbd> from anywhere in the app to log a problem you just solved. Add the time it took, the core idea, and any mistakes you made. The system will automatically schedule your next review based on your performance.
              </p>
            </div>
          </div>
        </SheetSection>

        {/* Section 3: Scheduling & FSRS */}
        <SheetSection innerClassName="p-6 sm:p-12 flex flex-col md:flex-row gap-12 items-start">
          <div className="flex-1 space-y-6">
            <h2 className="text-2xl font-medium tracking-tight">Scheduling logic based on cognitive science</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Hash-It uses the Free Spaced Repetition Scheduler (FSRS) algorithm to determine the optimal time for you to see a problem again. If you struggled, you'll see it tomorrow. If you solved it easily, you might not see it for a month. This guarantees you spend time on what you are forgetting, not what you already know.
            </p>
            <a href="https://github.com/open-spaced-repetition/fsrs4anki" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-mono text-orange-600 hover:text-orange-700 transition-colors border-b border-orange-500 pb-0.5">
              Read about FSRS
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="flex-1 w-full border border-border bg-background">
            <div className="border-b border-border bg-muted/40 p-2 px-3 text-[10px] font-mono text-muted-foreground  tracking-wider">
              How outcomes change the schedule
            </div>
            <div className="divide-y divide-border text-xs font-mono">
              <div className="grid grid-cols-2 p-3">
                <span className="text-foreground">Solved cold</span>
                <span className="text-muted-foreground">Review interval expands</span>
              </div>
              <div className="grid grid-cols-2 p-3">
                <span className="text-foreground">Used hint</span>
                <span className="text-muted-foreground">Review interval shrinks</span>
              </div>
              <div className="grid grid-cols-2 p-3">
                <span className="text-foreground">Failed</span>
                <span className="text-destructive">Review resets to 1 day</span>
              </div>
            </div>
          </div>
        </SheetSection>

        {/* Section 4: Three Checks */}
        <SheetSection>
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
            <div className="p-6 sm:p-8 space-y-3 hover:bg-muted/10 transition-colors">
              <h3 className="font-medium text-sm">Daily re-solves</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The daily queue asks you to re-solve specific problems from scratch.
              </p>
            </div>
            <div className="p-6 sm:p-8 space-y-3 hover:bg-muted/10 transition-colors">
              <h3 className="font-medium text-sm">Weekly pattern drill</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A drill appears when a pattern&apos;s recall estimate drops below target or it has not been practised in two weeks. Read a cue and name the technique.
              </p>
            </div>
            <div className="p-6 sm:p-8 space-y-3 hover:bg-muted/10 transition-colors">
              <h3 className="font-medium text-sm">Monthly blind mock</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Test whether you can choose the right technique from a problem statement alone.
              </p>
            </div>
          </div>
        </SheetSection>

        {/* Section 5: What You Keep */}
        <SheetSection innerClassName="bg-dither-25 p-6 sm:p-12">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-medium mb-8 text-center">What you keep over time</h2>
            <div className="border border-border bg-background text-sm">
              <div className="border-b border-border p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">#146. LRU Cache</span>
                  <span className="font-mono text-[10px] border border-border px-1.5 py-0.5 text-muted-foreground ">Hard</span>
                </div>
                <div className="flex gap-2 font-mono text-[10px] text-muted-foreground">
                  <span className="border border-border px-1">Hash Table</span>
                  <span className="border border-border px-1">Linked List</span>
                  <span className="border border-border px-1">Design</span>
                </div>
              </div>
              <div className="divide-y divide-border">
                <div className="p-4 grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-2 sm:gap-6">
                  <div className="font-mono text-xs text-muted-foreground  tracking-wider">Core Idea</div>
                  <div className="text-foreground leading-relaxed">Keep a doubly linked list for the recent items, and a hash map pointing to the list nodes for O(1) access.</div>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-2 sm:gap-6">
                  <div className="font-mono text-xs text-muted-foreground  tracking-wider">Mistake Log</div>
                  <div className="text-foreground leading-relaxed">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Forgot to remove the tail when capacity is reached.</li>
                      <li>Didn't update the hash map when moving a node to the head.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 text-center text-[11px] font-mono text-muted-foreground">
              Fig 2. An entry focusing on insights, not just the code.
            </div>
          </div>
        </SheetSection>

        {/* Section 6: Colophon / Stats Grid */}
        <SheetSection innerClassName="p-6 sm:p-12" band="none">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-[-1px] font-mono text-xs">
            <div className="border border-border p-4 flex flex-col justify-between">
              <span className="text-muted-foreground  mb-4">Total Problems</span>
              <span className="text-xl text-foreground tabular-numbers">{problemCountLabel}</span>
            </div>
            <div className="border border-border p-4 flex flex-col justify-between -ml-[1px]">
              <span className="text-muted-foreground  mb-4">Total Patterns</span>
              <span className="text-xl text-foreground tabular-numbers">{patternCountLabel}</span>
            </div>
            <div className="border border-border p-4 flex flex-col justify-between mt-[-1px] md:mt-0 md:-ml-[1px]">
              <span className="text-muted-foreground  mb-4">Due Today</span>
              <span className="text-xl text-foreground tabular-numbers">{dueCountLabel}</span>
            </div>
            <div className="border border-border p-4 flex flex-col justify-between mt-[-1px] md:mt-0 -ml-[1px]">
              <span className="text-muted-foreground  mb-4">Leech Flags</span>
              <span className="text-xl text-foreground tabular-numbers">{leechCountLabel}</span>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-4 items-center justify-between text-[10px] font-mono text-muted-foreground border-t border-border pt-4">
            <div className="flex items-center gap-4">
              <span className="text-orange-600">Next.js 14</span>
              <span className="text-orange-600">PostgreSQL</span>
              <span className="text-orange-600">Prisma</span>
              <span className="text-orange-600">TailwindCSS</span>
            </div>
            <div>
              Designed like a spec sheet.
            </div>
          </div>
        </SheetSection>

      </main>
    </div>
  );
}
