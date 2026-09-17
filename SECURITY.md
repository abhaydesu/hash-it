# Hash-It: Authentication & Authorization Security Report

Scope: `lib/auth.ts`, `lib/auth.config.ts`, `lib/auth-guards.ts`, `lib/env.ts`, `middleware.ts`, and every Prisma/API path that touches user-scoped practice data. Nothing else.

---

## 1. Audit (pre-fix evidence)

### 1.1 Production fail-open

**Evidence (before):**

```97:108:lib/auth.ts
export async function getCurrentUser() {
  if (isProduction && !hasGoogleAuth) {
    throw new Error("AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are required before a user can sign in.");
  }
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized: no active session");
  }
  return session.user ...
}
```

Credentials provider was already gated with `!isProduction`. There was **no** shared local-account fallthrough in `getCurrentUser`.

**Gap:** `lib/env.ts` treated Google OAuth as optional even when `NODE_ENV=production`, so a misconfigured deploy could boot with zero providers. Access was still locked (middleware + `getCurrentUser`), but startup did not fail closed on missing OAuth.

**Current state after fix:** fail-closed at three layers — `lib/env.ts` (startup), `assertProductionAuthConfigured()` (module load + `getCurrentUser`), credentials disabled in production.

### 1.2 Middleware

**Evidence:**

```8:35:middleware.ts
const PUBLIC_PATHS = [
  "/",
  "/auth/signin",
  "/api/auth",
  "/api/cron",
  "/favicon.ico",
  "/icon.svg",
  "/logo-1.svg",
  "/logo-2.svg",
];
// ...
if (!req.auth?.user) {
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // redirect to /auth/signin
}
```

Session is required on every non-public route **regardless** of whether OAuth is configured.

| Public path | Should be public? |
|---|---|
| `/` | Yes — marketing/landing |
| `/auth/signin` | Yes — sign-in |
| `/api/auth` | Yes — Auth.js handlers |
| `/api/cron` | Yes to middleware; gated by `CRON_SECRET` in the route |
| Favicons / logos | Yes — static assets |

### 1.3 `AUTH_SECRET`

**Evidence:**

```5:5:lib/env.ts
AUTH_SECRET: z.string().min(1),
```

```10:10:lib/auth.config.ts
secret: process.env.AUTH_SECRET,
```

Required at process start via `lib/env.ts` (imported by `lib/prisma.ts`). After fix, `requireAuthSecret()` also fails closed in `auth.config.ts` (used by Edge middleware) and enforces ≥16 chars in production.

### 1.4 Record reassignment

**Command:**

```bash
grep -n "updateMany\|userId:" lib/auth.ts lib/auth.config.ts
```

**Result:** no `updateMany` transferring rows. Auth only upserts `userSettings` for the signing-in `user.id`. Historical `entry.updateMany` migration from `dev-user-local` was already removed (commit `2720fd9`). **No further deletion needed.**

### 1.5 Query scoping

**Command:**

```bash
grep -rn "prisma\.\(entry\|attempt\|reviewCard\|userSettings\|importBatch\)\." app/ lib/ --include="*.ts" | grep -v test
```

| Call site | Scoped? |
|---|---|
| `entry-actions` `findUnique` / `findFirstOrThrow` / `updateMany` / `deleteMany` | Yes — `userId: user.id` (or prior lookup via `userId_problemId`) |
| Nested `attempt.create` / `reviewCard.*` after scoped entry load | Yes — parent entry already ownership-checked |
| `toggleRoadmapItemSolve` `deleteMany` | Yes — `userId` in where (**fixed** to throw if `count === 0`) |
| `import-actions` `entry.findMany` / `importBatch.create` | Yes — `userId: user.id` |
| `settings-actions` all calls | Yes — `userId: user.id` |
| `lib/dashboard.ts` | Yes — `entry: { userId }` / `where: { userId }` |
| API `stats` / `patterns` / `review/*` | Yes — session `user.id` in filters |
| `lib/auth.ts` `userSettings.upsert` | Yes — signing-in user only |

No unscoped user-data queries found that return another user's rows.

### 1.6 Route handlers (`app/api/`)

