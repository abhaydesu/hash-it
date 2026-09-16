# Hash-It: Implemented Features & Technical Progress

> **Document Purpose**: This document provides a complete, exhaustive technical inventory of **everything that has already been implemented** in Hash-It. It includes all database models, API route handlers, Server Actions, frontend pages, UI components, background scripts, algorithms, and configuration requirements. It is formatted specifically to enable another LLM or DevOps engineer to deploy and operate the product.
>
> **Strict Rule**: Only implemented and functioning code is documented here.

---

## 1. System Overview & Technology Stack

**Hash-It** is a full-stack LeetCode practice log and spaced-repetition memory system. Instead of maintaining static checklist spreadsheets, Hash-It uses cognitive science principles and the **FSRS (Free Spaced Repetition Scheduler)** algorithm to compute optimal review intervals, test pattern recognition, and eliminate memory decay on algorithmic patterns.

### Core Stack
- **Framework**: Next.js 15.2+ (App Router, Server Components & Server Actions)
- **UI & Runtime**: React 19, TypeScript 5.7+
- **Database & ORM**: PostgreSQL with Prisma ORM 6.4+
- **Authentication**: NextAuth.js (Auth.js v5 beta 25) with `@auth/prisma-adapter`
- **Spaced Repetition Engine**: `ts-fsrs` 4.4+ (FSRS-6 state machine and forgetting curve calculations)
- **Styling**: TailwindCSS 3.4+, Vanilla CSS tokens, `next-themes` (Dark & Light modes), Lucide React icons
- **Data Table**: `@tanstack/react-table` 8.21+ for spreadsheet grid views
- **CSV Processing**: `papaparse` 5.5+ for dry-run verification and batch ingestion
- **Testing**: `vitest` 3.0+

---

## 2. Database Schema (`prisma/schema.prisma`)

The database is built on PostgreSQL with 11 primary models and 6 enums.

### 2.1 Enums
```prisma
enum Platform {
  LEETCODE
  GFG
  OTHER
}

enum Difficulty {
  EASY
  MEDIUM
  HARD
}

enum SolveStatus {
  SOLVED_UNAIDED
  SOLVED_WITH_HELP
  ATTEMPTED_FAILED
}

enum Rating {
  AGAIN
  HARD
  GOOD
  EASY
}

enum CardState {
  NEW
  LEARNING
  REVIEW
  RELEARNING
}

enum PatternSource {
  SHEET
  USER
}
```

### 2.2 Models & Relationships

#### 1. `Problem` (Canonical Problem Catalogue)
Stores canonical LeetCode, GeeksforGeeks, and custom problems.
- `id` (String, cuid, Primary Key)
- `platform` (`Platform` enum: LEETCODE, GFG, OTHER)
- `slug` (String)
- `number` (Int, optional, indexed)
- `title` (String)
- `url` (String)
- `difficulty` (`Difficulty` enum: EASY, MEDIUM, HARD, optional)
- `acRate` (Float, optional, acceptance rate)
- `isPaidOnly` (Boolean, default: false)
- `topicTags` (String[])
- `lastSyncedAt` (DateTime, optional)
- **Relations**: `patterns` (`ProblemPattern[]`), `entries` (`Entry[]`), `roadmapItems` (`RoadmapItem[]`)
- **Indexes**: `@@unique([platform, slug])`, `@@index([number])`

#### 2. `Pattern` (Algorithm Pattern Taxonomy)
Defines algorithmic pattern techniques and their high-level families.
- `id` (String, cuid, Primary Key)
- `name` (String, unique)
- `family` (String) - e.g., "Pointers", "Sliding & Array", "Trees & Graphs", "DP & Greedy", "Search & Math"
- `sortOrder` (Int)
- **Relations**: `problems` (`ProblemPattern[]`), `drills` (`PatternDrill[]`)

