# AGENTS.md

High-signal context for OpenCode sessions working in `skald-scan`. Read this before touching code.

## What this is

pnpm + Turborepo monorepo for a self-hosted manga reader. Two Nuxt 3 apps deploy to Cloudflare (Workers/Pages via Alchemy IaC) and share a Drizzle/SQLite schema + MangaDex API client. The README is a leftover Nuxt starter template — ignore it.

## Layout

```
apps/dashboard   Admin ops app (port 3000). Nuxt 3 + Better Auth + Drizzle. Owns all API routes.
apps/reader      End-user reader (port 3001). Client auth via Bearer; proxies `/api/proxy/*` → dashboard `/api/*`.
packages/shared  @skald-scan/shared: Drizzle schema, enums, MangaDex client, types. Source-of-truth for the DB.
alchemy.run.ts   Root IaC: provisions DB (D1), STORAGE (R2), SESSIONS (KV), SYNC_QUEUE (Queue).
                 Dashboard/reader each import these bindings in their own alchemy.run.ts.
```

The shared package is consumed as `workspace:*` and its `main`/`exports` point **directly at `src/`** (no build step needed for local dev; `build` runs `tsc` to `dist/` but apps import from `src`).

## Commands

All run from repo root via Turborepo:

```bash
pnpm install          # also runs `nuxt prepare` in each app (postinstall)
pnpm dev              # turbo dev → dashboard :3000, reader :3001 (persistent)
pnpm build            # turbo build (depends on ^build)
pnpm typecheck        # turbo typecheck (depends on ^build) — run before lint
pnpm lint             # turbo lint (depends on ^build)
pnpm test             # turbo test (depends on ^build) — vitest run, non-watch
pnpm deploy:infra     # root alchemy.run.ts → D1, R2, KV, Queue (skald-scan-infra)
pnpm deploy:apps      # turbo deploy → `alchemy deploy --app <dashboard|reader>`
pnpm deploy           # deploy:infra then deploy:apps (pass --profile <name> to each alchemy command)
pnpm destroy          # turbo destroy --ui=stream → `alchemy destroy --app <dashboard|reader>`
```

Run a single package or test:

```bash
pnpm --filter dashboard test
pnpm --filter @skald-scan/shared test:watch
# scoped turbo:
pnpm exec turbo run test --filter=dashboard
pnpm exec turbo run build --filter=reader
```

CI (`.github/workflows/ci.yml`) runs `lint`, `typecheck`, and `test`. Node 22, pnpm cached.

## Turborepo task graph

`build`, `lint`, `test`, `typecheck` all `dependsOn: ["^build"]` — i.e. they build dependencies first. `dev`/`deploy`/`destroy` are not cached. Deploy/destroy are `cache: false` and ordered `^deploy` / `^destroy`.

If you add a task, wire it in `turbo.json` AND each package's `package.json` scripts — Turborepo only discovers tasks that exist in both.

## Alchemy / Cloudflare bindings — READ THIS

Bindings are defined in root `alchemy.run.ts` and attached to each app in `apps/<app>/alchemy.run.ts`:

| Binding name (alchemy) | Resource | Used by |
|---|---|---|
| `DB` | D1 (`skald-scan-<stage>-db`) | dashboard, reader |
| `STORAGE` | R2 (`skald-scan-<stage>-manga`) | dashboard, reader |
| `SESSIONS` | KV (`skald-scan-<stage>-sessions`) | dashboard |
| `SYNC_QUEUE` | Queue (`skald-scan-<stage>-sync-queue`) | dashboard |

Deploy secrets for dashboard: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `READER_URL` (see `.env.example`).

**Queue binding**: production code uses `SYNC_QUEUE` via `getSyncQueueFromEvent` / `dispatchSyncQueueMessage`. Legacy `MANGADEX_SYNC_QUEUE` references remain only in some test fixtures.

**Queue handler**: `server/plugins/queue-handler.ts` handles `import-manga`, `sync-chapters`, `download-pages`, and `extract-zip`. Dev inline processing is in `server/utils/sync-queue.ts` via `dispatchSyncQueueMessage`.

**Scheduled sync**: Nitro `scheduledTasks` in `apps/dashboard/nuxt.config.ts` runs `server/tasks/sync-chapters.ts` (not an HTTP cron route).

## Runtime access pattern (dashboard server)

Handlers never read `env` directly — they go through helpers in `server/utils/storage.ts`:

- `getCloudflareStorageEnv(event)` — throws if `event.context.cloudflare?.env` is missing.
- `getDatabaseFromEvent` / `getStorageFromEvent` / `getSyncQueueFromEvent` — typed accessors, each throws if its binding is absent.
- `requireAuthenticatedSession(event)` / `requireAdminRole(event)` — auth gates.
- `readEventBody` / `readEventQuery` / `readEventParam` — read from `event.context` first (tests inject via context), fall back to h3.

When adding a handler, reuse these; do not reach into `event.context.cloudflare.env.X` ad hoc.

## Auth

`apps/dashboard/server/utils/auth.ts` builds a Better Auth instance per-event via `getAuthFromEvent(event)`. It uses the Drizzle adapter against the shared `users`/`sessions` tables when `env.DB` is present, otherwise falls back to an in-memory adapter (used in tests / non-CF runtimes). `server/middleware/auth.ts` runs for everything except `/api/auth/**` and attaches `event.context.auth` + `event.context.authSession`. The `H3EventContext` augmentation lives in `server/types/auth.d.ts` — if you add fields to `authSession`, update that declaration.

`apps/dashboard/lib/auth.ts` is the browser-side Better Auth client (`basePath: '/api/auth'`). Dashboard is **admin-only** (`middleware: 'admin'`). Reader/mobile use Bearer token against the same `/api/auth` endpoints.

## API tiers (dashboard server)

| Tier | Examples | Who |
|---|---|---|
| Public catalog | `GET /api/manga`, pages, cover, `GET /api/health` | Anyone |
| User | `GET/PUT /api/reading-progress`, `GET/POST /api/collections` | Authenticated `reader` (Bearer or cookie) |
| Admin | `/api/manga` writes, `/api/mangadex/*`, `/api/storage/*`, `/api/admin/*` | `admin` role only |

Reader proxy: `/api/proxy/<path>` → `dashboardUrl/api/<path>` (proxy normalizes missing `/api` prefix).

## Drizzle / migrations

- Schema lives in `packages/shared/src/schema.ts` — single source of truth.
- Dialect: `sqlite` (D1). Enums are string literals from `packages/shared/src/constants.ts`.
- Generate migrations from the shared package: `pnpm --filter @skald-scan/shared generate` (runs `drizzle-kit generate`). Output goes to `packages/shared/drizzle/`. Existing migrations are committed (`0000`…`0005`).
- `manga_fts` is a **manual FTS5 virtual table** with triggers (`mangaFtsSql` / `mangaFtsStatements` in schema.ts) — it is NOT managed by drizzle-kit. Apply those raw statements separately if you set up a fresh DB.
- `processedJobs` table is the idempotency store for queue workers — every worker must check it before doing work (see `handleImportManga`).

## MangaDex sync flow

`import.post.ts` → queue `import-manga` → `handleImportManga` (inserts manga + `mangaDexSync` row, enqueues `sync-chapters`) → `handleSyncChapters` → `handleDownloadPages`. The cron at `/api/cron/sync-chapters` (use `scheduled-sync.ts`) finds due rows and enqueues `sync-chapters`. Note `server/cron/sync-check.ts` is a second, older cron implementation that uses the wrong binding name — prefer `api/cron/sync-chapters.ts`.

## Reader → Dashboard proxy

Reader has no DB/auth of its own. `apps/reader/server/api/proxy/[...].ts` forwards `/api/proxy/*` to `runtimeConfig.public.dashboardUrl` (default `http://localhost:3000`). CORS is wide open (`*`) on `/api/**` in reader's `nuxt.config.ts` — by design, since the reader is a separate origin. Do not add auth to reader; add it to the proxied dashboard endpoints.

## Testing

- vitest per-package. Dashboard: `server/__tests__/**/*.test.ts`. Shared: `src/__tests__/**/*.test.ts`. Reader has only a smoke `setup.test.ts`.
- Dashboard tests do **not** boot Nuxt — they import handler functions directly and construct fake `event` objects with `context.cloudflare.env`, `context.body`, `context.params`, `context.authSession`. Follow the `createEvent` pattern in `server/__tests__/sync-engine.test.ts` when adding handler tests.
- `h3` and `drizzle-orm/d1` are frequently `vi.mock`ed at the top of test files. Reader's vitest sets `globals: true`; dashboard and shared do not — import `describe/it/expect` from `vitest` explicitly.

## Style

- ESLint via `@nuxt/eslint` with stylistic overrides: **`commaDangle: "never"`, `braceStyle: "1tbs"`** (set per-app in each `nuxt.config.ts`). Match this — default ESLint/Prettier will reformat you.
- 2-space indent, LF, UTF-8, trim trailing whitespace (`.editorconfig`). Markdown keeps trailing whitespace.
- Imports from the shared package use the bare specifier `@skald-scan/shared` (configured via pnpm workspace + `exports`). Do not use relative paths into `packages/shared/src`.
- Tailwind v4 + Nuxt UI v3. CSS entry: `~/assets/css/main.css` in each app.

## Things that will trip you up

- **`postinstall` runs `nuxt prepare`** in both apps. If `@nuxt/eslint`'s generated config (`./.nuxt/eslint.config.mjs`) is missing (e.g. after a clean clone without prepare), root `eslint.config.mjs` will fail to load. Run `pnpm install` or `pnpm --filter <app> postinstall` to regenerate.
- **`tsconfig.json` at root references `.nuxt/tsconfig.*.json`** which only exist after `nuxt prepare`. Type-checking a clean clone without install will fail with missing references.
- **`dist/` in `packages/shared` is committed in `.gitignore`** but `tsc` emits there. Apps still import from `src`, so `dist` is effectively dead unless someone changes the `exports` field — don't rely on it.
- `.omo/` and `.sisyphus/` are agent runtime state (boulder plans, session lineage, evidence). Do not hand-edit; do not commit changes to them as part of a feature.
- `apps/reader/.nuxtrc` pins `@nuxt/test-utils` setup — leave it unless you know why.
- Crypto: handlers use global `crypto.randomUUID()` (available in Workers + Node 22). Don't import `node:crypto`.
