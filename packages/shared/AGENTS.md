# packages/shared

`@skald-scan/shared` — single source of truth for the DB schema, MangaDex client, and shared types. Consumed by both apps via `workspace:*`. See root `AGENTS.md` for how apps import it.

## Critical facts

- **Apps import straight from `src/`** — `package.json` `main`/`exports` point at `./src/index.ts`. The `build` script (`tsc` → `dist/`) exists but `dist/` is gitignored and unused by apps. Editing `src/` is live; no build step needed for local dev.
- **Use the bare specifier `@skald-scan/shared`** from apps, never relative paths into `packages/shared/src`. The workspace + `exports` field resolve it.
- **Schema is the DB truth.** `src/schema.ts` is the one place tables are defined. `drizzle-kit generate` reads it to emit migrations into `drizzle/`.

## Submodules

```
src/
  schema/           Drizzle table defs, split by concern. Source of truth.
    index.ts          Barrel.
    auth.ts           users/sessions/accounts/verifications (Better Auth tables).
    catalog.ts        manga/chapters/pages/mangaDexSync/mangaTranslations
                      + mangaFtsSql / mangaTranslationsFtsSql (manual FTS5).
    library.ts        collections/collectionManga/readingProgress.
    jobs.ts           processedJobs (queue idempotency).
  constants.ts     String-literal enums (MangaStatus, SyncStatus, UserRole,
                   ChapterStatus, Language) + DEFAULT_LANGUAGES +
                   parseLanguageList/isLanguageCode helpers.
  types.ts         Domain types (InferSelectModel/InferInsertModel per table).
  api-types.ts     Request/response shapes for the dashboard API.
  mangadex/
    client.ts      MangaDexClient — fetch + retry/backoff (429 AND 5xx),
                   injectable fetch/sleep/random for tests. getAllMangaChapters
                   paginates the feed (fixes the default-limit-10 bug).
    types.ts       MangaDex API shapes.
    index.ts       Re-export.
  index.ts         Barrel. Re-exports everything below.
```

## Migrations

- Generate: `pnpm --filter @skald-scan/shared generate` → `drizzle-kit generate` → writes `drizzle/NNNN_*.sql`. Migrations are committed (`0000`…`0004`).
- Dialect: `sqlite` (D1). Config in `drizzle.config.ts`.
- **Application order is significant**: `0000` → `0001` → `0002` → `0003` → `0004`. `0003` (FTS) references `manga_translations` from `0002`; `0004` (backfill) seeds rows that the FTS triggers in `0003` need to exist.
- **`manga_fts` and `manga_translations_fts` are NOT drizzle-managed.** They are manual FTS5 virtual tables + triggers exported as `mangaFtsSql` / `mangaFtsStatements` and `mangaTranslationsFtsSql` / `mangaTranslationsFtsStatements` in `schema/catalog.ts`. drizzle-kit won't create or update them — apply those `sql.raw(...)` statements separately when bootstrapping a fresh DB.
- **`_journal.json` is drizzle-kit-owned** for drizzle-managed migrations (`0000`, `0002`). The manual entries for `0001`, `0003`, `0004` are hand-appended with `"manual": true`. After every future `drizzle-kit generate`, verify the journal still contains `0000`…`0004` in order before committing.
- **`manga_translations` must remain a rowid table** (NOT `WITHOUT ROWID`). The `manga_translations_fts` triggers reference `new.rowid` / `old.rowid`. Drizzle's composite `primaryKey({ columns: [mangaId, language] })` does NOT emit `WITHOUT ROWID`, so this is the default — but a future "optimization" adding `WITHOUT ROWID` would silently break the FTS triggers.
- `processedJobs` table is the queue-worker idempotency store. Every worker in `apps/dashboard/server/services/` must check it before doing work. The `claimQueueJob` helper uses an atomic `INSERT … ON CONFLICT DO NOTHING RETURNING` — do not regress to a `SELECT`-then-`INSERT` pattern.

## i18n (manga translations)

- `manga_translations` holds per-language metadata (title, description, alt_titles, tags). The `manga.title` / `manga.description` columns remain the canonical fallback (EN).
- **`alt_titles` is a JSON string array** (e.g. `["Alt One","Alt Two"]`), NOT the raw MangaDex `[{en:"..."}]` object array. The import/sync services flatten per-language values at insert time so the FTS trigger can tokenize them via `json_each`. Do not store the raw object shape — FTS will index JSON object strings instead of titles.
- `mangaDexSync.languages` (JSON string array) overrides `DEFAULT_LANGUAGES` per manga. `NULL` → use the default set.
- `mangaDexSync.lastMetadataRefreshAt` bounds the lazy metadata refresh in `handleSyncChapters` to at most 1/day/manga. Do not remove the timestamp update — without it the 30-min cron will call MangaDex every run.

## Testing

- `src/__tests__/**/*.test.ts`, vitest, `environment: 'node'`, `globals: true` is NOT set — import from `vitest` explicitly.
- The MangaDex client is tested by injecting `fetch`/`sleep`/`random` mocks via the constructor options — don't monkey-patch globals.
- **Drizzle typed selects use `.bind(...).raw()`** under the hood (not `.all()`). Test mocks for D1 must populate BOTH the `all()` and `raw()` return shapes — see the `rawForSql` / `allForSql` helpers in `apps/dashboard/server/__tests__/services.test.ts` for the pattern.