| Route | Auth check |
|---|---|
| `auth/[...nextauth]` | Auth.js public |
| `cron/sync-leetcode` | `CRON_SECRET` (`secretsEqual`) |
| `today-queue`, `stats`, `patterns`, `review/weekly`, `review/monthly`, `review/weekly/drill`, `search/problems` | `auth()` → 401 if no `session.user.id` |

### 1.7 Cookies

Auth.js defaults (pinned explicitly after fix):

- `httpOnly: true`
- `sameSite: "lax"`
- `secure: true` when `NODE_ENV=production` or `AUTH_URL`/`NEXTAUTH_URL` is HTTPS
- `path: "/"`

---

## 2. Fixes applied

Severity order:

1. **Fail-closed production OAuth** — `lib/env.ts` throws at startup if Google ID/secret missing in production; `lib/auth-guards.ts` + module-load assert in `lib/auth.ts`.
2. **`AUTH_SECRET` on Edge** — `requireAuthSecret()` in `lib/auth.config.ts` (middleware bundle); min length 16 in production.
3. **Explicit session cookie flags** — `cookies.sessionToken.options` in `auth.config.ts`.
4. **Roadmap unmark authz** — `toggleRoadmapItemSolve` now throws `Entry not found or unauthorized` when `deleteMany` matches 0 rows (no silent success against another user's id).
5. **Testable middleware gate** — exported `PUBLIC_PATHS`, `isPublicPath`, `authorizeRequest` (behavior unchanged).

No record-reassignment code remained to delete. No unscoped Prisma reads of user practice data required changes beyond (4).

---

## 3. Tests & coverage

### New / extended tests

- `tests/unit/auth.test.ts` — production OAuth guards, dev credentials gate
- `tests/unit/auth-get-current-user.test.ts` — production module-load throw, no session, providers, jwt/session callbacks, credentials authorize
- `tests/unit/auth-config.test.ts` — secret required, length, cookie flags, session callback
- `tests/unit/middleware.test.ts` — public path list, 401/redirect for protected routes
- `tests/unit/env-auth.test.ts` — missing secret
- `tests/integration/auth-matrix.test.ts` — expanded matrix for every server action + API handler; cross-user isolation; new user inherits nothing; id-scoped lookup returns null for foreign ids

### Coverage (vitest v8, focused include)

| File | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| `lib/auth.ts` | 95.28% | 61.11% | 100% | 95.28% |
| `lib/auth.config.ts` | 100% | 85.71% | 100% | 100% |
| `lib/auth-guards.ts` | 100% | 100% | 100% | 100% |
| `middleware.ts` | 84.44% | 91.66% | 100% | 84.44% |

### Paths not fully exercised (with reason)

| Path | Reason |
|---|---|
| `middleware.ts` default export wrapper (`auth((req) => …)` lines 52–58) | Requires live NextAuth Edge middleware request object; gate logic covered via `authorizeRequest` |
| `lib/auth.ts` email-validation fallback / upsert catch / session `token.sub` branch | Defensive edge branches; primary paths covered |
| Full Next.js page render of `app/problems/[id]` → `notFound()` | Integration proves scoped `findFirst` returns null for foreign ids; rendering `notFound()` needs App Router request context |
| Live Google OAuth redirect / real session cookie round-trip | Needs Google credentials + browser; unit tests cover provider construction and cookie option pinning |

Integration auth-matrix: **8/8 passed** against the project Postgres (Neon).

---

## 4. Authorization matrix coverage

Unauthenticated rejection + User-B-cannot-touch-User-A for:

- `createEntry`, `deleteEntry`, `updateEntryInline`, `toggleScheduleReview`, `recordReviewAttempt`, `recordRecallAttempt`, `toggleRoadmapItemSolve`
- `getUserSettings`, `updateUserSettings`, `optimizeFSRSParams`
- `searchCatalogProblems`, `dryRunImportCSV`, `commitImportBatch`
- `GET` `/api/today-queue`, `/api/stats`, `/api/patterns`, `/api/review/weekly`, `/api/review/monthly`
- `POST` `/api/review/weekly/drill`, `/api/search/problems`

Id-addressed entry access: foreign `entryId` does not resolve under the session `userId` (returns null / throws /  not-found semantics — never the foreign record).
