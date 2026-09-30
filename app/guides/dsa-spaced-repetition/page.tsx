import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SheetSection } from "@/components/ui/sheet-section";
import { JsonLd } from "@/components/json-ld";
import { FaqList } from "@/components/faq-list";
import { AUTHOR, GUIDE_PATH, SITE_NAME, SITE_URL } from "@/lib/site";

const TITLE = "How to Remember DSA Problems: A Spaced Repetition Guide";
const DESCRIPTION =
  "Why you forget DSA problems you've solved, and a simple spaced-repetition method to fix it: when to re-solve each problem, what to log, and how to track DSA progress.";
const PUBLISHED = "2026-09-30";
const URL = `${SITE_URL}${GUIDE_PATH}`;

export const metadata: Metadata = {
  title: { absolute: "How to Remember DSA Problems: Spaced Repetition Guide" },
  description: DESCRIPTION,
  alternates: { canonical: GUIDE_PATH },
  // A page-level openGraph replaces the inherited one, so the shared image is restated here.
  openGraph: {
    type: "article",
    url: GUIDE_PATH,
    title: TITLE,
    description: DESCRIPTION,
    publishedTime: PUBLISHED,
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/opengraph-image"] },
};

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "How often should I revise a DSA problem?",
    a: "Redo it just before you would forget it. In practice that means a short gap after a struggle (a day or two), then longer gaps each time you solve it cleanly: about a week, then a few weeks, then a couple of months. A spaced-repetition scheduler such as FSRS works out these gaps for each problem from your own results.",
  },
  {
    q: "Should I re-solve the problem or just re-read my solution?",
    a: "Re-solve it from a blank editor. Re-reading feels productive because the solution looks familiar, but recognizing an answer is much easier than producing one, and interviews test producing it. For problems you already know well, a quick recall check (state the approach in a sentence or two, then check your notes) is a good lighter review.",
  },
  {
    q: "How many DSA problems should I revise per day?",
    a: "Keep it small enough to do every day: one or two full re-solves plus a few quick recall checks is sustainable for most people alongside new problems. Consistency matters more than volume, because the schedule only works if due reviews actually get done.",
  },
  {
    q: "What is the best way to track DSA progress?",
    a: "Keep a single DSA log of every problem you solve, from any platform, with the date, how it went, the core idea and your mistakes, and let a spaced-repetition schedule decide what to revise each day. A plain list shows how much you have done; a schedule also shows what you are about to forget.",
  },
  {
    q: "What should I write down after solving a problem?",
    a: "Two things: the core idea in one or two sentences (the insight that unlocks the problem, not the code), and the mistakes you made. Those notes are what you check against during a review, and the mistake log is what stops you repeating the same bug.",
  },
  {
    q: "I have already solved hundreds of problems. Where do I start?",
    a: "Import them and spread the first revisions over several weeks rather than all at once. Hash-It does this automatically: whether you import a DSA sheet or your LeetCode history, first revisions are spread over 60 days.",
  },
];

const STRUCTURED_DATA = [
  {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: TITLE,
    description: DESCRIPTION,
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    mainEntityOfPage: URL,
    url: URL,
    image: `${SITE_URL}/opengraph-image`,
    author: { "@type": "Person", name: AUTHOR.name, alternateName: AUTHOR.handle, url: AUTHOR.url },
    publisher: { "@type": "Organization", name: SITE_NAME, url: `${SITE_URL}/` },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE_NAME, item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "DSA spaced repetition guide", item: URL },
    ],
  },
];

const SCHEDULE = [
  { outcome: "Couldn't solve it", next: "Tomorrow", after: "A few days, then about a week" },
  { outcome: "Solved with a hint", next: "In 2–3 days", after: "About a week, then a few weeks" },
  { outcome: "Solved cold", next: "In about a week", after: "A few weeks, then a couple of months" },
];

const h2 = "text-xl font-medium tracking-tight text-foreground";
const p = "text-sm leading-relaxed text-muted-foreground sm:text-[15px]";
const inlineLink = "border-b border-orange-500 pb-0.5 text-orange-600 transition-colors hover:text-orange-700";