#### 3. `ProblemPattern` (Problem-to-Pattern Junction)
Many-to-many link associating canonical problems with algorithm patterns.
- `problemId` (String, Foreign Key -> `Problem.id`, onDelete: Cascade)
- `patternId` (String, Foreign Key -> `Pattern.id`, onDelete: Cascade)
- `source` (`PatternSource` enum: SHEET, USER, default: SHEET)
- **Primary Key**: `@@id([problemId, patternId])`

#### 4. `PatternDrill` (Weekly Recognition Drill History)
Logs user attempts on weekly pattern recognition cues.
- `id` (String, cuid, Primary Key)
- `userId` (String, Foreign Key -> `User.id`, onDelete: Cascade)
- `patternId` (String, Foreign Key -> `Pattern.id`, onDelete: Cascade)
- `at` (DateTime, default: now)
- `correct` (Boolean)
- **Indexes**: `@@index([userId, patternId, at])`

#### 5. `Entry` (User Practice Log Entry)
The central user record for a solved problem. Preserves all 9 spreadsheet columns and custom notes.
- `id` (String, cuid, Primary Key)
- `userId` (String, Foreign Key -> `User.id`, onDelete: Cascade)
- `problemId` (String, Foreign Key -> `Problem.id`, onDelete: Cascade)
- `status` (`SolveStatus` enum: SOLVED_UNAIDED, SOLVED_WITH_HELP, ATTEMPTED_FAILED)
- `idea` (String, optional) - Core intuition/technique
- `mistake` (String, optional) - What went wrong/trap
- `sourceList` (String, optional) - e.g. "Striver SDE", "NeetCode 150", "csv-import"
- `minutes` (Int, optional) - Time taken to solve
- `revisit` (Boolean, default: false) - Manual flag for early review
- `firstSolvedAt` (DateTime)
- `patternOverride` (String[])
- `topic` (String, optional)
- `customUrl` (String, optional)
- `customPattern` (String, optional)
- `importBatchId` (String, optional, Foreign Key -> `ImportBatch.id`, onDelete: SetNull)
- **Relations**: `attempts` (`Attempt[]`), `reviewCard` (`ReviewCard?`), `importBatch` (`ImportBatch?`)
- **Indexes**: `@@unique([userId, problemId])`, `@@index([userId])`

#### 6. `Attempt` (Historical Review Attempts)
Logs every review outcome whenever a problem is practiced.
- `id` (String, cuid, Primary Key)
- `entryId` (String, Foreign Key -> `Entry.id`, onDelete: Cascade)
- `at` (DateTime, default: now)
- `rating` (`Rating` enum: AGAIN, HARD, GOOD, EASY)
- `minutes` (Int, optional)
- `usedHint` (Boolean, default: false)
- `note` (String, optional)
- **Indexes**: `@@index([entryId])`

#### 7. `ReviewCard` (FSRS Scheduling Card)
Stores the active FSRS state vector for a problem.
- `entryId` (String, Primary Key, Foreign Key -> `Entry.id`, onDelete: Cascade)
- `due` (DateTime, indexed)
- `stability` (Float)
- `difficulty` (Float)
- `elapsedDays` (Int)
- `scheduledDays` (Int)
- `reps` (Int)
- `lapses` (Int) - Number of failed attempts (used for Leech detection $\ge 3$)
- `state` (`CardState` enum: NEW, LEARNING, REVIEW, RELEARNING)
- `lastReview` (DateTime, optional)
- **Indexes**: `@@index([due])`

#### 8. `UserSettings` (User Preferences & FSRS Configuration)
- `userId` (String, Primary Key, Foreign Key -> `User.id`, onDelete: Cascade)
- `dailyResolveCap` (Int, default: 2) - Max full re-solves per day
- `desiredRetention` (Float, default: 0.80) - Target retention ($0.70$ - $0.95$)
- `fsrsParams` (Float[]) - Custom 19-weight FSRS parameter vector
- `timezone` (String, default: "Asia/Kolkata")
- `easyBaseline` (Int, default: 15) - Minutes baseline for Easy problems
- `mediumBaseline` (Int, default: 30) - Minutes baseline for Medium problems
- `hardBaseline` (Int, default: 45) - Minutes baseline for Hard problems

