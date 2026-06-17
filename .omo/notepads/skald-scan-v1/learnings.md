# Learnings

## T1 Research — Monorepo + Alchemy Setup

### Alchemy.run Patterns
- Root `alchemy.run.ts` exports shared resources: `export const db = await D1Database("database")`
- App-level imports via relative path: `import { db } from "../alchemy.run"`
- Nuxt integration: `Nuxt("name", { bindings: { DB: db } })`
- Cross-app exports via `package.json` `"./alchemy": "./alchemy.run.ts"`
- Alchemy scripts: `"dev": "alchemy dev --app dashboard"`
- turbo.json includes deploy/destroy tasks with dependency chains

### Turborepo + Nuxt
- Official example: `pnpm dlx create-turbo@latest -e with-vue-nuxt`
- turbo.json outputs MUST include `.nuxt/**` and `.output/**`
- Dev mode: `cache: false, persistent: true`
- Nuxt 4.4.2 is current (plan says Nuxt 3 but we use latest)
- Nuxt UI v4.6 includes Tailwind v4 — no separate tailwind config needed

### Shared Package
- Direct TS imports work in monorepo: `"main": "./src/index.ts"` 
- No build step needed — Nuxt handles TS compilation
- Drizzle schema in shared, client instantiation in each app with D1 binding

### Current Project State
- Nuxt UI starter template (Nuxt 4.4.2, Nuxt UI 4.6, Tailwind 4.2.2)
- pnpm 10.33, Node 22.20
- Needs full restructure into monorepo

## T1 Implementation — Monorepo + Alchemy IaC Init
### Successful Patterns
- pnpm catalog works but apps must use explicit versions if `catalog:` syntax fails
- Root `alchemy.run.ts` exports shared resources for all apps to import
- `apps/*/` and `packages/*/` workspace structure works well
- Nuxt UI v3.2.0 with Nuxt 3.17.5 builds successfully
- Turbo 2.9.5 handles parallel builds efficiently (3 packages in ~25s)

### Issues Encountered
- pnpm `catalog:` syntax had issues - used explicit versions instead
- `@nuxt/ui` v3 vs v4 version confusion - v3.2.0 is current stable
- Use `pnpm.ignoredBuiltDependencies` (not `ignoredBuiltDependencies`)

### Directory Structure Created
```

## T2 Implementation — Shared Drizzle Schema
- Drizzle D1 date defaults with `integer(..., { mode: 'timestamp_ms' })` expect `Date` return types; using numeric unix-ms defaults via `Date.now()` is safest with plain `integer(...)` for this schema.
- Drizzle `sqliteTable` third param array syntax (`(table) => [index(...)]`) works cleanly for explicit index assertions via `getTableConfig(table).indexes` in Vitest.
- FTS5 virtual tables/triggers are best carried as explicit SQL statements (`mangaFtsSql`) and validated in tests, since Drizzle schema DSL does not model SQLite FTS virtual tables directly.
skald-scan/
├── apps/
│   ├── dashboard/    (admin dashboard, port 3000)
│   │   ├── app/app.vue
│   │   ├── assets/css/main.css
│   │   ├── nuxt.config.ts
│   │   ├── alchemy.run.ts
│   │   └── package.json
│   └── reader/        (public reader, port 3001)
│       └── (same structure)
├── packages/
│   └── shared/        (@skald-scan/shared)
│       ├── src/index.ts
│       ├── package.json
│       └── tsconfig.json
├── alchemy.run.ts     (shared D1, R2, KV, Queue)
├── turbo.json
├── package.json      (root workspace)
└── pnpm-workspace.yaml
```

## Reader Setup / Nuxt UI v3
- Nuxt UI v3 uses Tailwind v4 internally and doesn't require a separate `tailwind.config`.
- `@nuxt/test-utils` and `happy-dom` in a Nuxt turborepo context might have dependency conflicts with `bun:test` and tsconfig. Using pure vitest without nuxt test environments for API proxies is much simpler and more stable.
- BFF Proxies in Nuxt using `h3` (`defineEventHandler`, `fetch`, `setResponseHeaders`) provides an easy way to decouple API origins.

## T3 Implementation — Dashboard Better Auth Scaffold
- Better Auth + Cloudflare D1 works in Nuxt Nitro when the auth instance is created per-request from `event.context.cloudflare?.env.DB`; fallback to `memoryAdapter` keeps Vitest node tests deterministic without Cloudflare bindings.
- Existing shared Drizzle tables can be reused by mapping Better Auth models via adapter schema + modelName/field mapping (`user -> users`, `session -> sessions`, `image -> image_url`, `ipAddress/userAgent -> snake_case`).
- For Nuxt server routes, convert H3 events with `toWebRequest(event)` and return Better Auth responses with `sendWebResponse(event, response)` in catch-all `/server/api/auth/[...].ts`.
- Middleware can safely skip auth routes with `event.path.startsWith(/api/auth)` and attach `event.context.auth` + `event.context.authSession`; in tests, guard `getRequestHeaders` behind `event.node?.req`.
- Dashboard Vitest in monorepo needs local `apps/dashboard/tsconfig.json` extending `./.nuxt/tsconfig.json` to avoid accidental root `tsconfig` references during test transforms.

## T6 Implementation — Shared MangaDex Client
- MangaDex client should always send `User-Agent: SkaldScan/1.0 (+https://github.com/skald-scan)` and `Accept: application/json`; tests can assert this directly from mocked fetch init headers.
- MangaDex chapter page URLs come from `GET /at-home/server/{chapterId}` using `baseUrl + /data/{dataHash}/{file}` and are stable enough to store/cache indefinitely for this project.
- Rate-limit handling needs both proactive waits (from `X-RateLimit-Retry-After`) and retry backoff for 429; tests are more reliable when asserting minimum delay behavior instead of exact sleep-call counts.
- Default content ratings for search should include `safe`, `suggestive`, and `pornographic`, while excluding `erotica` unless explicitly requested.

## T5 Execution — Storage API (Partial, Needs Fix)
- Drizzle table `._.name` property does NOT resolve in Vitest test environment when tables are imported from shared package. Use Drizzle query builder (`.from(manga).select()`) or literal table name strings instead.
- The `unspecified-high` category model does NOT execute tasks — completes in ~30s without creating files. Always use `deep` category.
- R2 presigned URLs and ZIP upload with queue enqueue DO work correctly (4/11 tests pass). The issue is isolated to CRUD routes that use raw SQL with `._.name`.

## General Discoveries
- **Agent category `unspecified-high` is BROKEN** — always use `deep` instead. Confirmed by T2 failing twice with `unspecified-high` then succeeding with `deep`.
- **Vitest version mismatch**: dashboard=3.2.4, shared=3.2.4, reader=4.1.3. Need to standardize on v4+ for nitro-test-utils.
- **nitro-test-utils**: User explicitly requested adoption. Requires Vitest v4+ and Nitro v3. Provides `$fetchRaw`, Cloudflare bindings emulation, session-aware testing.
- **Nuxt UI version**: v3.2.0 is current stable (NOT v4). Uses Tailwind v4 internally.
