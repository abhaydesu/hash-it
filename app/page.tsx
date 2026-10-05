import React from 'react';
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { SheetSection } from "@/components/ui/sheet-section";
import { FigureCaption } from "@/components/ui/spec-sheet";
import { PixelBlast } from "@/components/ui/pixel-blast";
import { ForgettingCurveGraph } from "@/components/ui/forgetting-curve";
import { HeroDemo } from "@/components/hero-demo";
import { ShortcutKeycaps } from "@/components/ui/keycap-hint";
import { ImportSources, ReviewCadences, PracticePatternsGrid } from "@/components/landing/landing-interactions";
import { HairlineFigure } from "@/components/landing/hairline-figure";
import { JsonLd } from "@/components/json-ld";
import { FaqList } from "@/components/faq-list";
import { AUTHOR, GUIDE_PATH, LANDING_FAQ, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  // A page-level openGraph replaces the root one, so restate the fields it would drop.
  openGraph: { type: "website", url: "/", siteName: SITE_NAME, title: SITE_TITLE, description: SITE_DESCRIPTION },
};

const STRUCTURED_DATA = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: ["HashIt", "Hash It", "Hash-It DSA tracker"],
    url: `${SITE_URL}/`,
    description: SITE_DESCRIPTION,
  },
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    description: SITE_DESCRIPTION,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    browserRequirements: "Requires a modern web browser and a Google account.",
    featureList: [
      "DSA log: record LeetCode, GeeksforGeeks or any data structures and algorithms problem with time, core idea and mistakes",
      "FSRS spaced-repetition review schedule",
      "Daily review queue with quick recall and full re-solve lanes",
      "Import LeetCode history from a screenshot, or a DSA sheet from CSV or Excel",
      "Practice unsolved problems by pattern",
      "Weekly review and monthly timed mock",
      "Stats, streaks and weakest-pattern tracking",
    ],
    author: { "@type": "Person", name: AUTHOR.name, alternateName: AUTHOR.handle, url: AUTHOR.url },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: LANDING_FAQ.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  },
];