#### 9. `ImportBatch` (Batch Migration Tracking)
Tracks bulk CSV imports with status and counts.
- `id` (String, cuid, Primary Key)
- `userId` (String, Foreign Key -> `User.id`, onDelete: Cascade)
- `createdAt` (DateTime, default: now)
- `filename` (String, optional)
- `entryCount` (Int)
- `status` (String, default: "COMMITTED")
- **Relations**: `entries` (`Entry[]`)
- **Indexes**: `@@index([userId])`

#### 10. `RoadmapPattern` & `RoadmapItem` (Curated Study Roadmap)
Curated DSA curriculum mapped to canonical problems with interactive completion toggles.
- `RoadmapPattern`: `id`, `name` (unique), `order`, `items` (`RoadmapItem[]`), `createdAt`
- `RoadmapItem`: `id`, `roadmapPatternId`, `title`, `primaryUrl`, `additionalUrls` (String[]), `order`, `canonicalProblemId` (optional FK -> `Problem.id`)

#### 11. NextAuth Models
- `User`: `id`, `name`, `email` (unique), `emailVerified`, `image`, `accounts`, `sessions`, `entries`, `patternDrills`, `settings`, `importBatches`
- `Account`: Provider OAuth credentials
- `Session`: Session token and expiration
- `VerificationToken`: Passwordless verification tokens

---

## 3. Authentication & Security Layer

### 3.1 Authentication Strategy (`lib/auth.ts` & `lib/local-auth.ts`)
- **Library**: `next-auth` (v5.0.0-beta.25) with `@auth/prisma-adapter`.
- **Session Strategy**: JWT (`session: { strategy: "jwt" }`).
- **Production Mode**: Requires Google OAuth (`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`).
- **Local Development Fallback**: When Google credentials are absent and `NODE_ENV !== "production"`, a `Credentials` provider is active. Developers can enter any local email/name and get an isolated user account created via `findOrCreateLocalUser`.
- **Post-Login Hook**: The `jwt` callback automatically creates a default `UserSettings` record for new users (`Asia/Kolkata`, retention 0.80, caps 2).

### 3.2 Middleware (`middleware.ts`)
- Intercepts all application requests except static assets (`_next`, `favicon.ico`, images).
- Whitelists public paths: `/`, `/auth/signin`, `/api/auth`, `/favicon.ico`.
- In production, redirects unauthenticated requests to `/auth/signin?callbackUrl=<requested-path>`.

---

## 4. Spaced Repetition (FSRS) & Algorithm Engine

### 4.1 FSRS Implementation (`lib/scheduler.ts`)
The scheduling engine uses `ts-fsrs` (v4.4.0) configured with custom parameters or the default FSRS model:

1. **Card Seeding (`seedCard`)**:
   - Initial rating derived from solve status:
     - `SOLVED_UNAIDED` $\rightarrow$ `GOOD`
     - `SOLVED_WITH_HELP` $\rightarrow$ `HARD`
     - `ATTEMPTED_FAILED` or `revisit: true` $\rightarrow$ `AGAIN`
   - Generates initial `due`, `stability`, `difficulty`, `state`, `reps`, `lapses`.

2. **Card Advancement (`advanceCard`)**:
   - Updates FSRS state vector given an `AppRating` (`AGAIN`, `HARD`, `GOOD`, `EASY`).
   - Calculates next `due` date based on the user's `desiredRetention` (default: 0.80).

3. **Rating Derivation (`deriveRating`)**:
   - Automatically derives FSRS grades from cold-solve time vs difficulty baselines:
     - Failed $\rightarrow$ `AGAIN`
     - Used Hint $\rightarrow$ `HARD`
     - Time $> 2 \times \text{baseline}$ (e.g. $>60$m on Medium) $\rightarrow$ `HARD`
     - Time $\le 0.6 \times \text{baseline}$ (e.g. $\le 18$m on Medium) $\rightarrow$ `EASY`
     - Within baseline $\rightarrow$ `GOOD`

