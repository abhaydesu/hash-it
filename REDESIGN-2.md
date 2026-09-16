# Hash-It Redesign Part 2: The Spec-Sheet UI

## Overview
This document summarizes the comprehensive visual overhaul of the Hash-It web application to align with its core philosophy: an instrument for measuring recall. 
We discarded generic rounded cards, colorful "dashboard" themes, and bubbly buttons in favor of a stark, structured, and precise "spec-sheet" or technical drawing identity.

## Changes Implemented

### 1. Unified Identity and Primitives
- **CSS Variables & Theming:** Moved away from hardcoded `emerald`, `zinc`, `rose` tailwind colors. Introduced a strict semantic variable system (`border`, `background`, `foreground`, `muted`, `easy`, `medium`, `hard`, `warning`, `destructive`, `recall`).
- **Primitives (`components/ui`):** Built a unified set of `Button`, `Badge`, `Input`, and `Select` components that mandate zero border-radius (`rounded-none`) and rely purely on hairline borders (`border-border`) and muted transitions.
- **Spec-Sheet Components:** Introduced `SpecGrid` and `SpecCell` for rendering metadata (metrics, colophons, stats) into rigid technical drafting grids.
- **Typography:**
  - Removed all `SNAKE_CASE` or `ALL_CAPS` usage in headings, converting them to clean Sentence-case.
  - Reserved `font-mono` exclusively for data tags, code invariants, and metadata labels.
  - Used `tabular-nums` for precise alignment of times, rates, and scores.

### 2. Core Pages Redesigned
All pages were systematically stripped of floating containers, soft shadows, and rounded edges. They now utilize full-bleed horizontal hairlines and strict central columns.

- **`/today`**: Refactored the daily review queue. Removed all rounded borders and implemented the `SpecGrid` for the daily metric breakdown (To Do, Overdue, Learned).
- **`/problems` & `/patterns`**: Upgraded data grids. Removed legacy visual clutter and applied consistent spacing with semantic hover effects.
- **`/import`**: Rebuilt the CSV import workflow. Replaced the colorful progress steps and alert banners with precise spec-sheet blocks. Duplicate resolution is now nested inside sharp hairline panels.
- **`/stats`**: Transformed the performance metrics dashboard from a collection of colorful bubbles into a structured data report. Used the `SpecGrid` to represent the top-level metrics like Cold-Solve Rate and Lapse Rate.
- **`/review/monthly`**: Transformed the blind mock assessment into a rigorous, timed technical stress-test view. The layout forces a strict focus on the problem at hand without any visual "gameification".
- **`/auth/signin`**: Completely stripped the rounded gradient box. The sign-in page is now an austere, functional entry point reflecting the serious nature of the tool.
- **`/settings`**: Refactored the form layout into a series of technical configuration panels separated by `divide-y divide-border`.

### 3. Landing Page (`app/page.tsx`)
Rebuilt from scratch to demonstrate the system's value without jargon.
- Added a static render of the daily review queue using the exact spec-sheet styling (Fig. 1).
- Explains the FSRS algorithm using clear outcome multipliers inside a rigid data table.
- Emphasizes the "Three Checks" (Daily Resolves, Weekly Pattern Drill, Monthly Blind Mock).
- Demonstrates what an ideal entry looks like (Core Idea & Mistake Log) using a static mockup (Fig 2).

## Conclusion
The visual language now perfectly matches Hash-It's utility. The system feels less like another gamified consumer app and more like a precise cognitive instrument. By stripping away decorative color and soft shapes, the interface defers entirely to the user's data and performance metrics.