// Signed-in visitors are redirected to /today by middleware, so this page is always the logged-out view.
export default function HomePage() {
  return (
    <div className="relative flex min-h-screen w-full justify-center bg-background font-sans text-foreground selection:bg-foreground selection:text-background">
      <main className="min-h-screen w-full">
        <JsonLd data={STRUCTURED_DATA} />

        {/* ── Hero ── */}
        <SheetSection className="relative" band="hero" flush>
          <div className="relative z-10 flex max-w-3xl flex-col items-start px-6 py-20 sm:px-12 sm:py-32">
            <p className="type-label mb-5 text-orange-600">LeetCode &amp; DSA tracker · Spaced repetition</p>
            <h1 className="idea-preview mb-6 text-3xl font-medium tracking-tight sm:text-5xl md:text-6xl">
              Remember every problem you solve.
            </h1>
            <p className="mb-10 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Hash-It is a LeetCode and DSA tracker that uses spaced repetition to schedule your
              revision. You re-solve what&apos;s fading, skip what&apos;s locked in.
            </p>

            <Link
              href="/auth/signin"
              className="pressable inline-flex items-center justify-center gap-2 border border-orange-500 bg-orange-500 px-7 py-3 text-sm font-medium text-white shadow-sm hover:bg-orange-600"
            >
              Get started
            </Link>
          </div>

          <div className="relative border-t border-border bg-dither-25 px-6 py-10 sm:px-12 sm:py-16">
            <div className="stagger-in mx-auto max-w-4xl">
              <HeroDemo />
            </div>
          </div>
        </SheetSection>

        {/* ── Problem / Solution ── */}
        <SheetSection band="stripe" flush>
          <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
            <div className="p-8 sm:p-12 lg:p-16">
              <p className="type-label mb-3">The problem</p>
              <h2 className="mb-4 text-xl font-medium tracking-tight">Why spreadsheets fail</h2>
              <p className="max-w-md text-base leading-relaxed text-muted-foreground">
                You mark a problem green, but a month later the core idea is gone. A spreadsheet
                tracks what you&apos;ve done. It can&apos;t tell you what you&apos;re about to forget.
              </p>
            </div>
            <div className="bg-muted/5 p-8 sm:p-12 lg:p-16">
              <p className="type-label mb-3 text-orange-600">The system</p>
              <h2 className="mb-4 text-xl font-medium tracking-tight">Log once, review forever</h2>
              <p className="max-w-md text-base leading-relaxed text-muted-foreground">
                Hit{" "}
                <ShortcutKeycaps className="align-middle" />{" "}
                to log a problem. Record the time, the core idea, and any mistakes. The next review
                is scheduled automatically based on how you performed.
              </p>
            </div>
          </div>
        </SheetSection>

        {/* ── How it works ── */}
        <SheetSection band="neutral" flush>
          <header className="border-b border-border px-8 py-8 sm:px-12 sm:py-10">
            <h2 className="text-2xl font-medium tracking-tight">How it works</h2>
            <p className="mt-2 max-w-xl text-base leading-relaxed text-muted-foreground">
              Three steps from your first solve on LeetCode to long-term retention.
            </p>
          </header>

          <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
            <div className="divide-y divide-border stagger-in">
              {/* Step 1 */}
              <div className="space-y-3 p-8 sm:p-10 lg:p-12">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-orange-500 text-[11px] font-semibold text-orange-600">
                    1
                  </span>
                  <h3 className="text-base font-medium">Solve and log</h3>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Solve a problem on LeetCode. Log the time, the core insight, and what tripped you up.
                </p>
              </div>

              {/* Step 2 */}
              <div className="space-y-3 p-8 sm:p-10 lg:p-12">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-orange-500 text-[11px] font-semibold text-orange-600">
                    2
                  </span>
                  <h3 className="text-base font-medium">System schedules</h3>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  FSRS picks the exact day you&apos;d forget. It reappears in your queue. No manual scheduling.
                </p>
              </div>

              {/* Step 3 */}
              <div className="space-y-3 p-8 sm:p-10 lg:p-12">
                <div className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-orange-500 text-[11px] font-semibold text-orange-600">
                    3
                  </span>
                  <h3 className="text-base font-medium">Re-solve and grow</h3>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Each review strengthens the memory. Intervals stretch. You stop forgetting what you&apos;ve learned.
                </p>
              </div>
            </div>

            <div className="flex flex-col justify-between bg-dither-25">
              <div className="flex flex-1 items-center justify-center p-6 sm:p-10 lg:p-12">
                <div className="w-full border border-border bg-background p-4 sm:p-6 shadow-xs">
                  <HairlineFigure
                    page="hairline-review-queue.html"
                    title="Interactive review queue mechanics"
                  />
                </div>
              </div>
              <div className="border-t border-border px-8 py-4 sm:px-12">
                <FigureCaption
                  fig={1}
                  title="Cards move through your queue and return at widening intervals."
                  className="mt-0"
                />
              </div>
            </div>
          </div>
        </SheetSection>

        {/* ── Forgetting curve ── */}
        <SheetSection band="stripe" flush>
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-8 py-8 sm:px-12 sm:py-10">
            <div>
              <h2 className="text-2xl font-medium tracking-tight">
                Spaced repetition, not guesswork
              </h2>
              <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
                FSRS calculates when you&apos;re about to forget each problem. You spend time on what&apos;s fading, never on what you already know.
              </p>
            </div>
            <a
              href="https://github.com/open-spaced-repetition/fsrs4anki"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 border-b border-orange-500 pb-0.5 text-xs text-orange-600 transition-colors hover:text-orange-700"
            >
              Read about FSRS
              <ExternalLink className="h-3 w-3" />
            </a>
          </header>

          <div className="bg-dither-25 p-8 sm:p-12 lg:p-16">
            <div className="mx-auto max-w-4xl border border-border bg-background p-6 sm:p-10 shadow-xs">
              <ForgettingCurveGraph />
            </div>
          </div>

          <div className="border-t border-border px-8 py-4 sm:px-12">
            <FigureCaption
              fig={2}
              title="Without review, recall drops to near zero. Spaced reviews keep it high with widening intervals."
              className="mt-0"
            />
          </div>
        </SheetSection>

        {/* ── Three cadences ── */}
        <SheetSection band="neutral" flush>
          <ReviewCadences />
        </SheetSection>

        {/* ── Entry example ── */}
        <SheetSection band="stripe" flush>
          <header className="border-b border-border px-8 py-8 sm:px-12 sm:py-10">
            <h2 className="text-2xl font-medium tracking-tight">What an entry looks like</h2>
            <p className="mt-2 max-w-xl text-base leading-relaxed text-muted-foreground">
              Every logged problem records the core insight and the exact mistakes that cost you time.
            </p>
          </header>

          <div className="bg-dither-25 p-8 sm:p-12 lg:p-16">
            <div className="mx-auto max-w-3xl divide-y divide-border border border-border bg-background text-sm shadow-xs">
              <div className="p-6 sm:p-8">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-base font-medium">#146. LRU Cache</span>
                  <span className="border border-hard/35 px-2 py-0.5 text-[11px] text-hard">
                    Hard
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 type-caption">
                  <span className="border border-border px-2 py-1">Hash Table</span>
                  <span className="border border-border px-2 py-1">Linked List</span>
                  <span className="border border-border px-2 py-1">Design</span>
                </div>
              </div>
              <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-[160px_1fr] sm:divide-x sm:divide-y-0">
                <div className="bg-muted/5 px-6 py-5 type-label sm:px-8">Core idea</div>
                <div className="px-6 py-5 leading-relaxed text-foreground sm:px-8">
                  Keep a doubly linked list for the recent items, and a hash map pointing to the list
                  nodes for O(1) access.
                </div>
              </div>
              <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-[160px_1fr] sm:divide-x sm:divide-y-0">
                <div className="bg-muted/5 px-6 py-5 type-label sm:px-8">Mistake log</div>
                <div className="px-6 py-5 leading-relaxed text-foreground sm:px-8">
                  <ul className="list-inside list-disc space-y-1.5">
                    <li>Forgot to remove the tail when capacity is reached.</li>
                    <li>Didn&apos;t update the hash map when moving a node to the head.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border px-8 py-4 sm:px-12">
            <FigureCaption
              fig={3}
              title="Each entry captures the idea and mistakes, not just the solve."
              className="mt-0"
            />
          </div>
        </SheetSection>

        {/* ── Practice preview ── */}
        <SheetSection band="neutral" flush>
          <header className="border-b border-border px-8 py-8 sm:px-12 sm:py-10">
            <h2 className="text-2xl font-medium tracking-tight">Targeted practice by pattern</h2>
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
              Pick a pattern, get an easy&ndash;medium&ndash;hard set of problems you
              haven&apos;t solved yet. Shuffle until you find ones that challenge you, then
              log your attempt.
            </p>
          </header>

          <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:divide-x md:divide-y-0">
            <PracticePatternsGrid />
            <div className="flex items-center justify-center bg-dither-25 p-6 sm:p-10 lg:p-12">
              <div className="w-full border border-border bg-background p-3 sm:p-5 shadow-xs">
                <HairlineFigure
                  id="practice-patterns-iframe"
                  page="hairline-practice-patterns.html"
                  title="Interactive pattern practice field"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border px-8 py-4 sm:px-12">
            <FigureCaption
              fig={4}
              title="Hover a pattern to inspect its cluster. Pick a pattern, get a graded problem set."
              className="mt-0"
            />
          </div>
        </SheetSection>

        {/* ── LeetCode import ── */}
        <SheetSection band="stripe" flush>
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-8 py-8 sm:px-12 sm:py-10">
            <div>
              <h2 className="text-2xl font-medium tracking-tight">Bring your LeetCode history or DSA sheet</h2>
              <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
                Already solved a few hundred? Import them from a LeetCode screenshot, or upload the
                DSA sheet you track in Excel or CSV. Reviews are spread over 60 days so day one
                isn&apos;t a wall.
              </p>
            </div>
            <Link
              href="/auth/signin?callbackUrl=%2Fimport"
              className="inline-flex items-center gap-1.5 border-b border-orange-500 pb-0.5 text-xs text-orange-600 transition-colors hover:text-orange-700"
            >
              Import your problems
            </Link>
          </header>
          <ImportSources />
        </SheetSection>

        {/* ── Not Anki ── */}
        <SheetSection flush>
          <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
            <div className="p-8 sm:p-12 lg:p-16">
              <p className="type-label mb-3">Real practice</p>
              <h2 className="mb-4 text-xl font-medium tracking-tight">Not a flashcard app</h2>
              <p className="max-w-md text-base leading-relaxed text-muted-foreground">
                Anki reviews text. Hash-It reviews problems. You re-solve from scratch, on the
                real platform, under time pressure. The scheduling is the same science — the
                practice is real.
              </p>
            </div>
            <div className="bg-muted/5 p-8 sm:p-12 lg:p-16">
              <p className="type-label mb-3 text-orange-600">Adaptive retention</p>
              <h2 className="mb-4 text-xl font-medium tracking-tight">Not a problem list</h2>
              <p className="max-w-md text-base leading-relaxed text-muted-foreground">
                NeetCode and Grind 75 tell you what to solve first. Hash-It tells you what to
                solve again. Use any list to seed your log — the review schedule is what
                keeps it in your head.
              </p>
            </div>
          </div>
        </SheetSection>

        {/* ── Closing CTA with PixelBlast frame ── */}
        <SheetSection flush>
          <div className="relative">
            {/* PixelBlast border — all four sides */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-6 sm:h-8 overflow-hidden" aria-hidden="true">
              <PixelBlast color="#f97316" pixelSize={4} />
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 sm:h-8 overflow-hidden" aria-hidden="true">
              <PixelBlast color="#f97316" pixelSize={4} />
            </div>
            <div className="pointer-events-none absolute inset-y-6 sm:inset-y-8 left-0 w-6 sm:w-8 overflow-hidden" aria-hidden="true">
              <PixelBlast color="#f97316" pixelSize={4} />
            </div>
            <div className="pointer-events-none absolute inset-y-6 sm:inset-y-8 right-0 w-6 sm:w-8 overflow-hidden" aria-hidden="true">
              <PixelBlast color="#f97316" pixelSize={4} />
            </div>

            <div className="px-6 py-20 text-center sm:py-28">
              <div className="mx-auto max-w-xl space-y-7">
                <h2 className="text-3xl font-medium tracking-tight sm:text-4xl">
                  Your interview prep shouldn&apos;t rely on memory alone.
                </h2>
                <p className="text-base leading-relaxed text-muted-foreground">
                  Start logging problems. The system handles the rest.
                </p>
                <Link
                  href="/auth/signin"
                  className="pressable inline-flex items-center justify-center gap-2 border border-orange-500 bg-orange-500 px-7 py-3 text-sm font-medium text-white shadow-sm hover:bg-orange-600"
                >
                  Get started
                </Link>
              </div>
            </div>
          </div>
        </SheetSection>

        {/* ── FAQ (mirrored in the FAQPage structured data above) ── */}
        <SheetSection band="neutral" flush>
          <header className="border-b border-border px-8 py-8 sm:px-12 sm:py-10">
            <h2 className="text-2xl font-medium tracking-tight">Frequently asked questions about tracking DSA</h2>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">
              New to spaced repetition for DSA? Read{" "}
              <Link
                href={GUIDE_PATH}
                className="border-b border-orange-500 pb-0.5 text-orange-600 transition-colors hover:text-orange-700"
              >
                how to remember DSA problems
              </Link>
              .
            </p>
          </header>
          <FaqList items={LANDING_FAQ} flush />
        </SheetSection>
      </main>
    </div>
  );
}
