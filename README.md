# Hash-It

Hash-It is a spaced-repetition tracker for coding interview problems. You log
each LeetCode or GeeksforGeeks problem you solve, and how it went. Hash-It then
decides when you should see it again, and whether that should be a quick
recall check or a full re-solve from scratch. Scheduling is built on FSRS (the
algorithm behind modern Anki), adapted for problems that take minutes rather
than seconds to review. See [docs/scheduler.md](docs/scheduler.md) for the
design.

**Live:** https://hash-it.abhaydesu.me

## Tech stack

- **Framework:** Next.js 15 (App Router, Server Components, Server Actions), React 19, TypeScript
- **Data:** PostgreSQL (Neon in production), Prisma ORM with versioned migrations
- **Auth:** Auth.js v5 with Google OAuth, plus a credentials sign-in that is enabled only in development
- **Scheduling:** [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs)
- **UI:** Tailwind CSS, Radix UI, TanStack Table, lucide-react
- **Validation:** Zod for env vars, server-action inputs and imports
- **Testing:** Vitest, Testing Library, Playwright
- **CI/Hosting:** GitHub Actions, Vercel

## Architecture

```
app/        Routes (App Router). Pages like /today, /practice, /problems, /import,
            /review/weekly and /review/monthly, with:
  actions/    Server actions: all mutations (logging, reviews, imports, settings)
  api/        Route handlers: read endpoints, auth and a cron-triggered LeetCode sync
lib/        Domain logic, kept free of React where possible:
              scheduler.ts / first-intervals.ts  FSRS wrapper, ratings, review lanes
              dashboard.ts                       daily review queue (caps, ordering)
              weekly-review.ts, monthly-mock.ts  weekly/monthly review flows
              pattern-classifier.ts, pattern-match.ts, import-utils.ts  import + tagging
              auth.ts, auth.config.ts, env.ts    Auth.js setup and env validation
components/ React components (client and server), grouped by feature
prisma/     schema.prisma and SQL migrations
scripts/    One-off maintenance and seeding scripts (run with tsx)
data/       Seed data: pattern catalogue, problem→pattern map, starter problems
tests/      unit/, component/, integration/, e2e/, plus shared setup/ and helpers/
```

Server components read through Prisma directly. Every write goes through a server
action that validates its input with Zod, scopes the query to the signed-in
user, and revalidates the affected routes. `middleware.ts` gates the
authenticated routes.

## Running locally

Requirements: Node 22 and a PostgreSQL database (local or Neon).

```bash
npm install                 # also runs `prisma generate`
cp .env.example .env
```

Fill in `.env` (all variables are listed in [`.env.example`](.env.example)):

| Variable | Needed for |
| --- | --- |
| `DATABASE_URL` | App connection string. On Neon, use the `-pooler` host. |
| `DIRECT_URL` | Non-pooled connection, used by `prisma migrate`. On local Postgres it can equal `DATABASE_URL`. |
| `AUTH_SECRET` | Always required. Generate with `openssl rand -base64 32`. |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google sign-in. Optional in development. |
| `AUTH_URL`, `NEXTAUTH_URL`, `AUTH_TRUST_HOST` | Production deployment only |
| `CRON_SECRET` | Protects `/api/cron/*` |
| `ROADMAP_EMAILS` | Optional owner-only `/roadmap` page |

Then apply migrations, seed the pattern catalogue and start the dev server:

```bash
npx prisma migrate deploy
npm run seed:patterns
npm run dev
```

Open http://localhost:3000. Outside production, the sign-in page also offers a
one-click local test user, so Google credentials aren't needed for development.

## Tests

| Suite | Location | Runs with | What it covers |
| --- | --- | --- | --- |
| Unit | `tests/unit` | `npm run test:unit` | Pure logic: scheduler, ratings, lanes, CSV matching, stats, auth guards, middleware |
| Component | `tests/component` | `npm run test:component` | React components in jsdom with Testing Library |
| Integration | `tests/integration` | `npm run test:integration` | Server actions and API routes against a real Postgres. Each test runs in a transaction that is rolled back. |
| End-to-end | `tests/e2e` | `npm run test:e2e` | Playwright in Chromium against a dev server on port 3033 |

`npm test` runs the unit, component and integration suites.

Integration tests use a separate `test_hash_it` schema in the database from
`DATABASE_URL`. The setup forces a direct (non-pooler) connection, so the test
schema can't leak into pooled connections. Create the schema once by running
migrations against it over the direct host:

```bash
DATABASE_URL="<direct-url>?schema=test_hash_it" DIRECT_URL="<direct-url>?schema=test_hash_it" \
  npx prisma migrate deploy
```

**CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs on every
push and pull request to `main` against a Postgres 16 service container. It
applies migrations, then runs ESLint, `tsc --noEmit`, the unit, component and
integration suites, and a production build. The Playwright suite runs locally.

## Using Hash-It

- **Log a problem.** Use the command bar or `/practice`. Say how it went: solved
  cold, used a hint, saw the solution, or failed. You can also flag it to
  revisit. That outcome sets the first review date.
- **Import your history.** At `/import`, upload a CSV or Excel sheet. For
  LeetCode history, the page gives you a prompt that turns screenshots of your
  submissions into a CSV with any LLM. Rows are matched to LeetCode or GFG problems
  automatically, previewed as a dry run, and spread over the following weeks so
  they don't all come due at once.
- **Review daily.** `/today` shows the day's queue. Recall cards are quick
  "do you remember the approach?" checks. Resolve cards mean writing the
  solution again. Daily caps keep the queue short.
- **Practice by pattern.** `/practice` suggests unsolved problems for a
  technique (DP, graphs, sliding window, …) at each difficulty.
- **Weekly and monthly reviews.** Each week there is a look back, a recall check
  on weak problems, and a plan for the week. Each month there is a timed mock
  set drawn from patterns you've already practised.
- **Track progress.** `/problems` is the full, filterable log, with CSV export
  and custom fields. `/stats` shows cold-solve rate, pattern strength and leeches.
