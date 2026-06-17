# apps/dashboard

Admin + auth app. Owns every write path and the entire MangaDex sync pipeline. See root `AGENTS.md` for monorepo-wide context (bindings table, the `SYNC_QUEUE` vs `MANGADEX_SYNC_QUEUE` inconsistency, deploy flow) — this file covers dashboard-local contracts only.

## Server layout

```
server/api/
  auth/[...].ts                 Better Auth catch-all handler. Bypassed by middleware.
  admin/                        requireAdminRole gated. stats/, users/ (role mutation).
  manga/                        CRUD + chapters + pages + cover. Writes gated.
  mangadex/                     import.post.ts (enqueues), search.get.ts, import/status/.
  reading-progress/             Per-user progress. Authenticated.
  storage/                      upload-url.post.ts (presigned R2), upload-zip.post.ts (extract-zip enqueue).
  cron/sync-chapters.ts         Scheduled entry. USE THIS, not server/cron/sync-check.ts.
server/cron/sync-check.ts       Legacy. Uses wrong binding name (MANGADEX_SYNC_QUEUE). Do not extend.
server/middleware/auth.ts       Runs on everything except /api/auth/**. Sets context.auth + context.authSession.
server/plugins/queue-handler.ts Nitro hook `cloudflare:queue`. Handles import-manga | sync-chapters | download-pages.
                                Does NOT handle extract-zip (see root AGENTS.md bug note).
server/services/                Queue worker implementations. Each checks processedJobs for idempotency.
server/utils/storage.ts         Binding accessors + auth gates + readEventBody/Query/Param. USE THESE.
server/utils/auth.ts            Per-event Better Auth factory. Falls back to memory adapter when env.DB absent.
server/types/auth.d.ts          H3EventContext augmentation. Update if you add authSession fields.
lib/auth.ts                     Browser Better Auth client (basePath: '/api/auth').
```

## Contracts an agent dropped here must follow

**Never reach into `event.context.cloudflare.env.X` directly.** Go through `server/utils/storage.ts`:

- `getDatabaseFromEvent` / `getStorageFromEvent` / `getSyncQueueFromEvent` — throw with a clear message if the binding is missing. The one exception is legacy code still on `MANGADEX_SYNC_QUEUE` (see root bug note); reconcile to `SYNC_QUEUE` when you touch it, don't add more.
- `requireAuthenticatedSession(event)` → 401 if no session. `requireAdminRole(event)` → 403 if role ≠ `admin`. Compose them — don't re-implement role checks.
- `readEventBody` / `readEventQuery` / `readEventParam` read from `event.context` first (tests inject there), then fall back to h3. Always use these in handlers so tests can inject without h3.

**Auth middleware contract**: `server/middleware/auth.ts` populates `event.context.auth` (the Better Auth instance) and `event.context.authSession` (the resolved session or `null`). It short-circuits `/api/auth/**`. If you add a route that should bypass auth, match the prefix in the middleware — don't add per-route guards.

**Queue handler extension**: to support a new message type, add a `case` in `server/plugins/queue-handler.ts` AND a handler in `server/services/`. Every handler must (1) check `processedJobs` before doing work, (2) mark it `processing` then `completed`/`failed`. See `handleImportManga` for the canonical pattern.

**Cron**: prefer `server/api/cron/sync-chapters.ts` (calls `scheduled-sync.ts`, uses correct `SYNC_QUEUE`). `server/cron/sync-check.ts` is the older implementation with the wrong binding name — do not extend it.

## Testing pattern (do not boot Nuxt)

Tests import handler functions directly and build a fake `event`. Copy the `createEvent` fixture from `server/__tests__/sync-engine.test.ts`:

```ts
const event = createEvent({
  auth: true,                                   // sets context.authSession
  env: { MANGADEX_SYNC_QUEUE: { send: vi.fn() } }, // override context.cloudflare.env
  body: { mangaDexId: 'md-1' },
  params: { jobId: 'job-1' },
  query: { ... },
})
```

- Mock at top of file: `vi.mock('h3', ...)` to stub `readBody`, `vi.mock('drizzle-orm/d1', ...)` to stub the query builder.
- Import `describe/it/expect/beforeEach` from `vitest` explicitly — `globals: true` is NOT set here (unlike reader).
- The auth fixture uses `MANGADEX_SYNC_QUEUE` because the handlers under test still read that name; if you're testing code you've reconciled to `SYNC_QUEUE`, update the fixture accordingly.

## App-side

`app/pages/admin/` and `app/components/admin/` are the admin UI. Browser auth goes through `lib/auth.ts` (`authClient`) which hits `/api/auth/*`. Tailwind v4 + Nuxt UI v3, entry `~/assets/css/main.css`.
