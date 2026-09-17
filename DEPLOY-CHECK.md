# Hash-It deploy check

## 1. Blocking

- **Stored XSS (`dangerouslySetInnerHTML`)** — PASS — `grep -rn "dangerouslySetInnerHTML" --include="*.tsx" . | grep -v node_modules` → empty. `idea`/`mistake` rendered as React text (`whitespace-pre-wrap`), not HTML/markdown.
- **`npx next build`** — PASS — compiled successfully; 15 routes generated (Next.js 15.5.25).
- **`npx vitest run`** — PASS — `Test Files  24 passed (24)` / `Tests  222 passed (222)` (with `.env` loaded + Neon reachable).
- **`npx tsc --noEmit`** — PASS — exit 0 (after fix; previously failed on unused `@ts-expect-error` in `tests/unit/auth-get-current-user.test.ts`).
- **No hardcoded localhost AUTH URLs** — PASS — `grep -rn "localhost" .env.example next.config.*` → empty after fix; `grep -rn "localhost:30" app/ lib/ components/ --include="*.ts*" | grep -v test` → empty. `AUTH_URL`/`NEXTAUTH_URL` read from `process.env` in `lib/auth.config.ts`.
- **Migrations baseline** — PASS — `prisma/migrations/0_init/migration.sql` exists; `npx prisma migrate deploy` → `1 migration found` / `No pending migrations to apply.`
- **Deploy build uses migrate deploy** — PASS — `package.json` `"build": "prisma migrate deploy && next build"` (was `next build` only).

## 2. Environment

`process.env` reads (`grep -rn "process.env" --include="*.ts*" app/ lib/ middleware.ts | grep -v test`):

| Variable | Where | If missing |
|---|---|---|
| `DATABASE_URL` | `lib/env.ts` (zod required URL) | Startup throw: `Invalid environment variables` |
| `AUTH_SECRET` | `lib/env.ts` + `lib/auth.config.ts` `requireAuthSecret()` | Startup throw: `AUTH_SECRET is required` (prod also requires ≥16 chars) |
| `AUTH_URL` / `NEXTAUTH_URL` | `lib/env.ts` optional; cookie secure if either is `https://` | Auth.js uses host/trustHost; insecure cookies if neither https nor production |
| `AUTH_TRUST_HOST` | `lib/env.ts` optional | Optional; config sets `trustHost: true` anyway |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | `lib/env.ts` + `lib/auth-guards.ts` + signin page | Dev: Google optional, credentials provider on. Prod: throw at env parse / assert; signin falls back only in non-prod |
| `CRON_SECRET` | `lib/env.ts` optional; `app/api/cron/sync-leetcode/route.ts` | Handler returns 401 if unset/empty or header mismatch |
| `NODE_ENV` | prisma / auth / signin | Controls logging, secure cookies, Google-required, credentials provider |

- **`DATABASE_URL` pooled** — PASS (local) — local `.env` uses Neon `-pooler` host. Schema has no `directUrl` (only `url = env("DATABASE_URL")`). Production Vercel value — UNKNOWN (not readable from this environment).
- **`AUTH_SECRET` set / 16+ / ≠ local for prod** — PASS (local code+`.env` len=43); production Vercel value and distinctness — UNKNOWN.
- **Google OAuth fail-closed in production** — PASS — `lib/env.ts` throws if missing in production; `assertProductionAuthConfigured` same. Production Vercel values set — UNKNOWN.
- **`CRON_SECRET` gate** — PASS — unset/missing/empty/wrong → 401; valid → 200 (`unset_secret_missing_header 401` … `set_secret_ok 200`). Production Vercel value set — UNKNOWN.
- **`AUTH_URL` / `NEXTAUTH_URL` production domain** — UNKNOWN for Vercel; local `.env` still points at `http://localhost:3033` (dev only). `.env.example` now documents production placeholders.
- **`.env.example` lists all vars** — PASS — after fix: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `NEXTAUTH_URL`, `AUTH_TRUST_HOST`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `CRON_SECRET`.
- **`.env` gitignored / never committed** — PASS — `git check-ignore -v .env` → `.gitignore:37:.env`; `git log --oneline --all -- .env | head` → empty.

## 3. Client bundle

- **No secret `process.env` in client TSX** — PASS — only hit is `app/auth/signin/page.tsx` (Server Component) reading `AUTH_GOOGLE_*` / `NODE_ENV`; no `NEXT_PUBLIC` secrets.
- **Secrets not in `.next/static/`** — PASS — `grep -rl "AUTH_SECRET\|DATABASE_URL\|GOOGLE_SECRET" .next/static/` → empty.

## 4. Runtime behaviour

- **`error.tsx` / `not-found.tsx` coverage** — PASS — `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx` (root covers all segments; was missing `not-found.tsx`).
- **Error responses don’t leak internals** — PASS — API catch blocks return generic JSON (`"Failed to load stats"`, `"Search failed"`, `"Sync failed"`, etc.) and `console.error` server-side only. Server actions throw short auth/validation messages, not stacks/SQL/env.
- **`console.log` in `app/` / `lib/`** — PASS — grep empty (excluding tests).
- **Destructive scripts dry-run by default** — PASS — `grep -ln "confirm" scripts/*.ts` → `import-roadmap.ts`, `merge-patterns.ts`, `prune-clean-cards.ts` (after fix; seed/sync are non-destructive upserts).

## 5. Data safety

- **CSV export backup path** — PASS — `/problems` export via `handleExportCsv` in `components/problem-grid/data-table.tsx`. Offline round-trip of export→import column mapping → `CSV_ROUNDTRIP_PASS` (headers: `Problem Name|Problem Link|Topic|Pattern|Idea|What I did wrong|Status|Revisit?|Source`). Live dry-run against DB covered by integration import test.
- **Seed/sync idempotent, no deletes** — PASS —
  - Seed: `prisma.pattern.upsert({ where: { name }, update: { family, sortOrder }, create: {...} })` and `prisma.problemPattern.upsert(... update: {})`.
  - Sync: find-by-slug then `update` or `create` only; on abort logs `Existing rows untouched.`

## Fixed

1. `package.json` build → `prisma migrate deploy && next build`.
2. Added `app/not-found.tsx`.
3. `.env.example`: Neon pooled `DATABASE_URL` placeholder; added `AUTH_URL`, `NEXTAUTH_URL`, `AUTH_TRUST_HOST`; removed localhost.
4. `tests/unit/auth-get-current-user.test.ts`: fixed `tsc --noEmit` errors.
5. `scripts/import-roadmap.ts` and `scripts/merge-patterns.ts`: dry-run by default; require `--confirm` to mutate.

## Post-deploy (human)

1. Add the production callback URL to the Google Cloud console credentials.
2. Sign in on the deployed URL with a real Google account — OAuth has only ever been tested via mocks, and `@auth/core` was recently upgraded across a major version.
3. Sign in with a second account and confirm it sees an empty app, not the first user's data.
4. Trigger the cron sync manually and confirm it authenticates and completes.
5. Export the CSV from production and keep it.
6. Set Vercel env: Neon **pooled** `DATABASE_URL`, new `AUTH_SECRET` (≥16, different from local), `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`, `CRON_SECRET`, `AUTH_URL`/`NEXTAUTH_URL` = production domain, `AUTH_TRUST_HOST=true`.
