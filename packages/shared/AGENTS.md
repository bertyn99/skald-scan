# packages/shared

`@skald-scan/shared` — single source of truth for the DB schema, MangaDex client, and shared types. Consumed by both apps via `workspace:*`. See root `AGENTS.md` for how apps import it.

## Critical facts

- **Apps import straight from `src/`** — `package.json` `main`/`exports` point at `./src/index.ts`. The `build` script (`tsc` → `dist/`) exists but `dist/` is gitignored and unused by apps. Editing `src/` is live; no build step needed for local dev.
- **Use the bare specifier `@skald-scan/shared`** from apps, never relative paths into `packages/shared/src`. The workspace + `exports` field resolve it.
- **Schema is the DB truth.** `src/schema.ts` is the one place tables are defined. `drizzle-kit generate` reads it to emit migrations into `drizzle/`.

## Submodules

```
src/
  schema.ts        Drizzle table defs. Source of truth.
  constants.ts     String-literal enums (MangaStatus, SyncStatus, UserRole, ChapterStatus, Language).
                   These ARE the enum values stored in DB columns — don't rename without a migration.
  types.ts         Domain types.
  api-types.ts     Request/response shapes for the dashboard API.
  mangadex/
    client.ts      MangaDexClient — fetch + retry/backoff, injectable fetch/sleep/random for tests.
    types.ts       MangaDex API shapes.
    index.ts       Re-export.
  index.ts         Barrel. Re-exports everything below.
```

## Migrations

- Generate: `pnpm --filter @skald-scan/shared generate` → `drizzle-kit generate` → writes `drizzle/NNNN_*.sql`. Migrations are committed (`0000`…`0002`).
- Dialect: `sqlite` (D1). Config in `drizzle.config.ts`.
- **`manga_fts` is NOT drizzle-managed.** It's a manual FTS5 virtual table + triggers exported as `mangaFtsSql` / `mangaFtsStatements` in `schema.ts`. drizzle-kit won't create or update it — apply those `sql.raw(...)` statements separately when bootstrapping a fresh DB.
- `processedJobs` table is the queue-worker idempotency store. Every worker in `apps/dashboard/server/services/` must check it before doing work.

## Testing

- `src/__tests__/**/*.test.ts`, vitest, `environment: 'node'`, `globals: true` is NOT set — import from `vitest` explicitly.
- The MangaDex client is tested by injecting `fetch`/`sleep`/`random` mocks via the constructor options — don't monkey-patch globals.
