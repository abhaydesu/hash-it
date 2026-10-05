"use client";

import { useState, useEffect, useRef } from "react";

const cadences = ["Daily", "Weekly", "Monthly"] as const;
type Cadence = (typeof cadences)[number];

const queueItems = [
  { number: 146, title: "LRU Cache", pattern: "Design", due: "Today" },
  { number: 3, title: "Longest Substring Without Repeating Characters", pattern: "Sliding Window", due: "Today" },
  { number: 200, title: "Number of Islands", pattern: "Graph", due: "Tomorrow" },
];

function DailyPreview() {
  return (
    <div className="divide-y divide-border">
      <div className="flex items-center justify-between px-4 py-3 sm:px-5">
        <div>
          <p className="text-sm font-medium">Due for review</p>
          <p className="mt-1 text-xs text-muted-foreground">Your next problems, in order</p>
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">2 today</span>
      </div>
      {queueItems.map((item) => (
        <div key={item.number} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">#{item.number} · {item.title}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{item.pattern}</p>
          </div>
          <span className="text-[11px] text-muted-foreground">{item.due}</span>
        </div>
      ))}
    </div>
  );
}

function WeeklyPreview() {
  const [revealed, setRevealed] = useState(false);
  const [planned, setPlanned] = useState(false);

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Weekly review</p>
          <p className="mt-1 text-xs text-muted-foreground">Recall first, then check your notes</p>
        </div>
        <span className="text-xs text-muted-foreground">#146 · LRU Cache</span>
      </div>
      <div className="border border-border p-3 sm:p-4">
        <p className="type-label">Core idea</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {revealed
            ? "Use a hash map for O(1) lookup and a doubly linked list to keep the most recent item at the front."
            : "Try to recall the approach before revealing your saved note."}
        </p>
        <button
          type="button"
          aria-pressed={revealed}
          onClick={() => setRevealed((value) => !value)}
          className="mt-3 border-b border-foreground/40 pb-0.5 text-[11px] text-foreground transition-colors hover:border-foreground"
        >
          {revealed ? "Hide note" : "Reveal note"}
        </button>
      </div>
      <button
        type="button"
        aria-pressed={planned}
        onClick={() => setPlanned((value) => !value)}
        className={`flex w-full items-center gap-2 border px-3 py-2 text-left text-xs transition-colors ${planned ? "border-foreground text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
      >
        <span className={`flex h-4 w-4 items-center justify-center border text-[10px] ${planned ? "border-foreground" : "border-border"}`} aria-hidden="true">
          {planned ? "✓" : ""}
        </span>
        Add 3 problems to this week&apos;s plan
      </button>
    </div>
  );
}

function MonthlyPreview() {
  return (
    <div className="divide-y divide-border">
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
        <div>
          <p className="text-sm font-medium">Monthly mock</p>
          <p className="mt-1 text-xs text-muted-foreground">A timed set from your weaker patterns</p>
        </div>
        <span className="border border-border px-2 py-1 text-[11px] tabular-nums">90 min</span>
      </div>
      {[
        ["01", "Problem 01", "Unrevealed"],
        ["02", "Problem 02", "Unrevealed"],
        ["03", "Problem 03", "Unrevealed"],
        ["04", "Problem 04", "Unrevealed"],
        ["05", "Problem 05", "Unrevealed"],
      ].map(([number, pattern, state]) => (
        <div key={number} className="flex items-center justify-between px-4 py-2.5 text-xs sm:px-5">
          <span className="flex items-center gap-3">
            <span className="type-label tabular-nums">{number}</span>
            <span>{pattern}</span>
          </span>
          <span className="text-[11px] text-muted-foreground">{state}</span>
        </div>
      ))}
    </div>
  );
}

export function ReviewCadences() {
  const [selected, setSelected] = useState<Cadence>("Daily");
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const blockRefs = useRef<(HTMLDivElement | null)[]>([]);
  const programmaticScrollUntilRef = useRef(0);

  useEffect(() => {
    let rafId = 0;

    const updateActiveCadence = () => {
      rafId = 0;
      if (performance.now() < programmaticScrollUntilRef.current) return;

      const isDesktop = window.innerWidth >= 768;

      if (!isDesktop) {
        const sectionEl = sectionRef.current;
        if (!sectionEl) return;
        const sectionRect = sectionEl.getBoundingClientRect();
        // 56px matches the sticky top-14 navbar height; 440px is the mobile scroll track height
        const scrolled = 56 - sectionRect.top;
        if (scrolled < 146) {
          setSelected("Daily");
        } else if (scrolled < 293) {
          setSelected("Weekly");
        } else {
          setSelected("Monthly");
        }
        return;
      }

      const previewEl = previewRef.current;
      const blocks = blockRefs.current;
      if (!previewEl || !blocks.length) return;

      const previewRect = previewEl.getBoundingClientRect();
      const targetY = (previewRect.top + previewRect.bottom) / 2;

      let closestCadence: Cadence | null = null;
      let minDistance = Infinity;

      blocks.forEach((block, idx) => {
        if (!block) return;
        const rect = block.getBoundingClientRect();
        const blockCenter = (rect.top + rect.bottom) / 2;
        const distance = Math.abs(blockCenter - targetY);
        if (distance < minDistance) {
          minDistance = distance;
          closestCadence = cadences[idx] ?? null;
        }
      });

      if (closestCadence) {
        setSelected(closestCadence);
      }
    };

    const onScrollOrResize = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(updateActiveCadence);
    };

    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });
    updateActiveCadence();

    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const handleScrollTo = (idx: number) => {
    const cadence = cadences[idx];
    if (cadence) setSelected(cadence);
    programmaticScrollUntilRef.current = performance.now() + 650;

    const sectionEl = sectionRef.current;
    if (!sectionEl) return;

    const sectionTop = sectionEl.getBoundingClientRect().top + window.scrollY;
    const isDesktop = window.innerWidth >= 768;

    if (!isDesktop) {
      window.scrollTo({
        top: sectionTop - 56 + idx * 220,
        behavior: "smooth",
      });
      return;
    }

    const firstBlock = blockRefs.current[0];
    const targetBlock = blockRefs.current[idx];

    if (firstBlock && targetBlock) {
      const delta = targetBlock.offsetTop - firstBlock.offsetTop;
      // 56px matches the sticky top-14 navbar height
      window.scrollTo({
        top: sectionTop - 56 + delta,
        behavior: "smooth",
      });
    } else {
      targetBlock?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const cadenceCopy = {
    Daily: {
      interval: "Every day",
      title: "Re-solve what is due",
      description: "Work through problems as they begin to fade. Your next reviews are already in order.",
    },
    Weekly: {
      interval: "Every week",
      title: "Recall, then review",
      description: "Test what you remember before revealing your notes, then choose problems for the week ahead.",
    },
    Monthly: {
      interval: "End of the month",
      title: "Measure your progress",
      description: "Take a timed, blind set drawn from your weaker patterns and compare your results over time.",
    },
  } satisfies Record<Cadence, { interval: string; title: string; description: string }>;

  return (
    <div ref={sectionRef} className="relative">
      <div className="sticky top-14 z-20 pointer-events-none">
        <header className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-6 py-5 sm:gap-6 sm:px-12 sm:py-6">
          <h2 className="text-base font-medium tracking-tight sm:text-2xl">Three review cadences</h2>
          <div className="flex items-center gap-1.5" role="group" aria-label="Choose a review cadence">
            {cadences.map((cadence, idx) => (
              <button
                key={cadence}
                type="button"
                aria-pressed={selected === cadence}
                onClick={() => handleScrollTo(idx)}
                className={`border px-3 py-1.5 text-xs transition-colors motion-reduce:transition-none sm:px-4 ${
                  selected === cadence
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                }`}
              >
                {cadence}
              </button>
            ))}
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="pointer-events-auto border-b border-border bg-background bg-dither-25 p-6 sm:p-12 md:border-b-0 md:bg-transparent md:bg-none">
            <div
              ref={previewRef}
              className="relative h-[280px] overflow-hidden border border-border bg-background shadow-xs"
              aria-live="polite"
            >
              {cadences.map((cadence) => (
                <div
                  key={cadence}
                  className="absolute inset-0 h-full w-full"
                  style={{
                    opacity: selected === cadence ? 1 : 0,
                    transition: "opacity 500ms var(--ease-morph), transform 500ms var(--ease-morph)",
                    transform: selected === cadence ? "scale(1)" : "scale(1.02)",
                    pointerEvents: selected === cadence ? "auto" : "none",
                  }}
                >
                  {cadence === "Daily" && <DailyPreview />}
                  {cadence === "Weekly" && <WeeklyPreview />}
                  {cadence === "Monthly" && <MonthlyPreview />}
                </div>
              ))}
            </div>
          </div>

          {/* Mobile-only cadence text panel inside the sticky stage */}
          <div
            className="pointer-events-auto relative h-[160px] overflow-hidden bg-background md:hidden"
            aria-hidden="true"
          >
            {cadences.map((cadence) => (
              <div
                key={`mobile-text-${cadence}`}
                className="absolute inset-0 flex flex-col justify-center space-y-2 px-8 py-5 sm:px-12"
                style={{
                  opacity: selected === cadence ? 1 : 0,
                  transform: selected === cadence ? "translateY(0)" : "translateY(6px)",
                  transition: "opacity 400ms var(--ease-morph), transform 400ms var(--ease-morph)",
                  pointerEvents: selected === cadence ? "auto" : "none",
                }}
              >
                <p className="type-label text-orange-600">{cadenceCopy[cadence].interval}</p>
                <h3 className="text-base font-medium tracking-tight sm:text-lg">
                  {cadenceCopy[cadence].title}
                </h3>
                <p className="max-w-sm text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {cadenceCopy[cadence].description}
                </p>
              </div>
            ))}
          </div>

          <div className="hidden md:block" aria-hidden="true" />
        </div>
      </div>

      {/* Mobile scroll track */}
      <div className="h-[440px] md:hidden" aria-hidden="true" />

      {/* Desktop 2-column scroll track */}
      <div className="hidden md:-mt-[376px] md:grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] md:divide-x md:divide-border">
        <div className="bg-dither-25" aria-hidden="true" />
        <div className="flex flex-col px-8 py-10 sm:px-12 sm:py-12">
          {cadences.map((cadence, idx) => (
            <div
              key={`text-${cadence}`}
              data-cadence={cadence}
              ref={(el) => {
                blockRefs.current[idx] = el;
              }}
              className="flex min-h-[280px] flex-col justify-center space-y-3 py-8"
              style={{
                opacity: selected === cadence ? 1 : 0.35,
                transition: "opacity 400ms var(--ease-morph)",
              }}
            >
              <p className="type-label text-orange-600">{cadenceCopy[cadence].interval}</p>
              <h3 className="text-xl font-medium tracking-tight">{cadenceCopy[cadence].title}</h3>
              <p className="max-w-md text-base leading-relaxed text-muted-foreground">
                {cadenceCopy[cadence].description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const importSources = ["Screenshot", "Spreadsheet", "CSV"] as const;
type ImportSource = (typeof importSources)[number];

function ScreenshotPreview() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] h-full">
      <div className="border border-border p-4">
        <div className="flex items-center justify-between border-b border-border pb-2.5">
          <span className="text-[11px] font-medium">LeetCode · Solved</span>
          <span className="type-label">Progress</span>
        </div>
        <div className="mt-4 flex h-24 items-end gap-1 border-b border-border px-2">
          {[20, 31, 25, 43, 35, 55, 47, 65, 53, 78, 60, 84].map((height, index) => (
            <span key={index} className="flex-1 bg-foreground/15" style={{ height }} />
          ))}
        </div>
        <p className="mt-2.5 text-[10px] text-muted-foreground">Accepted problems over time</p>
      </div>
      <div className="space-y-2.5 self-center">
        <p className="type-label">Matched problems</p>
        {[
          ["146", "LRU Cache"],
          ["3", "Longest Substring…"],
          ["200", "Number of Islands"],
        ].map(([number, title]) => (
          <div key={number} className="flex items-center gap-3 border-b border-border py-2.5 text-[11px]">
            <span className="tabular-nums text-muted-foreground">#{number}</span>
            <span className="truncate">{title}</span>
            <span className="ml-auto text-muted-foreground">Matched</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpreadsheetPreview() {
  const rows = [
    ["146", "LRU Cache", "Design"],
    ["3", "Longest Substring", "Sliding Window"],
    ["200", "Number of Islands", "Graph"],
  ];
  return (
    <div className="overflow-x-auto h-full flex items-center">
      <table className="w-full min-w-[430px] border-collapse text-left text-[11px]">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            {["Problem", "Title", "Pattern", "Time"].map((heading) => (
              <th key={heading} className="px-4 py-3 font-normal">{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([number, title, pattern], index) => (
            <tr key={number} className="border-b border-border last:border-0">
              <td className="px-4 py-3.5 tabular-nums text-muted-foreground">#{number}</td>
              <td className="px-4 py-3.5">{title}</td>
              <td className="px-4 py-3.5 text-muted-foreground">{pattern}</td>
              <td className="px-4 py-3.5 text-muted-foreground">{["42m", "28m", "35m"][index]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CsvPreview() {
  return (
    <div className="overflow-x-auto p-6 sm:p-8 h-full flex flex-col justify-center">
      <p className="mb-3.5 type-label">problems.csv</p>
      <pre className="min-w-[430px] overflow-hidden text-[11px] leading-8 text-muted-foreground"><span className="text-foreground">number,title,pattern,time</span>{"\n146,LRU Cache,Design,42\n3,Longest Substring,Sliding Window,28\n200,Number of Islands,Graph,35"}</pre>
    </div>
  );
}

export function ImportSources() {
  const [selected, setSelected] = useState<ImportSource>("Screenshot");
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => {
      setSelected((curr) => {
        const idx = importSources.indexOf(curr);
        return importSources[(idx + 1) % importSources.length];
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [isHovered]);

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-background px-8 py-4 sm:px-12">
        <span className="type-label py-1">Supported formats</span>
        <div className="flex items-center gap-2" role="group" aria-label="Choose an import source">
          {importSources.map((source) => (
            <button
              key={source}
              type="button"
              aria-pressed={selected === source}
              onClick={() => setSelected(source)}
              className={`border-b-2 px-3.5 py-2 text-xs transition-colors motion-reduce:transition-none ${selected === source ? "border-orange-500 text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {source}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-dither-25 p-8 sm:p-12 lg:p-16">
        <div className="relative min-h-64 overflow-hidden border border-border bg-background shadow-xs" aria-live="polite">
          {importSources.map((source) => (
            <div 
              key={source} 
              className="absolute inset-0 h-full w-full p-6 sm:p-8"
              style={{ 
                opacity: selected === source ? 1 : 0, 
                transition: 'opacity 600ms var(--ease-morph), transform 600ms var(--ease-morph)',
                transform: selected === source ? 'scale(1)' : 'scale(1.02)',
                pointerEvents: selected === source ? 'auto' : 'none'
              }}
            >
              {source === "Screenshot" && <ScreenshotPreview />}
              {source === "Spreadsheet" && <SpreadsheetPreview />}
              {source === "CSV" && <CsvPreview />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PracticePatternsGrid() {
  const patterns = [
    { name: "Two Pointers", count: 18 },
    { name: "Sliding Window", count: 12 },
    { name: "Binary Search", count: 24 },
    { name: "Dynamic Prog.", count: 42 },
    { name: "BFS / DFS", count: 31 },
    { name: "Backtracking", count: 15 },
    { name: "Greedy", count: 22 },
    { name: "Stack / Queue", count: 19 },
  ];

  const handleHover = (index: number) => {
    const iframe = document.getElementById('practice-patterns-iframe') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ hoverPattern: index }, '*');
    }
  };

  return (
    <div className="grid h-full w-full grid-cols-2 gap-px bg-border sm:grid-cols-[1.12fr_1fr_1fr_1fr]">
      {patterns.map((p, i) => {
        const isLeftColMobile = i % 2 === 0;
        const isLeftColSm = i % 4 === 0;
        return (
          <div
            key={p.name}
            onMouseEnter={() => handleHover(i)}
            onMouseLeave={() => handleHover(-1)}
            className={`flex min-h-36 flex-col justify-between bg-background py-6 pr-5 text-left transition-colors hover:bg-muted/15 ${
              isLeftColMobile ? "pl-8" : "pl-5"
            } ${isLeftColSm ? "sm:pl-12" : "sm:pl-5"}`}
          >
            <span className="type-label">Pattern</span>
            <span className="text-sm font-medium text-foreground">{p.name}</span>
            <span className="mt-3 text-xs tabular-nums text-muted-foreground">
              {p.count} problems
            </span>
          </div>
        );
      })}
    </div>
  );
}
