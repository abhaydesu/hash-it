import Link from "next/link";
import { Search, ExternalLink } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SheetSection } from "@/components/ui/sheet-section";
import { SpecGrid, SpecCell, FigureCaption } from "@/components/ui/spec-sheet";

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
    <div className="relative flex min-h-screen w-full justify-center bg-background font-sans text-foreground selection:bg-foreground selection:text-background">
      <main className="min-h-screen w-full">
        <SheetSection className="relative overflow-hidden" band="hero">
          <div className="relative z-10 flex max-w-3xl flex-col items-start px-6 py-24 sm:py-32">
            <h1 className="mb-8 text-4xl font-medium tracking-tight sm:text-6xl">
              A practice log for LeetCode that decides when you should solve each problem again.
            </h1>

            <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
              {session?.user ? (
                <Link
                  href="/today"
                  className="inline-flex items-center justify-center gap-2 border border-orange-500 bg-orange-500 px-6 py-2.5 text-sm text-white transition-colors hover:bg-orange-600"
                >
                  Open your queue
                </Link>
              ) : (
                <Link
                  href="/auth/signin"
                  className="inline-flex items-center justify-center gap-2 border border-orange-500 bg-orange-500 px-6 py-2.5 text-sm text-white transition-colors hover:bg-orange-600"
                >
                  Get started
                </Link>
              )}
              <Link
                href="/problems"
                className="inline-flex items-center justify-center gap-2 border border-border bg-background px-6 py-2.5 text-sm text-foreground transition-colors hover:border-orange-500 hover:text-orange-600"
              >
                <Search className="h-4 w-4" />
                Explore catalog
              </Link>
            </div>
          </div>

          <div className="-mx-4 bg-dither-25 p-6 sm:-mx-6 sm:p-12">
            <div className="mx-auto max-w-2xl divide-y divide-border border border-border bg-background">
              <div className="flex items-center justify-between bg-muted/40 px-3 py-2 type-label text-muted-foreground">
                <span>Daily queue</span>
                <span className="text-orange-600">3 due</span>
              </div>
              <div className="flex items-center justify-between p-3 text-xs hover:bg-muted/30">
                <span className="text-foreground">#206. Reverse Linked List</span>
                <span className="text-muted-foreground">Due today</span>
              </div>
              <div className="flex items-center justify-between p-3 text-xs hover:bg-muted/30">
                <span className="text-foreground">#15. 3Sum</span>
                <span className="text-muted-foreground">Due today</span>
              </div>
              <div className="flex items-center justify-between p-3 text-xs hover:bg-muted/30">
                <span className="text-foreground">#42. Trapping Rain Water</span>
                <span className="text-destructive">Overdue</span>
              </div>
            </div>
            <FigureCaption fig={1} title="The daily review queue." className="text-center" />
          </div>
        </SheetSection>

        <SheetSection>
          <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
            <div className="p-6 sm:p-12">
              <h2 className="mb-4 text-lg font-medium">The problem with spreadsheets</h2>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                Most developers track their LeetCode progress using a massive spreadsheet. You mark a
                problem green when you solve it, but a month later, you realize you&apos;ve completely
                forgotten the core idea. A spreadsheet is a static checklist, not a memory system. It
                cannot tell you when you are about to forget a pattern.
              </p>
            </div>
            <div className="bg-muted/10 p-6 sm:p-12">
              <h2 className="mb-4 text-lg font-medium">One keystroke logging</h2>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                Hash-It replaces the spreadsheet. Hit{" "}
                <kbd className="border border-border bg-background px-1 py-0.5 font-mono text-[10px]">
                  ⌘K
                </kbd>{" "}
                from anywhere in the app to log a problem you just solved. Add the time it took, the
                core idea, and any mistakes you made. The system will automatically schedule your next
                review based on your performance.
              </p>
            </div>
          </div>
        </SheetSection>

        <SheetSection innerClassName="flex flex-col items-start gap-12 p-6 sm:p-12 md:flex-row">
          <div className="flex-1 space-y-6">
            <h2 className="text-2xl font-medium tracking-tight">
              Scheduling logic based on cognitive science
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Hash-It uses the Free Spaced Repetition Scheduler (FSRS) algorithm to determine the
              optimal time for you to see a problem again. If you struggled, you&apos;ll see it
              tomorrow. If you solved it easily, you might not see it for a month. This guarantees you
              spend time on what you are forgetting, not what you already know.
            </p>
            <a
              href="https://github.com/open-spaced-repetition/fsrs4anki"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 border-b border-orange-500 pb-0.5 text-xs text-orange-600 transition-colors hover:text-orange-700"
            >
              Read about FSRS
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="w-full flex-1 divide-y divide-border border border-border bg-background">
            <div className="bg-muted/40 px-3 py-2 type-label text-muted-foreground">
              How outcomes change the schedule
            </div>
            <div className="grid grid-cols-2 p-3 text-xs">
              <span className="text-foreground">Solved cold</span>
              <span className="text-muted-foreground">Review interval expands</span>
            </div>
            <div className="grid grid-cols-2 p-3 text-xs">
              <span className="text-foreground">Used hint</span>
              <span className="text-muted-foreground">Review interval shrinks</span>
            </div>
            <div className="grid grid-cols-2 p-3 text-xs">
              <span className="text-foreground">Failed</span>
              <span className="text-destructive">Review resets to 1 day</span>
            </div>
          </div>
        </SheetSection>

        <SheetSection>
          <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
            <div className="space-y-3 p-6 transition-colors hover:bg-muted/10 sm:p-8">
              <h3 className="text-sm font-medium">Daily re-solves</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                The daily queue asks you to re-solve specific problems from scratch.
              </p>
            </div>
            <div className="space-y-3 p-6 transition-colors hover:bg-muted/10 sm:p-8">
              <h3 className="text-sm font-medium">Weekly pattern drill</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                A drill appears when a pattern&apos;s recall estimate drops below target or it has not
                been practised in two weeks. Read a cue and name the technique.
              </p>
            </div>
            <div className="space-y-3 p-6 transition-colors hover:bg-muted/10 sm:p-8">
              <h3 className="text-sm font-medium">Monthly blind mock</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Test whether you can choose the right technique from a problem statement alone.
              </p>
            </div>
          </div>
        </SheetSection>

        <SheetSection innerClassName="bg-dither-25 p-6 sm:p-12">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-8 text-center text-xl font-medium">What you keep over time</h2>
            <div className="divide-y divide-border border border-border bg-background text-sm">
              <div className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium">#146. LRU Cache</span>
                  <span className="border border-hard/35 px-1.5 py-0.5 text-[10px] text-hard">
                    Hard
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 type-caption">
                  <span className="border border-border px-1">Hash Table</span>
                  <span className="border border-border px-1">Linked List</span>
                  <span className="border border-border px-1">Design</span>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-[120px_1fr] sm:gap-6">
                <div className="type-label">Core idea</div>
                <div className="leading-relaxed text-foreground">
                  Keep a doubly linked list for the recent items, and a hash map pointing to the list
                  nodes for O(1) access.
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-[120px_1fr] sm:gap-6">
                <div className="type-label">Mistake log</div>
                <div className="leading-relaxed text-foreground">
                  <ul className="list-inside list-disc space-y-1">
                    <li>Forgot to remove the tail when capacity is reached.</li>
                    <li>Didn&apos;t update the hash map when moving a node to the head.</li>
                  </ul>
                </div>
              </div>
            </div>
            <FigureCaption
              fig={2}
              title="An entry focusing on insights, not just the code."
              className="text-center"
            />
          </div>
        </SheetSection>

        <SheetSection innerClassName="p-6 sm:p-12" last>
          <SpecGrid columns={4}>
            <SpecCell label="Total problems" value={problemCountLabel} />
            <SpecCell label="Total patterns" value={patternCountLabel} />
            <SpecCell label="Due today" value={dueCountLabel} />
            <SpecCell label="Leech flags" value={leechCountLabel} />
          </SpecGrid>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4 type-caption">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-orange-600">Next.js 14</span>
              <span className="text-orange-600">PostgreSQL</span>
              <span className="text-orange-600">Prisma</span>
              <span className="text-orange-600">TailwindCSS</span>
            </div>
            <div className="text-orange-600">Designed like a spec sheet.</div>
          </div>
        </SheetSection>
      </main>
    </div>
  );
}