export default function DsaSpacedRepetitionGuide() {
  return (
    <article>
      <JsonLd data={STRUCTURED_DATA} />

      <SheetSection innerClassName="py-12 sm:py-16">
        <div className="mx-auto max-w-2xl space-y-5">
          <nav aria-label="Breadcrumb" className="type-caption">
            <Link href="/" className="hover:text-foreground">
              {SITE_NAME}
            </Link>{" "}
            / Guide
          </nav>
          <h1 className="text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            How to remember DSA problems
          </h1>
          <p className="text-base leading-relaxed text-foreground">
            You forget DSA problems because you solve each one once and never have to produce it
            again. It doesn&apos;t matter whether you practice on LeetCode, GeeksforGeeks or from a
            DSA sheet. The fix is spaced repetition: re-solve each problem from scratch at growing
            intervals (a day, a few days, a week, a month), each timed for just before you would
            forget it.
          </p>
          <p className="type-caption">
            By{" "}
            <a href={AUTHOR.url} className="hover:text-foreground" rel="author">
              {AUTHOR.name}
            </a>{" "}
            · <time dateTime={PUBLISHED}>September 30, 2026</time>
          </p>
        </div>
      </SheetSection>

      <SheetSection innerClassName="py-10" band="neutral">
        <div className="mx-auto max-w-2xl space-y-10">
          <section className="space-y-3">
            <h2 className={h2}>Why you forget solutions you understood</h2>
            <p className={p}>
              Memory fades on a curve: sharply at first, then more slowly. A DSA problem you solved
              last week feels familiar, but familiarity is recognition, and an interview asks for recall:
              producing the approach on a blank screen, under time pressure. Reading the editorial
              again rebuilds recognition. Only retrieving the idea yourself strengthens recall.
            </p>
            <p className={p}>
              Each successful retrieval also slows the next round of forgetting. That&apos;s why the
              gaps between reviews can keep growing, and why a problem you&apos;ve re-solved three or
              four times tends to stay with you for months.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className={h2}>A DSA revision method in five steps</h2>
            <ol className="list-inside list-decimal space-y-2.5 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
              <li>
                <span className="font-medium text-foreground">Solve it with a time box.</span> Around
                20 minutes for an easy, 40 for a medium and 60 for a hard is a reasonable starting
                point. Past that, read a hint and note that you needed one.
              </li>
              <li>
                <span className="font-medium text-foreground">Write down the core idea.</span> One or
                two sentences on the insight that unlocks the problem, not the code. Add what went
                wrong.
              </li>
              <li>
                <span className="font-medium text-foreground">Rate it honestly.</span> Solved cold,
                solved with a hint, or couldn&apos;t solve it. This one rating decides when you see it
                again.
              </li>
              <li>
                <span className="font-medium text-foreground">Re-solve it when it&apos;s due.</span>{" "}
                From a blank editor, without looking at your old code. Check your notes afterwards,
                not before.
              </li>
              <li>
                <span className="font-medium text-foreground">Let the gaps grow.</span> Each clean
                re-solve pushes the next review further out. A failure brings it back soon, which is
                exactly where it should be.
              </li>
            </ol>
          </section>

          <section className="space-y-3">
            <h2 className={h2}>How often should you revise a DSA problem?</h2>
            <p className={p}>
              It depends on how the last attempt went. A typical progression looks like this; a
              scheduler adjusts the exact days per problem from your own history.
            </p>
            <div className="overflow-x-auto border border-border bg-background">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="bg-muted/40 type-label">
                  <tr>
                    <th scope="col" className="p-3 font-medium">Last attempt</th>
                    <th scope="col" className="p-3 font-medium">Next review</th>
                    <th scope="col" className="p-3 font-medium">If it goes well after that</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {SCHEDULE.map((row) => (
                    <tr key={row.outcome}>
                      <th scope="row" className="p-3 font-medium text-foreground">{row.outcome}</th>
                      <td className="p-3 text-muted-foreground">{row.next}</td>
                      <td className="p-3 text-muted-foreground">{row.after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="type-caption">Illustrative intervals. Actual gaps vary per problem and per person.</p>
          </section>

          <section className="space-y-3">
            <h2 className={h2}>What to write in your notes</h2>
            <p className={p}>
              Your DSA log only needs two notes per problem, short enough to check in under a minute.
              For LRU Cache (LeetCode 146), for example:
            </p>
            <div className="divide-y divide-border border border-border bg-background text-sm">
              <div className="grid grid-cols-1 gap-1 p-4 sm:grid-cols-[110px_1fr] sm:gap-6">
                <div className="type-label">Core idea</div>
                <div className="leading-relaxed text-foreground">
                  A doubly linked list keeps recency order; a hash map points to its nodes for O(1)
                  lookup, move and delete.
                </div>
              </div>
              <div className="grid grid-cols-1 gap-1 p-4 sm:grid-cols-[110px_1fr] sm:gap-6">
                <div className="type-label">Mistakes</div>
                <div className="leading-relaxed text-foreground">
                  Forgot to delete the evicted key from the map. Didn&apos;t move a node to the front
                  on <code className="font-mono text-xs">get</code>.
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className={h2}>Quick recall vs. full re-solve</h2>
            <p className={p}>
              Not every review needs code. For a problem you&apos;ve solved cleanly several times, a
              quick recall check is enough: read the title, say the approach out loud, then compare
              with your notes. That takes a few minutes. Save full re-solves, about 25 minutes each,
              for problems you struggled with or haven&apos;t coded in a long time.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className={h2}>Where DSA sheets fit in</h2>
            <p className={p}>
              DSA sheets, and LeetCode lists like NeetCode 150, Blind 75 and Grind 75, answer{" "}
              <em>what to solve first</em>. Spaced repetition answers <em>what to solve again</em>.
              Use a sheet to choose new problems, and let the revision schedule decide when each one
              you&apos;ve done comes back.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className={h2}>One DSA log across every platform</h2>
            <p className={p}>
              Most people practice in more than one place: LeetCode for interview problems,
              GeeksforGeeks for concepts, a course or a DSA sheet on the side. Keep one DSA log
              across all of them, so a single schedule decides what to revise each day instead of
              one tracker per platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className={h2}>Why a spreadsheet isn&apos;t enough</h2>
            <p className={p}>
              A DSA tracking spreadsheet records what you&apos;ve done, but it can&apos;t tell you
              what you&apos;re about to forget. Working out due dates by hand for a few hundred problems
              is where most tracking sheets get abandoned. A scheduler does that part for you.
            </p>
          </section>
        </div>
      </SheetSection>

      <SheetSection innerClassName="py-10">
        <div className="mx-auto max-w-2xl space-y-4">
          <h2 className={h2}>Doing this with {SITE_NAME}</h2>
          <p className={p}>
            {SITE_NAME} is a DSA tracker built around this method. Press ⌘K after solving a problem
            to log the time, core idea and mistakes. It schedules each review with FSRS and
            builds a daily queue split into quick recalls and full re-solves. Already solved a lot?
            Upload your DSA sheet as a CSV or Excel file, or import your history from a screenshot of
            your LeetCode progress page.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <Link
              href="/auth/signin"
              className="pressable inline-flex items-center justify-center border border-orange-500 bg-orange-500 px-5 py-2 text-sm text-white hover:bg-orange-600"
            >
              Start tracking
            </Link>
            <Link href="/" className={`text-sm ${inlineLink}`}>
              See how it works
            </Link>
          </div>
        </div>
      </SheetSection>

      <SheetSection innerClassName="py-10" band="neutral">
        <div className="mx-auto max-w-2xl space-y-5">
          <h2 className={h2}>Frequently asked questions</h2>
          <FaqList items={FAQ} />
        </div>
      </SheetSection>
    </article>
  );
}
