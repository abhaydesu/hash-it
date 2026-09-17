# Hash-It

Personal spaced-repetition tracker for coding interview problems (LeetCode / GFG).
Next.js 15 App Router, Prisma + Postgres (Neon), Auth.js v5 (Google OAuth).

## Setup

```bash
cp .env.example .env
# fill DATABASE_URL (Neon pooled), AUTH_SECRET, Google OAuth, CRON_SECRET
npm install
npx prisma migrate deploy
npm run seed:patterns   # optional catalog patterns
npm run sync:leetcode   # optional problem catalog sync
npm run dev
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local Next.js server |
| `npm run build` | `prisma migrate deploy` then production build |
| `npm start` | Serve production build |
| `npm test` | Vitest (unit, component, integration) |
| `npm run lint` | ESLint |
| `npx playwright test` | E2E (`tests/e2e`) |
| `npm run seed:patterns` | Upsert pattern taxonomy (idempotent) |
| `npm run sync:leetcode` | Upsert LeetCode catalog (idempotent) |
| `npm run import:roadmap` | Roadmap CSV import (**dry-run** unless `--confirm`) |

Destructive scripts (`import:roadmap`, `scripts/merge-patterns.ts`, `scripts/prune-clean-cards.ts`) are dry-run by default; pass `--confirm` to apply.

## Environment

See `.env.example`. Required in production:

- `DATABASE_URL` — Neon **pooled** connection string
- `AUTH_SECRET` — ≥16 characters, unique to production
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
- `AUTH_URL` / `NEXTAUTH_URL` — production domain
- `CRON_SECRET` — for `POST /api/cron/sync-leetcode`

## App routes

| Path | Purpose |
|---|---|
| `/` | Landing |
| `/auth/signin` | Sign in |
| `/today` | Daily review queue |
| `/problems`, `/problems/[id]` | Log + detail |
| `/roadmap` | Study roadmap |
| `/review/weekly`, `/review/monthly` | Pattern drills / mock |
| `/stats`, `/patterns`, `/import`, `/settings` | Analytics, import, prefs |
| `/api/auth/*` | Auth.js |
| `/api/cron/sync-leetcode` | Catalog sync (cron secret) |

## Layout

```
app/           # App Router pages + API routes
components/    # UI
lib/           # Auth, Prisma, scheduler, import helpers
prisma/        # Schema + migrations
scripts/       # Seed / sync / maintenance (tsx)
data/          # Seed CSVs (committed); unmatched.csv is generated
tests/         # unit / component / integration / e2e
```

## Deploy (Vercel)

1. Set production env vars from `.env.example`.
2. Build command uses `prisma migrate deploy && next build` (do not use `db push` in prod).
3. Add the production OAuth callback URL in Google Cloud Console.
4. After deploy: sign in with two accounts to confirm isolation; trigger cron once; export CSV from `/problems` as a backup.
