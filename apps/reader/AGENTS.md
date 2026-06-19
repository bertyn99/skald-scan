# apps/reader

Public reader for end users. Server-side: stateless BFF proxy only. Client-side: Bearer auth for user APIs (progress, collections).

## Architecture

- `server/api/proxy/[...].ts` — strips `/api/proxy`, normalizes to dashboard `/api/*`, forwards headers (including `Authorization`).
- `lib/auth.ts` + `useAuthSession` — Better Auth client against dashboard `/api/auth` with Bearer token storage.
- Catalog/pages are public via proxy; user routes require sign-in.

## Composables

- `useProgressSync` — debounced progress PUT with `updatedAt` stale-client guard
- `useOfflineCache` / service worker — offline page cache
- `canReadChapter` — P3 credit hook stub (always allows today)

## Gotchas

- Proxy paths: use `dashboardApi('/manga')` helper; proxy prepends `/api` when missing.
- `.nuxtrc` pins `@nuxt/test-utils` setup.
- Reader `vitest` uses `globals: true`.
- `DB` + `STORAGE` bindings exist in `alchemy.run.ts` for optional future edge page serving.