4. **Retrievability Calculation (`calculateRetrievability`)**:
   - Implements the FSRS forgetting curve formula:
     $$R = \left(1 + \frac{19}{81} \cdot \frac{t}{S}\right)^{-0.5}$$
     where $t$ is elapsed days since last review and $S$ is stability.

5. **Leech Detection (`isLeech`)**:
   - Automatically flags a problem as a "Leech / Stuck Problem" when `lapses >= 3`.
   - Leeches pin previous mistake logs at the top of the review card during practice.

6. **Interleaved Queue Composition (`interleaveQueue`, `interleaveLane`, `deriveLane`)**:
   - Partitions due cards into two distinct lanes:
     - **`RESOLVE` Lane**: Full code implementation from scratch (capped at `dailyResolveCap`, default 2).
     - **`RECALL` Lane**: 3-minute mental intuition flashcards (capped at 6).
   - **Pattern Family Interleaving**: Sorts queue to prevent back-to-back problems from the same pattern family (e.g. two "Two Pointer" problems in a row).

7. **21-Day Import Spread (`spreadImportDueDates`)**:
   - When migrating a large CSV spreadsheet, prevents review spikes by spreading initial due dates across 21 to 60 days.
   - Places `revisit: true` and `SOLVED_WITH_HELP` problems at the front of the schedule.

