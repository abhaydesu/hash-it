import React from 'react';
import Link from "next/link";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { auth } from "@/lib/auth";
import { SheetSection } from "@/components/ui/sheet-section";
import { FigureCaption } from "@/components/ui/spec-sheet";
import { PixelBlast } from "@/components/ui/pixel-blast";
import { ForgettingCurveGraph } from "@/components/ui/forgetting-curve";

export default async function HomePage() {
  const session = await auth();

  return (
    <div className="relative flex min-h-screen w-full justify-center bg-background font-sans text-foreground selection:bg-foreground selection:text-background">
      <main className="min-h-screen w-full">

        {/* ── Hero ── */}
        <SheetSection className="relative" band="hero">
          <div className="relative z-10 flex max-w-3xl flex-col items-start px-6 py-24 sm:py-32">
            <h1 className="idea-preview mb-4 text-4xl font-medium tracking-tight sm:text-6xl">
              Remember every problem you solve.
            </h1>
            <p className="mb-8 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Hash-It uses spaced repetition to schedule your LeetCode reviews. You re-solve
              what&apos;s fading, skip what&apos;s locked in.
            </p>

            {session?.user ? (
              <Link
                href="/today"
                className="pressable inline-flex items-center justify-center gap-2 border border-orange-500 bg-orange-500 px-6 py-2.5 text-sm text-white hover:bg-orange-600"
              >
                Open your queue
              </Link>
            ) : (
              <Link
                href="/auth/signin"
                className="pressable inline-flex items-center justify-center gap-2 border border-orange-500 bg-orange-500 px-6 py-2.5 text-sm text-white hover:bg-orange-600"
              >
                Get started
              </Link>
            )}
          </div>

          <div className="relative -mx-4 border-t border-border bg-dither-25 pt-6 sm:-mx-8 sm:pt-12">
            <div className="mx-auto max-w-4xl overflow-hidden border border-border bg-background stagger-in">
              <Image
                src="/today.png"
                alt="Hash-It daily review queue showing a problem due for review"
                width={1200}
                height={800}
                className="w-full dark:hidden"
                priority
              />
              <Image
                src="/today-dark.png"
                alt="Hash-It daily review queue showing a problem due for review"
                width={1200}
                height={800}
                className="hidden w-full dark:block"
                priority
              />
            </div>
          </div>
        </SheetSection>

        {/* ── Problem / Solution ── */}
        <SheetSection band="neutral">
          <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
            <div className="p-6 sm:p-12">
              <h2 className="mb-4 text-lg font-medium">Why spreadsheets fail</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                You mark a problem green, but a month later the core idea is gone. A spreadsheet
                tracks what you&apos;ve done. It can&apos;t tell you what you&apos;re about to forget.
              </p>
            </div>
            <div className="bg-muted/10 p-6 sm:p-12">
              <h2 className="mb-4 text-lg font-medium">Log once, review forever</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Hit{" "}
                <kbd className="border border-border bg-background px-1 py-0.5 font-mono text-[10px]">
                  ⌘K
                </kbd>{" "}
                to log a problem. Record the time, the core idea, and any mistakes. The next review
                is scheduled automatically based on how you performed.
              </p>
            </div>
          </div>
        </SheetSection>

        {/* ── How it works — horizontal timeline ── */}
        <SheetSection innerClassName="py-10 px-6 sm:px-12">
          <div className="flex flex-col items-stretch gap-0 md:flex-row md:items-start md:gap-8 stagger-in">
            {/* Step 1 */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-orange-500 text-[11px] font-semibold text-orange-600">
                  1
                </span>
                <h3 className="text-sm font-medium">Solve and log</h3>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Solve a problem on LeetCode. Log the time, the core insight, and what tripped you up.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-orange-500 text-[11px] font-semibold text-orange-600">
                  2
                </span>
                <h3 className="text-sm font-medium">System schedules</h3>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                FSRS picks the exact day you&apos;d forget. It reappears in your queue. No manual scheduling.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-orange-500 text-[11px] font-semibold text-orange-600">
                  3
                </span>
                <h3 className="text-sm font-medium">Re-solve and grow</h3>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Each review strengthens the memory. Intervals stretch. You stop forgetting what you&apos;ve learned.
              </p>
            </div>
          </div>
        </SheetSection>

        {/* ── Forgetting curve — stacked vertically ── */}
        <SheetSection innerClassName="p-6 sm:p-12" band="neutral">
          <div className="mx-auto max-w-3xl space-y-8">
            <div className="space-y-4">
              <h2 className="text-2xl font-medium tracking-tight">
                Spaced repetition, not guesswork
              </h2>
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                FSRS calculates when you&apos;re about to forget each problem. Struggled? You&apos;ll
                see it tomorrow. Solved it cold? Maybe not for a month. You spend time on what&apos;s
                fading, never on what you already know.
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

            <div className="border border-border bg-background p-4 sm:p-6">
              <ForgettingCurveGraph />
            </div>
            <FigureCaption
              fig={2}
              title="Without review, recall drops to near zero. Spaced reviews keep it high with widening intervals."
              className="text-center"
            />
          </div>
        </SheetSection>

        {/* ── Three cadences ── */}
        <SheetSection innerClassName="space-y-4 py-8">
          <div className="text-center text-xl font-medium pb-4">Three review cadences</div>
          <div className="grid grid-cols-1 divide-y divide-border border border-border bg-background md:grid-cols-3 md:divide-x md:divide-y-0 stagger-in">
            <div className="space-y-3 p-6 sm:p-8">
              <h3 className="text-sm font-medium">Daily queue</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Re-solve due problems from scratch. The queue fills itself.
              </p>
            </div>
            <div className="space-y-3 p-6 sm:p-8">
              <h3 className="text-sm font-medium">Weekly drill</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Read a cue, name the pattern. Tests recognition without code.
              </p>
            </div>
            <div className="space-y-3 p-6 sm:p-8">
              <h3 className="text-sm font-medium">Monthly mock</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Five blind problems, timed. No labels, no hints. The stress test.
              </p>
            </div>
          </div>
        </SheetSection>

        {/* ── Entry example ── */}
        <SheetSection innerClassName="bg-dither-25 p-6 sm:p-12">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-8 text-center text-xl font-medium">What an entry looks like</h2>
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
              fig={3}
              title="Each entry captures the idea and mistakes, not just the solve."
              className="text-center"
            />
          </div>
        </SheetSection>

        {/* ── Pattern mastery preview ── */}
        <SheetSection innerClassName="p-6 sm:p-12" band="neutral">
          <div className="mx-auto max-w-3xl space-y-8">
            <div className="space-y-3">
              <h2 className="text-xl font-medium">See where you&apos;re strong and where you&apos;re not</h2>
              <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
                Every problem maps to a pattern family. Hash-It tracks recall strength per pattern
                so you know exactly where to focus.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-3 lg:grid-cols-5">
              {[
                { name: "Two Pointers", pct: 94, level: 4 },
                { name: "Sliding Window", pct: 87, level: 3 },
                { name: "Binary Search", pct: 81, level: 3 },
                { name: "BFS / DFS", pct: 62, level: 2 },
                { name: "Backtracking", pct: 45, level: 1 },
                { name: "Dynamic Prog.", pct: 38, level: 1 },
                { name: "Greedy", pct: 71, level: 2 },
                { name: "Stack / Queue", pct: 90, level: 4 },
                { name: "Linked List", pct: 85, level: 3 },
                { name: "Trie", pct: null, level: 0 },
              ].map((p) => (
                <div
                  key={p.name}
                  className={`flex flex-col justify-between bg-background p-3 dither-mastery-${p.level}`}
                >
                  <span className="text-[11px] font-medium text-foreground">{p.name}</span>
                  <span className="mt-2 text-xs tabular-nums text-muted-foreground">
                    {p.pct != null ? `${p.pct}%` : "New"}
                  </span>
                </div>
              ))}
            </div>
            <FigureCaption
              fig={4}
              title="Pattern mastery grid. Dither density encodes recall strength."
              className="text-center"
            />
          </div>
        </SheetSection>

        {/* ── Not Anki ── */}
        <SheetSection>
          <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
            <div className="p-6 sm:p-12">
              <h2 className="mb-4 text-lg font-medium">Not a flashcard app</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Anki reviews text. Hash-It reviews problems. You re-solve from scratch, on the
                real platform, under time pressure. The scheduling is the same science — the
                practice is real.
              </p>
            </div>
            <div className="bg-muted/10 p-6 sm:p-12">
              <h2 className="mb-4 text-lg font-medium">Not a problem list</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                NeetCode and Grind 75 tell you what to solve first. Hash-It tells you what to
                solve again. Use any list to seed your log — the review schedule is what
                keeps it in your head.
              </p>
            </div>
          </div>
        </SheetSection>

        {/* ── Closing CTA with PixelBlast frame ── */}
        <SheetSection last>
          <div className="relative">
            {/* PixelBlast border — all four sides */}
            <div className="-mx-8 pointer-events-none absolute inset-x-0 top-0 h-8 overflow-hidden" aria-hidden="true">
              <PixelBlast color="#f97316" pixelSize={4} />
            </div>
            <div className="-mx-8 pointer-events-none absolute inset-x-0 bottom-0 h-8 overflow-hidden" aria-hidden="true">
              <PixelBlast color="#f97316" pixelSize={4} />
            </div>
            <div className="pointer-events-none absolute inset-y-8 -left-8 w-8 overflow-hidden" aria-hidden="true">
              <PixelBlast color="#f97316" pixelSize={4} />
            </div>
            <div className="pointer-events-none absolute inset-y-8 -right-8 w-8 overflow-hidden" aria-hidden="true">
              <PixelBlast color="#f97316" pixelSize={4} />
            </div>

            <div className="px-4 py-16 text-center sm:py-20">
              <div className="mx-auto max-w-lg space-y-6">
                <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">
                  Your interview prep shouldn&apos;t rely on memory alone.
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Start logging problems. The system handles the rest.
                </p>
                {session?.user ? (
                  <Link
                    href="/today"
                    className="pressable inline-flex items-center justify-center gap-2 border border-orange-500 bg-orange-500 px-6 py-2.5 text-sm text-white hover:bg-orange-600"
                  >
                    Open your queue
                  </Link>
                ) : (
                  <Link
                    href="/auth/signin"
                    className="pressable inline-flex items-center justify-center gap-2 border border-orange-500 bg-orange-500 px-6 py-2.5 text-sm text-white hover:bg-orange-600"
                  >
                    Get started
                  </Link>
                )}
              </div>
            </div>
          </div>
        </SheetSection>
      </main>
    </div>
  );
}
