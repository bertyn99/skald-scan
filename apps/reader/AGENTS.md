# apps/reader

Public reader. **Deliberately stateless** — no auth, no direct DB writes, no queue access. All data flows through the dashboard proxy. See root `AGENTS.md` for the monorepo picture.

## The one rule

**Do not add auth, sessions, or direct DB/queue access to this app.** Reader is a separate origin by design. If an endpoint needs protection, protect it on the dashboard side — reader just forwards credentials via headers.

## How it works

`server/api/proxy/[...].ts` forwardser: strips `/api/proxy`, calls `runtimeConfig.public.dashboardUrl` (default `http://localhost:3000`), passes through method/body/headers (minus `host`), streams the response body back. CORS `*` on `/api/**` is set in `nuxt.config.ts` `routeRules` — intentional, leave it.

`app/composables/`: `useReader`, `useProgressSync`, `useOfflineCache` — client-side reading state + progress reporting via the proxy.

## Gotchas

- `.nuxtrc` pins `@nuxt/test-utils` setup. Don't remove unless you understand why it's pinned.
- Reader's `vitest.config.ts` sets `globals: true` (unlike dashboard/shared) — `describe`/`it`/`expect` are available without imports. Only `setup.test.ts` exists; it's a smoke test.
- Reader deploys with `DB` + `STORAGE` bindings (see its `alchemy.run.ts`) but server code doesn't use them today — they're wired in case cover/page serving moves here. Don't assume reader is read-only because it lacks bindings.