### 4.2 Pattern Trigger Cues (`lib/cues.ts`)
Maintains canonical problem trigger recognition cues across 24 algorithmic patterns (e.g., Two Pointer, Sliding Window, Monotonic Stack, Trie, Kadane's, Union Find, Prefix Sum, BFS/DFS).

---

## 5. Server Actions (`app/actions/`)

All actions run server-side, validate inputs with `zod`, enforce authentication via `getCurrentUser()`, and revalidate Next.js cache paths.

### 5.1 Entry Actions (`app/actions/entry-actions.ts`)

| Action | Input Parameters | Database Operations & Business Logic |
| :--- | :--- | :--- |
| `createEntry` | `problemId?`, `manualTitle?`, `manualUrl?`, `manualPlatform?`, `manualDifficulty?`, `manualTopicTags?`, `status`, `minutes?`, `idea?`, `mistake?`, `sourceList?`, `revisit?`, `patternOverride?` | If problem doesn't exist, creates `Problem`. If `Entry` already exists, appends `Attempt` and advances `ReviewCard`. If new `Entry`, creates `Entry`, `Attempt`, and seeds `ReviewCard` (if rating $\in \{\text{AGAIN, HARD}\}$ or `revisit === true`). Revalidates `/today`, `/problems`, `/stats`. |
| `recordReviewAttempt` | `entryId`, `status`, `minutes?`, `usedHint?`, `note?`, `newMistake?` | Verifies ownership. Derives rating from time baselines. Appends `Attempt`. Upserts `ReviewCard` with advanced FSRS parameters. Appends new mistake notes with timestamp. |
| `recordRecallAttempt` | `entryId`, `rating` (AGAIN, HARD, GOOD), `wroteApproach?` | Verifies ownership. Appends `Attempt` with approach note. Advances `ReviewCard` without requiring solve minutes. |
| `updateEntryInline` | `entryId`, `field` (idea, mistake, revisit, status), `value` | Direct inline editing from spreadsheet data grid. Updates `Entry` record and revalidates paths. |
| `toggleScheduleReview` | `entryId`, `schedule` (boolean) | Adds problem to review queue (`ReviewCard.create`) or excludes problem (`ReviewCard.delete`). |
| `deleteEntry` | `entryId` | Deletes user's `Entry` (cascades to attempts and review cards). Revalidates all views. |
| `toggleRoadmapItemSolve` | `canonicalProblemId?`, `itemTitle`, `itemPrimaryUrl?`, `currentlySolved`, `entryId?` | Interactive checkbox on study roadmap. If checked, creates `Problem` (if needed), `Entry`, and `ReviewCard`. If unchecked, deletes `Entry`. |

### 5.2 Import Actions (`app/actions/import-actions.ts`)

| Action | Input Parameters | Database Operations & Business Logic |
| :--- | :--- | :--- |
| `searchCatalogProblems` | `query` (string) | Fast search by problem number, title, or slug for manual reconciliation. |
| `dryRunImportCSV` | `csvText` (string) | Parses 9-column CSV via PapaParse. Matches against catalog by: (1) URL slug, (2) Leading problem number, (3) Exact title. Detects CSV duplicate groups, detects title vs URL number mismatches with 1-click suggested auto-fixes, and flags prior DB conflicts. |
| `commitImportBatch` | `rows` (`DryRunRow[]`), `filename?`, `conflictStrategy` (SKIP or OVERWRITE) | Runs inside a single transaction (up to 120s timeout). Auto-creates missing `Pattern` records. Creates new `Problem` records for GFG/Other links. Creates `Entry` with all 9 columns. Seeds and applies 21-day FSRS due date spread. |

### 5.3 Settings Actions (`app/actions/settings-actions.ts`)

| Action | Input Parameters | Database Operations & Business Logic |
| :--- | :--- | :--- |
| `getUserSettings` | None | Returns current user's settings or creates default. Also returns total attempt count. |
| `updateUserSettings` | `dailyResolveCap`, `desiredRetention`, `timezone`, `easyBaseline`, `mediumBaseline`, `hardBaseline` | Upserts `UserSettings` record. |
| `optimizeFSRSParams` | None | Requires $\ge 1,000$ review attempts. Fits and persists optimized 19-weight FSRS parameter vector to `UserSettings.fsrsParams`. |

---

## 6. API Route Handlers (`app/api/`)

All API routes return JSON responses and enforce session authentication (except the cron endpoint which uses a secret header).

| Endpoint | Method | Auth | Query / Payload | Response & Operations |
| :--- | :--- | :--- | :--- | :--- |
| `/api/today-queue` | `GET` | User Session | None | Fetches due cards for current user (`lte: now`), computes retrievability, runs `interleaveQueue` with `dailyResolveCap`, and returns `{ queue, resolveCount, recallCount, overdueCount, snapshot }`. |
| `/api/patterns` | `GET` | User Session | None | Returns all canonical patterns with user-specific solved counts, card counts, leech counts, mean retrievability ($R$), last drilled timestamp, and full problem lists. |
| `/api/search/problems` | `POST` | Public / Session | `{ query: string }` | Fast 150ms search. Handles URL parsing (LeetCode slug, GFG slug), pure number matching (`Problem.number`), and case-insensitive substring title matching. Returns top 10 matches with pattern tags. |
| `/api/review/weekly` | `GET` | User Session | None | Calculates pattern health across user history. Returns patterns grouped by: `belowTarget` ($R < \text{target}$), `untouched14Days` ($\ge 14$ days since drill), `healthy`, and `unpracticed`. |
| `/api/review/weekly/drill` | `POST` | User Session | `{ patternId: string, correct: boolean }` | Records weekly pattern cue flashcard result into `PatternDrill`. |
| `/api/review/monthly` | `GET` | User Session | None | Generates a 5-problem blind mock interview set from the user's weakest pattern families with concealed labels and difficulties. |
| `/api/stats` | `GET` | User Session | None | Returns performance telemetry: cold-solve rate, total attempts/entries/cards, lapse rate, leech list, median minutes by difficulty (Easy, Medium, Hard), distribution by difficulty and source list, and mistake corpus keyword frequencies. |
| `/api/cron/sync-leetcode` | `POST` | `x-cron-secret` or `?secret=` | None | Triggers `syncLeetCode()` background worker. Updates/creates canonical LeetCode catalog problems from LeetCode GraphQL. |
| `/api/auth/[...nextauth]` | `GET` / `POST` | Auth.js | NextAuth standard handlers | Handles OAuth callbacks, JWT tokens, sign-in, and sign-out. |

---

## 7. Frontend Pages & Application Views (`app/`)

### 7.1 `/` — Landing Page (`app/page.tsx`)
- Server-rendered marketing and overview page with live database statistics (`problemCount`, `patternCount`, `dueCount`, `leechCount`).
- Explains the limitation of spreadsheet tracking vs FSRS spaced repetition.
- Visual figures illustrating daily queue structure and core insight/mistake logs.

### 7.2 `/today` — Daily Review Dashboard (`app/today/page.tsx`)
- Real-time practice dashboard with dual review lanes:
  - **`RecallCardItem`**: 3-minute approach recall (write intuition $\rightarrow$ compare stored notes $\rightarrow$ rate: Matched, Close, Blank).
  - **`ReviewCardItem`**: Full re-solve card with blind pattern/difficulty tags and timer input.
- Technical spec grid displaying: Problems logged, Solved without help %, Due today, Stuck problems (Leeches).
- Overdue backlog alert banner with quick settings shortcut.
- Direct cards linking to the Weekly Pattern Drill and Monthly Blind Mock.

### 7.3 `/problems` — Problem Grid Catalogue (`app/problems/page.tsx`)
- Dense spreadsheet-style TanStack data table displaying all user-solved entries.
- Multi-column sorting, pattern family filtering, global search, and pagination.
- **Inline Editing**: Double-click or click to edit Idea notes, Mistake notes, Revisit flags, and Solve Status directly within table cells.

### 7.4 `/problems/[id]` — Problem Detail View (`app/problems/[id]/page.tsx`)
- Detailed problem page showing:
  - Header with platform, number, difficulty badge, leech status, and direct external solve link.
  - **Schedule Review Toggle**: One-click button to add/remove problem from FSRS review queue.
  - Core Intuition / Idea notes box and Mistake / Trap notes box.
  - **FSRS Memory Telemetry**: Next due date, Retrievability ($R\%$), Stability ($S$), Difficulty ($D$), Reps, Lapses, and State.
  - Complete chronological attempt and review history.

### 7.5 `/patterns` — Pattern Mastery Heatmap (`app/patterns/page.tsx`)
- Visual grid of all 24+ canonical algorithm patterns.
- Color-coded by FSRS mean retrievability (Strong $\ge 90\%$, Medium $60\text{--}89\%$, Weak $<60\%$, New).
- Master/detail view: selecting a pattern displays all associated problems with status, retrievability, lapses, and direct "+ Log" command bar triggers.

### 7.6 `/roadmap` — Study Roadmap (`app/roadmap/page.tsx`)
- YouTuber DSA Patterns curriculum grouped into collapsible pattern sections.
- Search filter and status filter (All, Unsolved, Solved).
- **Interactive Checkboxes**: Click any problem checkbox to immediately mark/unmark solve status in the database with optimistic UI updates.
- Links out to multiple practice links (LeetCode, GFG, CodeStudio).

### 7.7 `/stats` — Performance Telemetry (`app/stats/page.tsx`)
- Analytics dashboard displaying:
  - Headline metrics: Cold-solve rate %, Total problems practiced, Lapse rate per card, Typical solve time (Easy / Medium / Hard medians).
  - Difficulty distribution bar charts.
  - Source list distribution (e.g. Striver, NeetCode, Roadmap).
  - **Mistake Corpus Frequency**: Stopword-filtered word frequency analysis from user mistake logs.
  - **Stuck Problems (Leech Table)**: Dedicated list of all problems with $\ge 3$ lapses, displaying previous mistake logs.
  - Explanatory glossary defining all metrics.

### 7.8 `/settings` — Configuration & Optimizer (`app/settings/page.tsx`)
- Forms to adjust:
  - Daily review cap (cards/day).
  - Desired retention target ($0.70$ to $0.95$).
  - User timezone.
  - Difficulty solve time baselines (Easy, Medium, Hard in minutes).
- **FSRS Parameter Optimizer**: Unlocks at 1,000+ logged review attempts to optimize personal 19-weight FSRS vector.

### 7.9 `/import` — 3-Step CSV Spreadsheet Migration (`app/import/page.tsx`)
- Interactive import wizard for personal 9-column solved-problems spreadsheets:
  - **Step 1: Upload & Dry Run**: Parses CSV, maps columns, and displays matched/new/conflict counts.
  - **Step 2: Pre-Commit Duplicate Resolution**: Side-by-side comparison for duplicate problem entries. Provides 1-click auto-fixes for mismatched numbers/URLs and a "Merge Notes" button.
  - **Step 3: Conflict Strategy & Batch Commit**: Choose to Skip or Overwrite existing database entries. Commits with a 21-day FSRS schedule spread.
  - **Detail Inspector Modal**: Allows viewing full idea notes, mistake notes, and raw attributes before committing.

### 7.10 `/review/weekly` — Pattern Recognition Drill (`app/review/weekly/page.tsx`)
- Flashcard drill testing recognition from problem trigger cues without coding.
- Identifies weak patterns ($R < \text{target}$) and idle patterns (untouched $\ge 14$ days).
- "Reveal Pattern" toggle with self-grading buttons ("Yes, I named it" / "No").

### 7.11 `/review/monthly` — Timed Blind Mock Assessment (`app/review/monthly/page.tsx`)
- 5-problem timed blind mock assessment.
- Selects problems from the user's weakest pattern families.
- Intentionally hides pattern names and difficulty labels during the test to simulate real interview pressure.
- Built-in timer and outcome recorder (`Solved cold`, `Used hint`, `Failed`).
- Post-assessment report revealing scores, times, and pattern techniques.

### 7.12 `/auth/signin` — Sign In Page (`app/auth/signin/page.tsx`)
- Authentication screen supporting:
  - Google OAuth sign-in (Production).
  - Local dev account credentials sign-in (Development).

---

## 8. Client Components & Utilities (`components/`, `lib/`)

### 8.1 Global Components
- **`CommandBar` (`components/command-bar.tsx`)**: Global `⌘K` modal. Fast 150ms debounced problem search, URL import detection, hotkeys (`1` = Unaided, `2` = With Help, `3` = Failed, `⌘+Enter` = Submit), and undo toast notification.
- **`Navbar` & `SidebarNav` (`components/navbar.tsx`)**: Sticky top navigation with light/dark theme toggle, command bar trigger, keyboard shortcut trigger, user profile dropdown, and secondary tab bar.
- **`KeyboardShortcutsModal` (`components/keyboard-shortcuts-modal.tsx`)**: Modal activated via `?` key explaining all global keyboard shortcuts.
- **`ThemeProvider` & `ThemeToggle` (`components/theme-provider.tsx`, `components/theme-toggle.tsx`)**: System/Dark/Light theme switcher with local storage persistence.
- **`SpecGrid` & `SpecCell` (`components/ui/spec-sheet.tsx`)**: Dense technical metric display components.
- **`ScheduleReviewToggle` (`components/schedule-review-toggle.tsx`)**: Toggle button on problem detail pages to enable/disable FSRS review scheduling.

### 8.2 Utilities
- `lib/prisma.ts`: Global singleton PrismaClient instance avoiding duplicate connection pools in Next.js HMR.
- `lib/utils.ts`: Tailwind class merger (`cn`), difficulty formatters (`formatDifficulty`), solve status badges (`formatStatus`), and time formatting (`formatMinutes`).
- `lib/import-utils.ts`: URL slug extraction (`parseSlugFromUrl`), leading number extraction (`parseLeadingNumber`), status mapping (`mapRawStatus`), revisit boolean mapping (`mapRawRevisit`), and row merging (`mergeTwoRows`).
- `lib/dashboard.ts`: Server-side aggregation queries for `/today` queue and `/stats` telemetry snapshot.

---

## 9. Background Scripts & Ingestion Pipelines (`scripts/`)

| Script File | NPM Command | Description |
| :--- | :--- | :--- |
| `scripts/seed-patterns.ts` | `npm run seed:patterns` | Seeds 24 canonical patterns from `data/patterns.csv` and populates canonical `ProblemPattern` mappings from `data/youtuber-roadmap.csv`. |
| `scripts/sync-leetcode.ts` | `npm run sync:leetcode` | Connects to LeetCode's official GraphQL API (`problemsetQuestionList`) with 1 req/sec rate limiting, pagination, and exponential backoff. Upserts canonical problem number, title, slug, URL, difficulty, acceptance rate, paid status, and topic tags. |
| `scripts/import-roadmap.ts` | `npm run import:roadmap` | Ingests the YouTuber DSA Patterns roadmap from `data/youtuber-roadmap.csv` into `RoadmapPattern` and `RoadmapItem` models, matching against canonical problems. |
| `scripts/merge-patterns.ts` | N/A (`tsx scripts/merge-patterns.ts`) | Normalizes legacy pattern name variations and merges duplicate pattern records. |
| `scripts/prune-clean-cards.ts` | N/A (`tsx scripts/prune-clean-cards.ts [--confirm]`) | Scans and optionally prunes redundant review cards for unaided, clean first solves. |

### Data Files in Repository (`data/`):
- `data/patterns.csv`: Canonical 24 pattern taxonomy (name, family, sortOrder).
- `data/problem-patterns.csv`: Canonical problem-to-pattern associations.
- `data/starter-problems.json`: Starter offline dataset of top LeetCode problems.
- `data/youtuber-roadmap.csv`: Curated roadmap sheet questions and multi-platform links.

---

## 10. Environment Variables & Configuration

The application requires the following environment variables:

| Variable | Required In | Purpose | Example Value |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | All Environments | PostgreSQL connection string (with schema) | `postgresql://postgres:password@localhost:5432/hashit?schema=public` |
| `AUTH_SECRET` | Production | 32-byte base64 secret for NextAuth JWT encryption | Generate via `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` | Production | Google OAuth 2.0 Client ID | `123456789-abc.apps.googleusercontent.com` |
| `AUTH_GOOGLE_SECRET` | Production | Google OAuth 2.0 Client Secret | `GOCSPX-xxxxxxxxxxxxxxxx` |
| `CRON_SECRET` | Production | Secret token to authenticate `/api/cron/sync-leetcode` | Generate via `openssl rand -hex 16` |
| `NODE_ENV` | Production | Node environment flag | `production` |

---

## 11. Deployment Guide & Runbook

### 11.1 Infrastructure Requirements
- **Database**: PostgreSQL 14+ (Compatible with Neon, Supabase, AWS RDS, Railway, Render, or Docker).
- **Compute / Hosting**: Node.js 20+ runtime (Compatible with Vercel, Railway, Render, AWS ECS, Fly.io, or Docker container).

### 11.2 Build & Deployment Steps

1. **Clone & Install Dependencies**:
   ```bash
   npm ci
   ```

2. **Generate Prisma Client & Sync Database**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

3. **Seed Canonical Patterns & Roadmap**:
   ```bash
   npm run seed:patterns
   npm run import:roadmap
   ```

4. **(Optional) Sync LeetCode Problemset**:
   To pre-populate all 3,000+ LeetCode problems into the canonical catalog:
   ```bash
   npm run sync:leetcode
   ```

5. **Build Next.js Production Bundle**:
   ```bash
   npm run build
   ```

6. **Start Application**:
   ```bash
   npm run start
   ```

### 11.3 Google OAuth Configuration
In the Google Cloud Console (APIs & Services $\rightarrow$ Credentials):
- **Authorized JavaScript Origins**: `https://<your-domain>`
- **Authorized Redirect URIs**: `https://<your-domain>/api/auth/callback/google`

### 11.4 Automated LeetCode Sync Cron Job
Configure a recurring cron job (e.g. daily or weekly) to call:
```bash
curl -X POST https://<your-domain>/api/cron/sync-leetcode \
  -H "x-cron-secret: <YOUR_CRON_SECRET>"
```
*(On Vercel, define this in `vercel.json` under `crons`).*
