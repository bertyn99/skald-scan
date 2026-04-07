# Skald Scan V1 — Shared Manga Library

## TL;DR

> **Quick Summary**: Build a shared manga reader web app with MangaDex auto-import, offline downloads, and reading progress tracking. Two Nuxt apps (dashboard+API and reader) in a Turborepo monorepo, all Cloudflare infrastructure managed by Alchemy.run TypeScript IaC.
>
> **Deliverables**:
> - Turborepo monorepo with Alchemy.run IaC
> - Dashboard app (Nuxt 3 + Nuxt UI) — admin panel + API backend + Better Auth
> - Reader app (Nuxt 3 + Nuxt UI) — manga library browser + vertical scroll reader
> - Shared package — Drizzle schema, types, constants, MangaDex API client
> - Cloudflare infrastructure — D1, R2, KV, Queues, Cron (all via Alchemy.run)
> - MangaDex auto-import with Cron-based chapter sync
> - Reading progress tracking with offline merge
> - CBZ export + in-app chapter caching
>
> **Estimated Effort**: XL (16 implementation tasks + 4 verification tasks)
> **Parallel Execution**: YES — 7 waves
> **Critical Path**: T1 → T2 → T3 → T5 → T7 → T11 → T12 → T15 → F1-F4

---

## Context

### Original Request
Build a manga/scan reader web app for personal use and sharing with friends. Features: store manga, read in vertical scroll, resume reading where left off. Evolved into shared library with MangaDex auto-import, offline downloads, multi-user auth.

### Interview Summary
**Key Discussions**:
- **Architecture**: User wanted to know monorepo vs single app → Researched Alchemy.run → Decided on Turborepo monorepo with Alchemy IaC
- **App Split**: Started as 3 apps (backend, admin, reader) → Simplified to 2 apps (dashboard+API, reader) per user preference
- **Tech Stack**: Nuxt 3 + Nuxt UI for both apps, Better Auth, Drizzle ORM + D1, R2 for storage
- **Scope**: Full V1 including MangaDex auto-import, offline downloads, reading progress
- **Testing**: TDD (Red-Green-Refactor)

**Research Findings**:
- **Tachiyomi patterns**: Priority queue image loading, chapter cache, parallel downloads, vertical scroll reader
- **MangaDex API**: Official REST API with search, manga details, chapter pages, cover art
- **Alchemy.run**: TypeScript IaC with built-in Turborepo support, Nuxt template, cross-app binding imports
- **Cloudflare costs**: $7.70-$17.78/mo for paid plan

### Metis Review
**Identified Gaps** (addressed):
- **Cross-domain auth**: Dashboard and reader on different subdomains → Better Auth needs cross-domain cookie config (auto-resolved: same Cloudflare zone, CORS configured)
- **Upload size limits**: Workers 100MB limit → R2 presigned URLs for direct upload (auto-resolved)
- **Offline definition**: Both CBZ export AND in-app Service Worker cache (auto-resolved)
- **Image optimization**: Cloudflare Polish/Image Resizing for bandwidth savings (auto-resolved, included in storage task)
- **MangaDex rate limiting**: ALL sync via Queues with concurrency limits (guardrail added)
- **Progress merge conflict**: Latest timestamp wins (auto-resolved)
- **MangaDex chapter deletions**: Soft-delete with "unavailable" status (auto-resolved)
- **Scope creep lock**: Vertical scroll only, MangaDex only, no social features (guardrails added)

---

## Work Objectives

### Core Objective
Build a shared manga library web application deployed on Cloudflare where users can upload manga, auto-import from MangaDex, read in a vertical scroll reader, and track reading progress across devices.

### Concrete Deliverables
- Working Turborepo monorepo with `apps/dashboard`, `apps/reader`, `packages/shared`
- Alchemy.run TypeScript IaC files for all Cloudflare resources
- Dashboard app with admin UI, Better Auth, API routes, queue consumers, cron triggers
- Reader app with library browser, MangaDex search, vertical scroll reader, progress tracking
- CBZ/PNG upload pipeline with R2 presigned URLs
- MangaDex auto-import with Queue-based background processing
- Reading progress with offline merge and CBZ export

### Definition of Done
- [ ] `pnpm turbo run build` succeeds for all workspaces
- [ ] `pnpm turbo run test` passes all Vitest suites
- [ ] User can authenticate via Better Auth on both apps
- [ ] User can upload manga images via dashboard
- [ ] User can search MangaDex and trigger import
- [ ] User can read manga in vertical scroll reader
- [ ] Reading progress persists across sessions
- [ ] Cron detects new MangaDex chapters automatically

### Must Have
- Better Auth with role-based access (admin, reader)
- Drizzle ORM schema for D1 (users, manga, chapters, pages, reading_progress, manga_dex_sync)
- R2 presigned URL upload pipeline for images and ZIP/CBZ
- MangaDex API integration with rate-limited Queue consumer
- Vertical scroll reader with lazy loading and virtualization
- Reading progress tracking with debounced sync
- Cron trigger for chapter sync (every 30 min)
- Cross-app CORS configuration for dashboard ↔ reader communication
- Alchemy.run IaC for ALL Cloudflare resources

### Must NOT Have (Guardrails)
- ❌ NO right-to-left, double-page, or horizontal reader modes (vertical scroll only for V1)
- ❌ NO scanlation site scraper/plugin system (MangaDex only for V1)
- ❌ NO comments, ratings, social features, or shared reading lists
- ❌ NO apps importing from each other (all shared code goes through `packages/shared`)
- ❌ NO direct MangaDex API calls FROM CLIENT-SIDE code (ALL proxied through dashboard API or server routes; reader search via BFF proxy is OK)
- ❌ NO raw unoptimized images served to mobile (use Cloudflare Polish or resize)
- ❌ NO over-abstracted plugin systems (YAGNI for V1)
- ❌ NO excessive JSDoc/comments on every line (AI slop guard)
- ❌ NO `as any`, `@ts-ignore`, or empty catch blocks

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (greenfield project)
- **Automated tests**: TDD (Red-Green-Refactor)
- **Framework**: Vitest
- **Each task follows RED (failing test) → GREEN (minimal impl) → REFACTOR**

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright — navigate, interact, assert DOM, screenshot
- **API/Backend**: Use Bash (curl) — send requests, assert status + response fields
- **Library/Module**: Use Bash (bun test) — import, call functions, verify output

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — foundation):
└── T1:  Monorepo + Alchemy IaC init [unspecified-high]

Wave 2 (After Wave 1 — data layer):
└── T2:  Shared package — Drizzle schema + types [unspecified-high]

Wave 3 (After Wave 2 — app scaffolds, MAX PARALLEL):
├── T3:  Dashboard app scaffold + Better Auth [deep]
└── T4:  Reader app scaffold + Nuxt UI [visual-engineering]

Wave 4 (After Wave 3 — infrastructure + core APIs):
├── T5:  Storage API — R2 upload + image serving [unspecified-high]
└── T6:  MangaDex API client in shared [unspecified-high]

Wave 5 (After Wave 4 — features, MAX PARALLEL):
├── T7:  MangaDex sync engine — Queues + Cron [unspecified-high]
├── T8:  Admin library management UI [visual-engineering]
├── T9:  Reader — manga library browser [visual-engineering]
└── T10: Reader — MangaDex search & import UI [visual-engineering]

Wave 6a (After Wave 5 — reader core, part 1):
├── T11: Vertical scroll reader component [deep]  ← must complete before T12
├── T13: Admin dashboard overview + user management [visual-engineering]
└── T14: Image optimization pipeline [unspecified-high]

Wave 6b (After T11 — reader core, part 2):
└── T12: Reading progress tracking [unspecified-high]  ← depends on T11

Wave 7 (After Wave 6 — advanced features):
├── T15: Offline downloads — CBZ export + in-app cache [deep]
└── T16: MangaDex chapter sync — Cron + new chapter detection [unspecified-high]

Wave FINAL (After ALL tasks — 4 parallel reviews):
├── F1: Plan compliance audit [oracle]
├── F2: Code quality review [unspecified-high]
├── F3: Real manual QA [unspecified-high]
└── F4: Scope fidelity check [deep]
→ Present results → Get explicit user okay

Critical Path: T1 → T2 → T3 → T5 → T7 → T11 → T12 → T15 → F1-F4
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 4 (Waves 5 and 6)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| T1   | — | T2 | 1 |
| T2   | T1 | T3, T4, T5, T6 | 2 |
| T3   | T2 | T5, T7, T8, T13 | 3 |
| T4   | T2 | T9, T10, T11 | 3 |
| T5   | T2, T3 | T7, T8, T9, T11, T14 | 4 |
| T6   | T2 | T7, T10, T16 | 4 |
| T7   | T5, T6 | T16 | 5 |
| T8   | T3, T5 | — | 5 |
| T9   | T4, T5 | — | 5 |
| T10  | T4, T6 | — | 5 |
| T11  | T4, T5 | T12, T15 | 6 |
| T12  | T11, T3 | — | 6 |
| T13  | T3, T5 | — | 6 |
| T14  | T5 | — | 6 |
| T15  | T11, T12 | — | 7 |
| T16  | T7 | — | 7 |

### Agent Dispatch Summary

| Wave | Tasks | Agents |
|------|-------|--------|
| 1 | 1 | T1 → `unspecified-high` |
| 2 | 1 | T2 → `unspecified-high` |
| 3 | 2 | T3 → `deep`, T4 → `visual-engineering` |
| 4 | 2 | T5 → `unspecified-high`, T6 → `unspecified-high` |
| 5 | 4 | T7 → `unspecified-high`, T8 → `visual-engineering`, T9 → `visual-engineering`, T10 → `visual-engineering` |
| 6 | 4 | T11 → `deep`, T12 → `unspecified-high`, T13 → `visual-engineering`, T14 → `unspecified-high` |
| 7 | 2 | T15 → `deep`, T16 → `unspecified-high` |
| FINAL | 4 | F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep` |

---

## TODOs

---

- [x] 1. **Monorepo + Alchemy IaC Init**

  **What to do**:
  - Initialize Turborepo monorepo (`pnpm` workspaces, `packages/shared`, `apps/dashboard`, `apps/reader`)
  - Create root `alchemy.run.ts` with shared D1, R2, KV, Queue bindings
  - Create root `turbo.json` with build/test/lint pipelines
  - Create root `package.json` with workspace config
  - Create root `pnpm-workspace.yaml`
  - Add `alchemy` as dev dependency
  - Initialize each app with `alchemy create --template=nuxt` (or manual Nuxt scaffold)
  - Setup Tailwind CSS + Nuxt UI base config in both apps
  - Configure `pnpm` catalog for shared dependency versionsing

  **Must NOT do**:
  - NO apps importing from each other (shared code via `packages/shared` ONLY)
  - NO `wrangler.toml` files (use `alchemy.run.ts` ONLY)
  - NO custom plugin systems for scanlation site scraping (MangaDex only for V1)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`pnpm`, `turborepo`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 1, solo)
  - **Parallel Group**: Wave 1 (solo)
  - **Blocks**: T2
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - Alchemy Turborepo guide: `https://alchemy.run/guides/turborepo/` — Full monorepo setup example
  - Alchemy Quickstart: `https://alchemy.run/quickstart/` — First Worker deployment

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Monorepo builds successfully
    Tool: Bash
    Steps:
      1. `pnpm install` — verify workspace symlinks resolve
      2. `pnpm turbo run build` — expect exit code 0 (empty builds are OK)
      3. Verify `apps/dashboard`, `apps/reader`, `packages/shared` directories exist
    Expected Result: All workspaces resolve and build without errors
    Failure Indicators: Missing directories, broken symlinks, build errors
    Evidence: .sisyphus/evidence/task-1-monorepo-build.txt

  Scenario: Alchemy config is valid
    Tool: Bash
    Steps:
      1. `npx alchemy --version` — verify CLI installed
      2. Verify `alchemy.run.ts` files exist in root and each app
    Expected Result: Alchemy CLI available, config files parse correctly
    Failure Indicators: CLI not found, TypeScript syntax errors in config
    Evidence: .sisyphus/evidence/task-1-alchemy-config.txt
  ```

  **Commit**: YES
  - Message: `feat(infra): initialize turborepo monorepo with alchemy IaC`
  - Files: `pnpm-workspace.yaml`, `turbo.json`, `package.json`, `alchemy.run.ts`, `apps/dashboard/`, `apps/reader/`, `packages/shared/`
  - Pre-commit: `pnpm install && pnpm turbo run build`

- [x] 2. **Shared Package — Drizzle Schema + Types**

  **What to do**:
  - Setup Drizzle ORM in `packages/shared` with D1 adapter
  - Define schema: `users`, `sessions` (for Better Auth), `manga`, `chapters`, `pages`, `reading_progress`, `collections`, `manga_dex_sync`
  - Export TypeScript types for all entities
  - Create `packages/shared/src/constants.ts` with enums: MangaStatus, SyncStatus, UserRole, etc.
  - Generate initial Drizzle migration SQL
  - Write TDD tests: schema validation, type constraints, migration generation

  **Must NOT do**:
  - NO business logic or service functions (pure data layer)
  - NO API routes or handlers

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`drizzle-orm-d1`, `vitest`, `tdd`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (Wave 2, solo)
  - **Parallel Group**: Wave 2 (solo)
  - **Blocks**: T3, T4, T5, T6
  - **Blocked By**: T1

  **References**:

  **External References**:
  - Drizzle D1 docs: `https://orm.drizzle.team/docs/databases/d1`
  - Drizzle schema overview: `https://orm.drizzle.team/docs/schemas/overview`

  **Acceptance Criteria**:
  - [ ] Test file: `packages/shared/src/__tests__/schema.test.ts`
  - [ ] `bun test packages/shared` → PASS
  - [ ] Migration file generated and valid SQL

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Schema generates valid migrations
    Tool: Bash
    Steps:
      1. `cd packages/shared && bunx drizzle-kit generate`
      2. Verify migration SQL contains CREATE TABLE statements for all tables
      3. Verify foreign key references are valid
    Expected Result: Migration file created with valid SQL for users, manga, chapters, pages, reading_progress, collections, manga_dex_sync tables
    Failure Indicators: Missing tables, invalid SQL syntax, foreign key errors
    Evidence: .sisyphus/evidence/task-2-schema-migrations.txt

  Scenario: Type safety enforced
    Tool: Bash
    Steps:
      1. Create test that tries inserting invalid data (e.g., manga without required fields)
      2. Run `bun test` — expect TypeScript errors for invalid data
    Expected Result: TypeScript compilation fails with helpful error messages for invalid data
    Failure Indicators: No error when inserting manga without title
    Evidence: .sisyphus/evidence/task-2-type-safety.txt
  ```

  **Commit**: YES
  - Message: `feat(shared): add drizzle schema and types for manga library`
  - Files: `packages/shared/src/schema.ts`, `packages/shared/src/types.ts`, `packages/shared/src/constants.ts`, `packages/shared/drizzle.config.ts`
  - Pre-commit: `cd packages/shared && bun test`

- [ ] 3. **Dashboard App Scaffold + Better Auth**

  **What to do**:
  - Scaffold `apps/dashboard` as Nuxt 3 app
  - Install Better Auth with D1 adapter
  - Configure auth routes: `/api/auth/*` (session, login, register, logout, callback)
  - Create server middleware for auth context
  - Add auth types to `packages/shared` (UserSession, AuthenticatedUser)
  - Create `apps/dashboard/alchemy.run.ts` with D1 + KV bindings
  - Write TDD tests for auth flows (login, register, session, logout)

  **Must NOT do**:
  - NO reader-specific UI
  - NO manga upload/import logic (that's T5/T6)
  - NO admin dashboard UI (that's T8)

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`nuxt`, `nuxt-better-auth`, `drizzle-orm-d1`, `vitest`, `tdd`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T4)
  - **Parallel Group**: Wave 3 (with T4)
  - **Blocks**: T5, T7, T8, T13
  - **Blocked By**: T2

  **References**:

  **External References**:
  - Better Auth docs: `https://www.better-auth.com/docs`
  - Alchemy Nuxt guide: `https://alchemy.run/integrations/nuxt/`

  **Acceptance Criteria**:
  - [ ] Test file: `apps/dashboard/server/__tests__/auth.test.ts`
  - [ ] `bun test apps/dashboard` → PASS

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Auth flows work end-to-end
    Tool: Bash (curl)
    Steps:
      1. Register: `POST /api/auth/register` with { email: "admin@skald.test", password: "test-password-123" }
      2. Get session: `GET /api/auth/get-session` with session cookie from step 1
      3. Logout: `POST /api/auth/sign-out` — expect 200
      4. Re-register and verify session cookie is cleared
    Expected Result: Register returns 201, session returns user data, logout clears cookie
    Failure Indicators: 4xx on register, session returns 401 after register, logout doesn't clear cookie
    Evidence: .sisyphus/evidence/task-3-auth-flows.txt

  Scenario: Unauthenticated request is rejected
    Tool: Bash (curl)
    Steps:
      1. `GET /api/auth/get-session` without cookie — expect 401
    Expected Result: 401 Unauthorized for missing session cookie
    Failure Indicators: 200 response without session cookie
    Evidence: .sisyphus/evidence/task-3-auth-reject.txt
  ```

  **Commit**: YES
  - Message: `feat(dashboard): scaffold nuxt app with better auth`
  - Files: `apps/dashboard/nuxt.config.ts`, `apps/dashboard/server/api/auth/[...].ts`, `apps/dashboard/alchemy.run.ts`, `apps/dashboard/server/middleware/auth.ts`
  - Pre-commit: `cd apps/dashboard && bun test`

- [ ] 4. **Reader App Scaffold + Nuxt UI**

  **What to do**:
  - Scaffold `apps/reader` as Nuxt 3 app
  - Install and configure Nuxt UI with consistent theme matching dashboard
  - Setup Tailwind CSS with shared color tokens from `packages/shared`
  - Create BFF proxy: `server/api/[...].ts` → forwards requests to dashboard API
  - Configure CORS for reader ↔ dashboard communication
  - Create `apps/reader/alchemy.run.ts` with binding to dashboard worker
  - Write scaffold tests: layout renders, CORS proxy works

  **Must NOT do**:
  - NO reader-specific components beyond basic layout
  - NO manga data fetching (that's T9)
  - NO reader logic (that's T11)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`nuxt`, `nuxt-ui`, `tailwind-patterns`, `vue-best-practices`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T3)
  - **Parallel Group**: Wave 3 (with T3)
  - **Blocks**: T9, T10, T11
  - **Blocked By**: T2

  **References**:

  **External References**:
  - Nuxt UI docs: `https://ui.nuxt.com/docs/getting-started/installation`
  - Alchemy Nuxt guide: `https://alchemy.run/integrations/nuxt/`

  **Acceptance Criteria**:
  - [ ] Test file: `apps/reader/server/__tests__/setup.test.ts`
  - [ ] `bun test apps/reader` → PASS

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Reader app renders with Nuxt UI layout
    Tool: Playwright
    Steps:
      1. Navigate to `http://localhost:3001`
      2. Verify Nuxt UI header and navigation components render
      3. Verify Tailwind CSS loaded in page `<head>`
      4. Take screenshot of initial page
    Expected Result: Page renders with Nuxt UI-stemed layout, correct colors, responsive design
    Failure Indicators: Missing header/nav, unstyled content, console errors
    Evidence: .sisyphus/evidence/task-4-reader-scaffold.png

  Scenario: CORS proxy forwards to dashboard
    Tool: Bash (curl)
    Steps:
      1. `curl -s http://localhost:3001/api/proxy/dashboard/api/health` -H "origin: http://localhost:3001` -- expect 200
      2. Verify CORS headers in response (Access-Control-Allow-Origin)
    Expected Result: Proxy request succeeds with CORS headers
    Failure Indicators: CORS error, connection refused, 403
    Evidence: .sisyphus/evidence/task-4-cors-proxy.txt
  ```

  **Commit**: YES
  - Message: `feat(reader): scaffold nuxt app with nuxt UI and dashboard proxy`
  - Files: `apps/reader/nuxt.config.ts`, `apps/reader/tailwind.config.ts`, `apps/reader/alchemy.run.ts`, `apps/reader/server/api/proxy/[...].ts`
  - Pre-commit: `cd apps/reader && bun test`

- [ ] 5. **Storage API — R2 Upload + Image Serving**

  **What to do**:
  - Create R2 presigned URL generation endpoint: `POST /api/manga/upload-url` returns presigned upload URL
  - Create image serving endpoint: `GET /api/manga/:mangaId/chapters/:chapterId/pages/:pageId`
  - Implement ZIP/CBZ extraction using JSZip in server route: `POST /api/manga/:mangaId/upload` accepts ZIP, extracts pages
  - Store extracted pages in R2 at `manga/{mangaId}/chapters/{chapterId}/pages/{pageNumber}.webp`
  - Generate cover thumbnail from first page and store at `manga/{mangaId}/cover.webp`
  - Create manga CRUD API routes: `GET/POST/PUT/DELETE /api/manga`, `GET/POST /api/manga/:mangaId/chapters`
  - Wire R2 binding in dashboard's `alchemy.run.ts`
  - Write TDD tests: presigned URL generation, image serving, ZIP extraction

  **Must NOT do**:
  - NO image optimization or resizing (that's T14)
  - NO MangaDex image proxying (that's T6)
  - NO reader UI components

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Backend API with R2 storage integration, requires understanding of presigned URLs and binary processing
  - **Skills**: [`cloudflare-r2`, `drizzle-orm-d1`, `vitest`, `tdd`]
    - `cloudflare-r2`: R2 presigned URL generation, object storage, binding configuration
    - `drizzle-orm-d1`: Database operations for manga/chapter/page records
    - `vitest`: TDD test patterns
    - `tdd`: Red-Green-Refactor workflow
  - **Skills Evaluated but Omitted**:
    - `cloudflare-worker-base`: Using Nuxt server routes, not raw Worker

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T6, Wave 4)
  - **Parallel Group**: Wave 4 (with T6)
  - **Blocks**: T7, T8, T9, T11, T14
  - **Blocked By**: T2, T3

  **References**:

  **External References**:
  - Alchemy R2 Bucket: `https://alchemy.run/api/cloudflare/r2-bucket/` — Presigned URL configuration
  - Cloudflare R2 docs: `https://developers.cloudflare.com/r2/api/s3/presigned-urls/` — Presigned URL API
  - JSZip library: `https://stuk.github.io/jszip/` — ZIP extraction in browser/Worker

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Presigned URL upload works end-to-end
    Tool: Bash (curl)
    Steps:
      1. Request presigned URL: `curl -X POST http://localhost:3000/api/manga/upload-url -H "Content-Type: application/json" -d '{"fileName":"test.webp","contentType":"image/webp"}'` - expect 200 with uploadUrl
      2. Upload test image to presigned URL: `curl -X PUT "$UPLOAD_URL" --data-binary "@test.webp"` - expect 200
      3. Verify image accessible: `curl http://localhost:3000/api/manga/test-manga/chapters/ch-1/pages/1` - expect 200 with image content
    Expected Result: Presigned URL generated, upload succeeds, image serves correctly
    Failure Indicators: Presigned URL generation fails, upload returns 403, image serving returns 404
    Evidence: .sisyphus/evidence/task-5-presigned-upload.txt

  Scenario: ZIP upload extracts pages correctly
    Tool: Bash (curl)
    Steps:
      1. Create test ZIP with 3 images: `cd /tmp && for i in 1 2 3; do convert -size 100x100 xc: /tmp/page_${i}.webp; done && cd /tmp && zip test.zip page_*.webp`
      2. Upload ZIP: `curl -X POST http://localhost:3000/api/manga/test-manga/upload -F "file=@/tmp/test.zip"` - expect 200 with chapterId
      3. Verify pages: `curl http://localhost:3000/api/manga/test-manga/chapters/{chapterId}/pages/1` - expect 200
    Expected Result: ZIP extracted, 3 pages stored in R2, database records created
    Failure Indicators: ZIP extraction fails, pages missing from R2, no database records
    Evidence: .sisyphus/evidence/task-5-zip-extraction.txt
  ```

  **Commit**: YES
  - Message: `feat(dashboard): add R2 storage API with presigned uploads and image serving`
  - Files: `apps/dashboard/server/api/manga/upload-url.post.ts`, `apps/dashboard/server/api/manga/[mangaId]/upload.post.ts`, `apps/dashboard/server/api/manga/[mangaId]/chapters/[chapterId]/pages/[pageId].get.ts`, `apps/dashboard/server/utils/r2.ts`
  - Pre-commit: `cd apps/dashboard && bun test`

- [ ] 6. **MangaDex API Client in Shared Package**

  **What to do**:
  - Create `packages/shared/src/mangadex/client.ts` — API client class with typed methods
  - Define MangaDex types in `packages/shared/src/mangadex/types.ts`: MangaDexManga, MangaDexChapter, MangaDexPage, MangaDexSearchResult, MangaDexCoverArt
  - Implement methods: `searchManga(query)`, `getManga(id)`, `getChapters(mangaId, params)`, `getChapterPages(chapterId)`, `getCoverArt(mangaId)`
  - Implement rate limiter: token bucket algorithm, max 5 requests/second, configurable
  - Implement MangaDex image URL builder: construct CDN URLs from chapter page hashes
  - All responses typed via shared types, all errors wrapped in custom `MangaDexError` class
  - Write TDD tests: mock API responses, rate limiter behavior, error handling

  **Must NOT do**:
  - NO sync/queue logic (that's T7)
  - NO database writes (pure API client)
  - NO caching (that's application-level)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: API client design requires careful type modeling and rate limiting
  - **Skills**: [`vitest`, `tdd`]
    - `vitest`: TDD test patterns with mocking
    - `tdd`: Red-Green-Refactor workflow
  - **Skills Evaluated but Omitted**:
    - `drizzle-orm-d1`: No database interaction in this task
    - `nuxt`: Pure TypeScript package, no Nuxt dependency

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T5, Wave 4)
  - **Parallel Group**: Wave 4 (with T5)
  - **Blocks**: T7, T10, T16
  - **Blocked By**: T2

  **References**:

  **External References**:
  - MangaDex API docs: `https://api.mangadex.org/docs.html` — Full API reference
  - MangaDex API spec: `https://api.mangadex.org/swagger.html` — OpenAPI spec

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Search returns typed results
    Tool: Bash (bun test)
    Steps:
      1. Mock MangaDex /manga endpoint with test response
      2. Call searchManga("one piece")
      3. Verify returned type is MangaDexSearchResult with manga array
    Expected Result: Typed search results with manga titles, IDs, and cover art references
    Failure Indicators: Untyped response, missing fields, type errors
    Evidence: .sisyphus/evidence/task-6-search-typed.txt

  Scenario: Rate limiter throttles requests
    Tool: Bash (bun test)
    Steps:
      1. Set rate limit to 5 req/s
      2. Fire 10 concurrent requests
      3. Verify exactly 5 succeed immediately and 5 are delayed
    Expected Result: Rate limiter enforces 5 req/s limit with queueing
    Failure Indicators: All 10 requests succeed immediately (no rate limiting)
    Evidence: .sisyphus/evidence/task-6-rate-limiter.txt
  ```

  **Commit**: YES
  - Message: `feat(shared): add typed MangaDex API client with rate limiting`
  - Files: `packages/shared/src/mangadex/client.ts`, `packages/shared/src/mangadex/types.ts`, `packages/shared/src/mangadex/index.ts`
  - Pre-commit: `cd packages/shared && bun test`

- [ ] 7. **MangaDex Sync Engine — Queues + Cron**

  **What to do**:
  - Create Cloudflare Queue consumer in dashboard app: `apps/dashboard/server/queues/mangadex-sync.ts`
  - Define queue message types: `import-manga`, `sync-chapters`, `download-pages`
  - Implement consumer handler: switch on message type, call appropriate service
  - Implement `ImportMangaService`: fetch manga metadata from MangaDex, create D1 records, queue `sync-chapters`
  - Implement `SyncChaptersService`: fetch chapter list, diff against D1, queue `download-pages` for new chapters
  - Implement `DownloadPagesService`: fetch page URLs from MangaDex, store page metadata in D1
  - Create Cron trigger handler: `apps/dashboard/server/cron/sync-check.ts` — runs every 30min, queries tracked manga with `auto_sync_enabled`, queues sync jobs
  - Wire Queue and Cron bindings in `apps/dashboard/alchemy.run.ts`
  - Implement retry logic: max 3 retries with exponential backoff, dead letter queue for permanent failures
  - Write TDD tests for each service with mocked MangaDex API and D1

  **Must NOT do**:
  - NO direct MangaDex API calls in user-facing routes (all via Queue)
  - NO image downloading to R2 (pages reference MangaDex CDN URLs initially)
  - NO admin UI (that's T8)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Background processing with Queue consumer requires careful error handling and retry logic
  - **Skills**: [`cloudflare-queues`, `drizzle-orm-d1`, `vitest`, `tdd`]
    - `cloudflare-queues`: Queue consumer setup, message types, retry patterns
    - `drizzle-orm-d1`: Database operations in queue consumers
    - `vitest`: TDD test patterns
    - `tdd`: Red-Green-Refactor workflow
  - **Skills Evaluated but Omitted**:
    - `cloudflare-worker-base`: Using Nuxt server routes, not raw Worker

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T8, T9, T10, Wave 5)
  - **Parallel Group**: Wave 5 (with T8, T9, T10)
  - **Blocks**: T16
  - **Blocked By**: T5, T6

  **References**:

  **External References**:
  - Alchemy Queue guide: `https://alchemy.run/guides/cloudflare-queue/` — Queue setup patterns
  - Alchemy QueueConsumer: `https://alchemy.run/api/cloudflare/queue-consumer/` — Consumer API
  - Alchemy Cron: `https://alchemy.run/guides/cloudflare-worker/` — Cron trigger configuration

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Import manga via queue consumer
    Tool: Bash (bun test)
    Steps:
      1. Mock MangaDex API returning manga metadata
      2. Send import-manga queue message with mangaId
      3. Verify D1 records created: manga, chapters, pages
    Expected Result: Manga with all chapters and pages imported to D1
    Failure Indicators: Missing chapters, no page records, manga not created
    Evidence: .sisyphus/evidence/task-7-import-manga.txt

  Scenario: Retry logic works on transient failure
    Tool: Bash (bun test)
    Steps:
      1. Mock MangaDex API returning 500 on first call, 200 on second
      2. Send import-manga queue message
      3. Verify consumer retries and succeeds on second attempt
    Expected Result: Import succeeds after retry, no dead letter
    Failure Indicators: Message goes to DLQ on first failure
    Evidence: .sisyphus/evidence/task-7-retry-logic.txt
  ```

  **Commit**: YES
  - Message: `feat(dashboard): add MangaDex sync engine with queue consumer and cron trigger`
  - Files: `apps/dashboard/server/queues/mangadex-sync.ts`, `apps/dashboard/server/services/import-manga.ts`, `apps/dashboard/server/services/sync-chapters.ts`, `apps/dashboard/server/services/download-pages.ts`, `apps/dashboard/server/cron/sync-check.ts`
  - Pre-commit: `cd apps/dashboard && bun test`

- [ ] 8. **Admin Library Management UI**

  **What to do**:
  - Build admin pages in `apps/dashboard/pages/admin/`:
    - Library list page (`/admin/library`) — manga grid with search/filter, status badges, sync indicators
    - Manga detail page (`/admin/library/[id]`) — metadata editor, chapter list with reordering, page preview
    - Upload page (`/admin/upload`) — drag-and-drop image upload, ZIP/CBZ upload with progress bar
  - Components: MangaAdminCard, ChapterList, UploadDropzone, SyncStatusBadge, MetadataEditor, PagePreviewGrid
  - Features: drag-and-drop upload with progress, inline metadata editing, manual MangaDex import trigger, chapter reordering via drag, bulk actions (delete, change status)
  - Use Nuxt UI components throughout (UButton, UCard, UModal, UForm, UTable, UDropdown)

  **Must NOT do**:
  - NO reader UI components
  - NO user management (that's T13)
  - NO sync engine logic (that's T7)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Rich UI with drag-and-drop, forms, tables, and Nuxt UI components
  - **Skills**: [`nuxt`, `nuxt-ui`, `vue-best-practices`, `tailwind-patterns`]
    - `nuxt`: File-based routing, auto-imports, server routes
    - `nuxt-ui`: Component library for forms, tables, modals
    - `vue-best-practices`: Composition API, script setup patterns
    - `tailwind-patterns`: Consistent styling with utility classes
  - **Skills Evaluated but Omitted**:
    - `drizzle-orm-d1`: UI consumes API, doesn't touch DB directly
    - `cloudflare-r2`: Upload via API endpoints, not direct R2 access

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T7, T9, T10, Wave 5)
  - **Parallel Group**: Wave 5 (with T7, T9, T10)
  - **Blocks**: T13
  - **Blocked By**: T3, T5

  **References**:

  **External References**:
  - Nuxt UI components: `https://ui.nuxt.com/components/` — Full component library
  - Nuxt UI forms: `https://ui.nuxt.com/components/form` — Form components
  - Nuxt UI table: `https://ui.nuxt.com/components/table` — Data table component

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Upload manga images via drag-and-drop
    Tool: Playwright
    Steps:
      1. Navigate to /admin/upload
      2. Drop test image file onto upload zone
      3. Verify progress bar appears and completes
      4. Verify success toast appears
      5. Navigate to /admin/library, verify new manga card visible
    Expected Result: Image uploaded, manga record created, appears in library list
    Failure Indicators: Upload fails silently, no progress, no toast, manga not in list
    Evidence: .sisyphus/evidence/task-8-upload-ui.png

  Scenario: Edit manga metadata inline
    Tool: Playwright
    Steps:
      1. Navigate to /admin/library/[test-manga-id]
      2. Click title field, type "Updated Title"
      3. Click Save button
      4. Verify success toast
      5. Reload page, verify title persists
    Expected Result: Metadata saves and persists across page reload
    Failure Indicators: Save button disabled, error toast, title reverts on reload
    Evidence: .sisyphus/evidence/task-8-metadata-edit.png
  ```

  **Commit**: YES
  - Message: `feat(dashboard): add admin library management UI with upload and metadata editing`
  - Files: `apps/dashboard/pages/admin/library/index.vue`, `apps/dashboard/pages/admin/library/[id].vue`, `apps/dashboard/pages/admin/upload.vue`, `apps/dashboard/components/admin/MangaAdminCard.vue`, `apps/dashboard/components/admin/UploadDropzone.vue`, `apps/dashboard/components/admin/ChapterList.vue`, `apps/dashboard/components/admin/MetadataEditor.vue`
  - Pre-commit: `cd apps/dashboard && bun test`

- [ ] 9. **Reader — Manga Library Browser**

  **What to do**:
  - Build reader app pages:
    - Home page (`/`) — manga grid with cover images, reading progress badges, search bar
    - Manga detail page (`/manga/[id]`) — cover image, description, chapter list accordion, reading status
    - Collection/shelf page (`/shelf`) — user's reading list, sorted by last read
  - Components: MangaGrid, MangaCard (with progress overlay), ChapterAccordion, SearchBar, StatusFilter, ContinueReadingCard
  - Fetch data from dashboard API via BFF proxy: `server/api/proxy/[...].ts`
  - Implement infinite scroll pagination for manga grid
  - Show reading progress on cards: percentage complete, last chapter read badge
  - Use Nuxt UI components for layout and interactive elements

  **Must NOT do**:
  - NO reader component (that's T11)
  - NO admin features
  - NO MangaDex search (that's T10)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Grid layouts, card components, infinite scroll, responsive design
  - **Skills**: [`nuxt`, `nuxt-ui`, `vue-best-practices`, `tailwind-patterns`]
    - `nuxt`: Pages, layouts, auto-imports
    - `nuxt-ui`: Card, Grid, Input components
    - `vue-best-practices`: Composition API, props, emits patterns
    - `tailwind-patterns`: Grid layouts, card styling
  - **Skills Evaluated but Omitted**:
    - `drizzle-orm-d1`: Reader fetches via API, doesn't touch DB
    - `better-auth`: Auth context passed via proxy, no direct auth logic

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T7, T8, T10, Wave 5)
  - **Parallel Group**: Wave 5 (with T7, T8, T10)
  - **Blocks**: none
  - **Blocked By**: T4, T5

  **References**:

  **External References**:
  - Nuxt UI Card: `https://ui.nuxt.com/components/card` — Card component
  - Nuxt UI Grid: `https://ui.nuxt.com/components/grid` — Grid layout
  - Tachiyomi library patterns: Priority queue image loading, chapter cache, parallel downloads, vertical scroll reader (see Plan Amendment A10)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Manga grid renders with progress badges
    Tool: Playwright
    Steps:
      1. Seed test manga with reading progress in D1
      2. Navigate to / (home page)
      3. Verify manga cards render with cover images
      4. Verify progress badges show "Ch. 5/20" or "25%"
      5. Scroll down, verify infinite scroll loads more manga
    Expected Result: Manga grid displays covers and reading progress badges, infinite scroll works
    Failure Indicators: Missing covers, no progress badges, scroll doesn't load more
    Evidence: .sisyphus/evidence/task-9-library-grid.png

  Scenario: Chapter list loads on manga detail
    Tool: Playwright
    Steps:
      1. Navigate to /manga/test-manga-id
      2. Verify manga title, description, and cover image render
      3. Verify chapter list renders with chapter titles
      4. Click chapter accordion, verify page count appears
    Expected Result: Manga detail page shows full info and expandable chapter list
    Failure Indicators: Missing title/description, chapter list empty, accordion doesn't expand
    Evidence: .sisyphus/evidence/task-9-manga-detail.png
  ```

  **Commit**: YES
  - Message: `feat(reader): add manga library browser with grid view and reading progress`
  - Files: `apps/reader/pages/index.vue`, `apps/reader/pages/manga/[id].vue`, `apps/reader/pages/shelf.vue`, `apps/reader/components/MangaGrid.vue`, `apps/reader/components/MangaCard.vue`, `apps/reader/components/ChapterAccordion.vue`, `apps/reader/components/ContinueReadingCard.vue`
  - Pre-commit: `cd apps/reader && bun test`

- [ ] 10. **Reader — MangaDex Search & Import UI**

  **What to do**:
  - Build search page (`/search`):
    - Search bar with debounced input (300ms) connected to MangaDex via dashboard proxy
    - Search results grid with manga covers, titles, author, status, chapter count
    - One-click "Import to Library" button per result
    - Import progress indicator: polling `/api/mangadex/import/:jobId/status`
  - Server routes in reader:
    - `GET /api/mangadex/search?q=...` — proxies to dashboard MangaDex search
    - `POST /api/mangadex/import` — triggers import via dashboard queue
  - Show import history: recently imported manga with status badges (importing/synced/error)
  - Handle empty states: no results, search in progress, import failed

  **Must NOT do**:
  - NO direct MangaDex API calls from reader client (all proxied through dashboard)
  - NO sync engine logic (that's T7)
  - NO reader component

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Search UI with async state management and progress indicators
  - **Skills**: [`nuxt`, `nuxt-ui`, `vue-best-practices`]
    - `nuxt`: Server routes as proxy, useFetch for data
    - `nuxt-ui`: Input, Card, Badge, Progress components
    - `vue-best-practices`: Async state management, debouncing
  - **Skills Evaluated but Omitted**:
    - `cloudflare-queues`: Reader doesn't interact with queues directly
    - `drizzle-orm-d1`: Reader uses API, not DB

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T7, T8, T9, Wave 5)
  - **Parallel Group**: Wave 5 (with T7, T8, T9)
  - **Blocks**: none
  - **Blocked By**: T4, T6

  **References**:

  **External References**:
  - MangaDex search API: `https://api.mangadex.org/docs.html#tag/Manga` — Search endpoint
  - Nuxt UI Input: `https://ui.nuxt.com/components/input` — Search input component

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Search returns manga results
    Tool: Playwright
    Steps:
      1. Navigate to /search
      2. Type "one piece" in search bar
      3. Wait 500ms for debounce
      4. Verify results grid renders with manga covers and titles
      5. Verify "Import to Library" button visible on each card
    Expected Result: Search results display with covers, titles, and import buttons
    Failure Indicators: No results, loading spinner stuck, no import buttons
    Evidence: .sisyphus/evidence/task-10-search-results.png

  Scenario: Import triggers and shows progress
    Tool: Playwright
    Steps:
      1. On /search page with results visible
      2. Click "Import to Library" on first result
      3. Verify progress indicator appears (spinner or progress bar)
      4. Wait for import to complete (max 10s)
      5. Verify success toast and "Imported" badge replaces button
    Expected Result: Import completes, badge changes to "Imported", manga appears in library
    Failure Indicators: Button doesn't respond, no progress indicator, error toast
    Evidence: .sisyphus/evidence/task-10-import-progress.png
  ```

  **Commit**: YES
  - Message: `feat(reader): add MangaDex search and one-click import UI`
  - Files: `apps/reader/pages/search.vue`, `apps/reader/server/api/mangadex/search.get.ts`, `apps/reader/server/api/mangadex/import.post.ts`, `apps/reader/components/SearchResultCard.vue`
  - Pre-commit: `cd apps/reader && bun test`

- [ ] 11. **Vertical Scroll Reader Component**

  **What to do**:
  - Build reader page (`/read/[mangaId]/[chapterId]`):
    - Vertical scroll container with all chapter pages stacked vertically
    - Lazy-loaded images via IntersectionObserver (load when within 2 viewport heights)
    - Preloading of next 3 pages outside viewport
    - Page counter overlay: "Page 15 / 42" (top-right, semi-transparent)
    - Chapter navigation: prev/next buttons, keyboard arrows, mobile swipe
    - Keyboard shortcuts: Left/Right arrows (prev/next chapter), Space (scroll down)
  - Implement virtual scrolling / DOM recycling for 100+ page chapters (keep max 20 DOM nodes)
  - Image loading priority order: viewport images > preloaded > background
  - Scroll position restoration: when returning to a chapter, scroll to last read page
  - Create reader Pinia store for state management

  **Must NOT do**:
  - NO horizontal/RTL reader modes (vertical scroll only for V1)
  - NO offline caching (that's T15)
  - NO progress tracking logic (that's T12, just emit events)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Virtual scrolling, IntersectionObserver, DOM recycling require careful performance engineering
  - **Skills**: [`vue-best-practices`, `vueuse-functions`, `nuxt-ui`]
    - `vue-best-practices`: Composition API, reactive state, component design
    - `vueuse-functions`: useIntersectionObserver, useWindowScroll, useEventListener
    - `nuxt-ui`: UI components for navigation overlay
  - **Skills Evaluated but Omitted**:
    - `pinia`: Using composable pattern instead of full Pinia store for reader state
    - `drizzle-orm-d1`: Reader component doesn't touch DB

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T12, T13, T14, Wave 6)
  - **Parallel Group**: Wave 6 (with T12, T13, T14)
  - **Blocks**: T12, T15
  - **Blocked By**: T4, T5

  **References**:

  **External References**:
  - VueUse IntersectionObserver: `https://vueuse.org/core/useintersectionobserver/` — Lazy loading
  - VueUse WindowScroll: `https://vueuse.org/core/usewindowscroll/` — Scroll tracking
  - Tachiyomi reader patterns: Priority queue image loading, 5-page preload, next-chapter trigger on last 5 pages (see Plan Amendment A10)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Reader lazy-loads pages
    Tool: Playwright
    Steps:
      1. Navigate to /read/test-manga/ch-1 (chapter with 50 pages)
      2. Wait for initial load
      3. Verify only visible images (viewport) have src attribute set
      4. Scroll to page 25
      5. Verify new viewport images loaded, earlier images may be recycled
    Expected Result: Images load as they enter viewport, not all at once
    Failure Indicators: All 50 images load immediately (network tab), or images never load
    Evidence: .sisyphus/evidence/task-11-lazy-load.png

  Scenario: DOM recycling keeps node count low
    Tool: Playwright
    Steps:
      1. Navigate to /read/test-manga/long-chapter (200 pages)
      2. Check DOM: `document.querySelectorAll('img').length`
      3. Verify count is under 30 (not 200)
      4. Scroll through entire chapter
      5. Verify all pages render correctly despite recycling
    Expected Result: DOM image count stays under 30, all pages visible when scrolled to
    Failure Indicators: 200 img elements in DOM, or pages flash/disappear incorrectly
    Evidence: .sisyphus/evidence/task-11-dom-recycling.txt
  ```

  **Commit**: YES
  - Message: `feat(reader): add vertical scroll reader with lazy loading and virtual scrolling`
  - Files: `apps/reader/pages/read/[mangaId]/[chapterId].vue`, `apps/reader/components/reader/VerticalScroller.vue`, `apps/reader/components/reader/PageImage.vue`, `apps/reader/components/reader/PageOverlay.vue`, `apps/reader/composables/useReader.ts`
  - Pre-commit: `cd apps/reader && bun test`

- [ ] 12. **Reading Progress Tracking**

  **What to do**:
  - Create Pinia store: `stores/reading-progress.ts` — tracks current manga, chapter, page, scroll position
  - Create composable: `composables/useProgressSync.ts` — debounced (1s) progress sync to API
  - Create API endpoint in dashboard: `PUT /api/reading-progress` with body { mangaId, chapterId, page, scrollY }
  - Create API endpoint: `GET /api/reading-progress/:mangaId` — returns progress for a manga
  - Implement auto-mark chapter complete: when user reaches last page, mark chapter as complete
  - Create "Continue Reading" cards for home page: shows last manga + chapter + page with resume button
  - Progress merge logic: on conflict, latest `updatedAt` timestamp wins (for offline sync later)
  - Write TDD tests: debounce timing, merge conflict resolution, chapter completion detection

  **Must NOT do**:
  - NO offline sync (that's T15)
  - NO social features (shared progress, comments)
  - NO reading statistics/analytics

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: State management with debounce, merge conflict logic, and API integration
  - **Skills**: [`pinia`, `vueuse-functions`, `drizzle-orm-d1`, `vitest`]
    - `pinia`: Store setup for reading progress state
    - `vueuse-functions`: useDebounceFn for sync debouncing
    - `drizzle-orm-d1`: Database operations for progress table
    - `vitest`: Test patterns for async state
  - **Skills Evaluated but Omitted**:
    - `nuxt-ui`: No UI components in this task (store + API only)

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T11, T13, T14, Wave 6)
  - **Parallel Group**: Wave 6 (with T11, T13, T14)
  - **Blocks**: T15
  - **Blocked By**: T11, T3

  **References**:

  **External References**:
  - Pinia docs: `https://pinia.vuejs.org/` — Store setup
  - VueUse debounceFn: `https://vueuse.org/shared/usedebouncefn/` — Debounced sync

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Progress syncs after scroll with debounce
    Tool: Playwright
    Steps:
      1. Navigate to /read/test-manga/ch-1
      2. Scroll to page 25 (intercept API calls)
      3. Wait 1.5s (debounce is 1s)
      4. Verify exactly ONE PUT /api/reading-progress call with page=25
    Expected Result: Single debounced API call with correct page number
    Failure Indicators: Multiple API calls, no API call after 2s, wrong page number
    Evidence: .sisyphus/evidence/task-12-progress-sync.txt

  Scenario: Chapter auto-completes at last page
    Tool: Playwright
    Steps:
      1. Navigate to /read/test-manga/ch-1 (10 pages)
      2. Scroll to bottom (page 10)
      3. Wait 1.5s for debounce
      4. Verify progress API call includes completed=true
      5. Navigate to /manga/test-manga, verify chapter 1 shows checkmark
    Expected Result: Chapter marked as complete in UI and API
    Failure Indicators: Chapter not marked complete, no checkmark visible
    Evidence: .sisyphus/evidence/task-12-chapter-complete.png
  ```

  **Commit**: YES
  - Message: `feat(reader): add reading progress tracking with debounced sync`
  - Files: `apps/reader/stores/reading-progress.ts`, `apps/reader/composables/useProgressSync.ts`, `apps/dashboard/server/api/reading-progress.put.ts`, `apps/dashboard/server/api/reading-progress/[mangaId].get.ts`, `apps/reader/components/ContinueReadingCard.vue`
  - Pre-commit: `cd apps/reader && bun test`

- [ ] 13. **Admin Dashboard Overview + User Management**

  **What to do**:
  - Build admin dashboard home page (`/admin`):
    - Stats cards: total manga, total chapters, active users (last 7d), storage used (R2)
    - Recent activity feed: uploads, imports, sync events (last 20)
    - Storage usage breakdown by manga
  - Build user management page (`/admin/users`):
    - User list table with columns: name, email, role, last active, actions
    - Role assignment: dropdown to change role (admin/reader)
    - User invite flow: email input → sends invite link
    - User disable/enable toggle
  - API endpoints:
    - `GET /api/admin/stats` — aggregated counts
    - `GET /api/admin/users` — paginated user list
    - `PUT /api/admin/users/:id/role` — role change
    - `POST /api/admin/users/invite` — send invite
  - Use Nuxt UI components: UCard (stats), UTable (users), UDropdown (roles)

  **Must NOT do**:
  - NO reader-specific pages
  - NO sync management UI (sync runs automatically via cron)
  - NO email sending (invite flow stores token, doesn't send email in V1)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Dashboard UI with stats cards, tables, and user management forms
  - **Skills**: [`nuxt`, `nuxt-ui`, `vue-best-practices`, `tailwind-patterns`]
    - `nuxt`: Pages, server routes
    - `nuxt-ui`: UCard, UTable, UDropdown, UButton
    - `vue-best-practices`: Data fetching patterns
    - `tailwind-patterns`: Dashboard layout patterns
  - **Skills Evaluated but Omitted**:
    - `better-auth`: Auth context via middleware, no direct auth calls in UI

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T11, T12, T14, Wave 6)
  - **Parallel Group**: Wave 6 (with T11, T12, T14)
  - **Blocks**: none
  - **Blocked By**: T3, T5

  **References**:

  **External References**:
  - Nuxt UI Table: `https://ui.nuxt.com/components/table` — User list table
  - Nuxt UI Card: `https://ui.nuxt.com/components/card` — Stats cards

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Admin dashboard shows correct stats
    Tool: Playwright
    Steps:
      1. Seed test data: 5 manga, 20 chapters, 3 users
      2. Navigate to /admin
      3. Verify "Total Manga" card shows "5"
      4. Verify "Total Chapters" card shows "20"
      5. Verify "Active Users" card shows a number >= 0
    Expected Result: Stats cards render with correct counts from D1
    Failure Indicators: Cards show "0" or "Loading...", mismatched numbers
    Evidence: .sisyphus/evidence/task-13-admin-stats.png

  Scenario: User role change persists
    Tool: Playwright
    Steps:
      1. Navigate to /admin/users
      2. Find test user row, click role dropdown
      3. Select "admin" role
      4. Verify success toast
      5. Reload page, verify role persists as "admin"
    Expected Result: Role change saves to D1 and persists
    Failure Indicators: Dropdown disabled, error toast, role reverts on reload
    Evidence: .sisyphus/evidence/task-13-role-change.png
  ```

  **Commit**: YES
  - Message: `feat(dashboard): add admin overview stats and user management`
  - Files: `apps/dashboard/pages/admin/index.vue`, `apps/dashboard/pages/admin/users.vue`, `apps/dashboard/server/api/admin/stats.get.ts`, `apps/dashboard/server/api/admin/users.get.ts`, `apps/dashboard/server/api/admin/users/[id]/role.put.ts`, `apps/dashboard/server/api/admin/users/invite.post.ts`
  - Pre-commit: `cd apps/dashboard && bun test`

- [ ] 14. **Image Optimization Pipeline**

  **What to do**:
  - Configure Cloudflare Polish via Alchemy for automatic WebP/AVIF conversion
  - Create image variant endpoint: `GET /api/manga/:mangaId/chapters/:chapterId/pages/:pageId?w=800&q=80` — returns resized image
  - Use Cloudflare Image Resizing (via R2 + Worker) for on-the-fly variants
  - Generate and cache cover thumbnails (200px wide) on manga upload
  - Configure Cache-Control headers: `public, max-age=31536000, immutable` for R2 images
  - Add ETag support for conditional requests
  - Configure Alchemy R2 bucket with `allowPublicAccess` for image serving domain
  - Create middleware that adds image optimization headers for manga page requests

  **Must NOT do**:
  - NO custom image processing Workers (use Cloudflare built-in Polish/Resizing)
  - NO client-side image processing
  - NO image watermarking or DRM

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Infrastructure configuration with Alchemy + Cloudflare image optimization
  - **Skills**: [`cloudflare-r2`]
    - `cloudflare-r2`: R2 configuration, caching headers, public access
  - **Skills Evaluated but Omitted**:
    - `nuxt`: Infrastructure task, minimal Nuxt code
    - `vitest`: Testing via curl/QA rather than unit tests

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T11, T12, T13, Wave 6)
  - **Parallel Group**: Wave 6 (with T11, T12, T13)
  - **Blocks**: none
  - **Blocked By**: T5

  **References**:

  **External References**:
  - Cloudflare Polish: `https://developers.cloudflare.com/images/polish/` — Auto WebP/AVIF
  - Cloudflare Image Resizing: `https://developers.cloudflare.com/images/resizing/` — On-the-fly variants
  - Alchemy R2 Bucket: `https://alchemy.run/api/cloudflare/r2-bucket/` — R2 configuration

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Resized image variant returns correct dimensions
    Tool: Bash (curl)
    Steps:
      1. Upload 1000px wide test image to R2
      2. Request `GET /api/manga/test/chapters/ch-1/pages/1?w=400` — expect 200
      3. Verify returned image width is approximately 400px (check Content-Length smaller than original)
    Expected Result: Resized image returned, smaller than original, correct content-type
    Failure Indicators: Original full-size image returned, 404, 500 error
    Evidence: .sisyphus/evidence/task-14-image-resize.txt

  Scenario: Cover thumbnail generated on upload
    Tool: Bash (curl)
    Steps:
      1. Upload manga with cover image (via upload API)
      2. Request `GET /api/manga/test-manga/cover?w=200` — expect 200
      3. Verify thumbnail is WebP format and smaller than 50KB
    Expected Result: Cover thumbnail auto-generated, WebP format, under 50KB
    Failure Indicators: No thumbnail generated, exceeds 50KB, wrong format
    Evidence: .sisyphus/evidence/task-14-cover-thumbnail.txt
  ```

  **Commit**: YES
  - Message: `feat(infra): add image optimization pipeline with Cloudflare Polish and resizing`
  - Files: `apps/dashboard/server/api/manga/[mangaId]/chapters/[chapterId]/pages/[pageId].get.ts` (updated), `apps/dashboard/server/utils/image-optimization.ts`, `apps/dashboard/server/middleware/image-cache.ts`, `apps/dashboard/alchemy.run.ts` (updated with Polish config)
  - Pre-commit: `cd apps/dashboard && bun test`

- [ ] 15. **Offline Downloads — CBZ Export + In-App Cache**

  **What to do**:
  - Implement CBZ export endpoint: `GET /api/manga/:mangaId/chapters/:chapterId/download` — generates ZIP with pages as sequential JPG/WebP files
  - Implement in-app chapter caching via Service Worker:
    - Register SW in reader app
    - Cache current chapter pages + next chapter pages on Cache API
    - Serve cached pages when offline
  - Add download button in reader UI (next to chapter navigation)
  - Add "Available Offline" badge on cached chapters in chapter list
  - Detect offline state via `navigator.onLine` + VueUse `useOnline()`
  - Show offline banner when disconnected
  - Implement cache size limit (500MB) with LRU eviction

  **Must NOT do**:
  - NO full manga downloads (chapter-level only for V1)
  - NO PWA install prompt
  - NO offline reading progress sync (read-only offline for V1)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Service Worker, Cache API, and CBZ generation require careful async programming
  - **Skills**: [`vue-best-practices`, `vueuse-functions`]
    - `vue-best-practices`: Component patterns for offline UI
    - `vueuse-functions`: useOnline(), useStorage() for offline state
  - **Skills Evaluated but Omitted**:
    - `cloudflare-r2`: Downloads via API, not direct R2 access
    - `pinia`: Using composable for cache state, not full store

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T16, Wave 7)
  - **Parallel Group**: Wave 7 (with T16)
  - **Blocks**: none
  - **Blocked By**: T11, T12

  **References**:

  **External References**:
  - Service Worker API: `https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API` — SW registration
  - Cache API: `https://developer.mozilla.org/en-US/docs/Web/API/Cache` — Page caching
  - VueUse useOnline: `https://vueuse.org/core/useonline/` — Offline detection

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: CBZ download contains all chapter pages
    Tool: Bash (curl + unzip)
    Steps:
      1. Download chapter: `curl -o /tmp/test-chapter.cbz http://localhost:3000/api/manga/test/chapters/ch-1/download`
      2. List contents: `unzip -l /tmp/test-chapter.cbz`
      3. Verify file count matches page count in database
      4. Verify files named sequentially: 001.webp, 002.webp, etc.
    Expected Result: Valid CBZ/ZIP file with all pages in sequential order
    Failure Indicators: Empty ZIP, missing pages, wrong filenames
    Evidence: .sisyphus/evidence/task-15-cbz-download.txt

  Scenario: Chapter pages available offline via Service Worker
    Tool: Playwright
    Steps:
      1. Navigate to /read/test-manga/ch-1, wait for all pages to load
      2. Verify Service Worker registered: `navigator.serviceWorker.controller`
      3. Simulate offline via CDP: `page.context().setOffline(true)`
      4. Reload page
      5. Verify pages still render (from Cache API)
    Expected Result: Pages render from cache when offline, no broken images
    Failure Indicators: Broken images, Service Worker not registered, pages don't render
    Evidence: .sisyphus/evidence/task-15-offline-cache.png
  ```

  **Commit**: YES
  - Message: `feat(reader): add offline chapter downloads with CBZ export and in-app cache`
  - Files: `apps/dashboard/server/api/manga/[mangaId]/chapters/[chapterId]/download.get.ts`, `apps/reader/public/sw.js`, `apps/reader/composables/useOfflineCache.ts`, `apps/reader/components/reader/DownloadButton.vue`, `apps/reader/components/reader/OfflineBadge.vue`, `apps/reader/components/reader/OfflineBanner.vue`
  - Pre-commit: `cd apps/reader && bun test`

- [ ] 16. **MangaDex Chapter Sync — Cron + New Chapter Detection**

  **What to do**:
  - Implement full Cron-triggered sync flow:
    1. Cron fires every 30min (`*/30 * * * *`)
    2. Query all tracked manga from D1 where `auto_sync_enabled = true`
    3. For each manga, call MangaDex API to get chapters updated since `last_synced_at`
    4. Diff returned chapters against existing D1 records
    5. For new chapters: queue `download-pages` job for each
    6. For removed chapters: soft-delete (set status = "unavailable")
    7. Update `last_synced_at` timestamp
  - Implement rate-limited batch processing: max 5 manga per cron run, spread across runs
  - Track sync state: `manga_dex_sync.last_synced_at`, `manga_dex_sync.sync_status` (idle/syncing/error)
  - Add sync status to manga detail API response
  - Handle edge case: MangaDex chapter deleted → soft-delete local chapter with "unavailable" status
  - Write TDD tests: new chapter detection, chapter deletion, rate limiting, error recovery

  **Must NOT do**:
  - NO user-facing sync triggers (cron only, admin can force from dashboard T8)
  - NO email/push notifications for new chapters
  - NO re-downloading pages that haven't changed

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Background sync with diffing logic, rate limiting, and edge case handling
  - **Skills**: [`cloudflare-queues`, `drizzle-orm-d1`, `vitest`]
    - `cloudflare-queues`: Queue message dispatch for download jobs
    - `drizzle-orm-d1`: Database queries and updates for sync state
    - `vitest`: Test patterns for cron handlers
  - **Skills Evaluated but Omitted**:
    - `cloudflare-worker-base`: Using Nuxt cron handler, not raw Worker

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T15, Wave 7)
  - **Parallel Group**: Wave 7 (with T15)
  - **Blocks**: none
  - **Blocked By**: T7

  **References**:

  **External References**:
  - Alchemy Cron guide: `https://alchemy.run/guides/cloudflare-worker/` — Cron configuration
  - MangaDex chapters API: `https://api.mangadex.org/docs.html#tag/Chapter` — Chapter list with filters

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Cron detects new chapter and queues download
    Tool: Bash (bun test)
    Steps:
      1. Seed manga with last_synced_at = yesterday, auto_sync_enabled = true
      2. Mock MangaDex API returning 1 new chapter (created after yesterday)
      3. Trigger cron handler
      4. Verify new chapter record in D1 with status = "downloading"
      5. Verify queue message dispatched for page download
    Expected Result: New chapter detected, record created, download queued
    Failure Indicators: No new record, queue message not sent, last_synced_at not updated
    Evidence: .sisyphus/evidence/task-16-cron-detect.txt

  Scenario: Soft-deletes removed MangaDex chapters
    Tool: Bash (bun test)
    Steps:
      1. Seed manga with existing chapter in D1
      2. Mock MangaDex API returning chapter list WITHOUT that chapter
      3. Trigger cron handler
      4. Verify chapter status changed to "unavailable" (not deleted)
      5. Verify chapter still visible in library with "unavailable" badge
    Expected Result: Chapter soft-deleted with unavailable status, not hard-deleted
    Failure Indicators: Chapter hard-deleted, status unchanged, error thrown
    Evidence: .sisyphus/evidence/task-16-chapter-removal.txt
  ```

  **Commit**: YES
  - Message: `feat(dashboard): add cron-based chapter sync with new chapter detection`
  - Files: `apps/dashboard/server/cron/sync-check.ts` (updated), `apps/dashboard/server/services/chapter-differ.ts`, `apps/dashboard/server/services/sync-state.ts`, `apps/dashboard/server/api/manga/[mangaId]/sync-status.get.ts`
  - Pre-commit: `cd apps/dashboard && bun test`


## Plan Amendments (Post-Research — CRITICAL OVERRIDES)

> **These amendments override or supplement the task details above.**
> Agents MUST read these before executing any task. Source: 3 parallel research agents (manga best practices, Cloudflare/Alchemy expert, architect review).

### A1. T2 — Add Database Indexing (CRITICAL)

Add the following to T2 "What to do":
- Define explicit indexes for all tables AFTER schema creation:
  - `manga`: INDEX on `status`, `updated_at`, `title` (for library listing + search)
  - `chapters`: INDEX on `manga_id`, `chapter_number` (for chapter list by manga)
  - `pages`: INDEX on `chapter_id`, `page_number` (for page lookup)
  - `reading_progress`: INDEX on `(user_id, manga_id)`, `(user_id, chapter_id)` (for progress lookup)
  - `manga_dex_sync`: INDEX on `manga_id`, `last_synced_at`, `auto_sync_enabled` (for cron queries)
- Add FTS5 virtual table for manga search: `manga_fts` with triggers on INSERT/UPDATE/DELETE
- Write TDD tests: verify indexes exist, FTS5 returns ranked results

### A2. T5 — Split Upload into Presign + Async Extraction (CRITICAL)

Modify T5 to split ZIP handling into async flow:
- `POST /api/storage/upload-url` — presigned URL for direct browser → R2 upload (unchanged)
- `POST /api/storage/upload-zip` — accepts ZIP, stores to R2 temp location, **enqueues extraction job** (NOT synchronous extraction)
- New Queue consumer in dashboard Nitro plugin (`server/plugins/queue-handler.ts`): listens for `extract-zip` jobs, extracts pages from R2 temp, stores to final R2 paths, creates DB records
- This prevents ZIP extraction from hitting Worker CPU/memory limits
- Pattern reference: Keith Mifsud's Nuxt+Queues article — `nitroApp.hooks.hook('cloudflare:queue', ...)`

### A3. T6 — MangaDex API Client Additions

Add to T6 "What to do":
- Set custom User-Agent header: `SkaldScan/1.0 (+https://github.com/youruser/skald-scan)` — REQUIRED by MangaDex
- Watch `X-RateLimit-Remaining` and `X-RateLimit-Retry-After` response headers
- On persistent 429 → implement exponential backoff with jitter (MangaDex will IP-ban persistent violators)
- Content rating filter: default exclude `erotica`, include `safe`, `suggestive`, `pornographic`
- NO CORS responses from MangaDex → ALL requests MUST be proxied server-side (already planned)
- Image URLs from MangaDex CDN do NOT expire — safe to cache indefinitely

### A4. T7 — Queue Consumer via Nitro Plugin (CRITICAL)

Change T7 implementation pattern:
- Queue consumer implemented as **Nitro Plugin** (NOT a separate file):
  ```typescript
  // server/plugins/queue-handler.ts
  export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook('cloudflare:queue', async (payload) => {
      const { batch, env } = payload
      // Route to handler based on queue name
    })
  })
  ```
- Queue binding configured in Alchemy with `maxConcurrency: 1`, `batchSize: 5` (conservative for MangaDex rate limits)
- Add **idempotency keys** to queue messages: `{ jobId: crypto.randomUUID(), mangaId, type }`
- Before processing any job, check if `jobId` already processed (store in D1 `processed_jobs` table)
- DLQ for permanent failures: Alchemy Queue with `dlq` option
- Reference: Keith Mifsud article `https://keith-mifsud.me/blog/nuxt-cloudflare-queues-and-vectorize-data-sync-pipeline/`
- Reference: Nitro runtime hooks `https://v2.nitro.build/deploy/providers/cloudflare#runtime-hooks`

### A5. T11 — Reader Performance Enhancements

Add to T11 "What to do":
- Preload next chapter when user reaches **last 5 pages** of current chapter (Mihon pattern)
- IntersectionObserver: threshold **0.01**, rootMargin **"0px 0px 300px"** for early image detection
- Keep max **20 DOM nodes** for virtual scroll (user confirmed ambitious target)
- Recycler cache size: **4** items (Mihon pattern) for smooth scroll direction changes
- Image priority: viewport images > 5-page prefetch > background

### A6. T12 — Progress Tracking Adjustments

Changes to T12:
- **Debounce changed from 1s to 500ms** (research shows 300-500ms optimal, 1s feels sluggish)
- Add auto-complete option: chapter marked complete at **90% read ratio** (configurable, Mihon pattern)
- Track `lastPageRead` AND `read` (completed) separately in schema
- T12 now depends on T11 (not parallel) — must run after T11 completes
- Progress debounce saves: `lastPageRead` (user can be on any page), `read` = true only at 90%+

### A7. T16 — Cron Handler via Nitro + Idempotency

Changes to T16:
- Cron handler via **Nitro Plugin** with `cloudflare:scheduled` hook:
  ```typescript
  nitroApp.hooks.hook('cloudflare:scheduled', async (payload) => {
    // Check tracked manga, queue sync jobs
  })
  ```
- Add **idempotency**: each cron run creates a unique `runId`, stored in D1. If run already processed, skip.
- Rate limit cron: max 5 manga per run, spread remaining across next runs

### A8. New Task — Observability Baseline (Wave 4.5, after T5)

- [ ] **T17. Observability & Error Tracking Baseline**

  **What to do**:
  - Add structured logging to all server routes: `{ timestamp, level, message, requestId, userId? }`
  - Create `server/middleware/request-logger.ts` — logs request method, path, duration, status
  - Create `server/utils/logger.ts` — structured logger with log levels (debug/info/warn/error)
  - Add queue/cron health tracking: log queue batch size, processing time, retry count, DLQ count
  - Create `GET /api/admin/health` — returns { db: 'ok', r2: 'ok', queue: 'ok', lastCronRun: timestamp }
  - Wire Alchemy logpush or console-based structured logging for production

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T6, Wave 4)
  - **Blocked By**: T3
  - **Blocks**: T7

  **Recommended Agent Profile**: `unspecified-high` with [`nuxt`]

  **QA Scenarios (MANDATORY):**
  ```
  Scenario: Health endpoint returns service status
    Tool: Bash (curl)
    Steps:
      1. `curl -s http://localhost:3000/api/admin/health` — expect 200
      2. Verify response JSON contains { db: "ok", r2: "ok", queue: "ok", lastCronRun: <ISO string> }
      3. Verify all status values are "ok"
    Expected Result: Health endpoint returns 200 with all services reporting ok
    Failure Indicators: 500 error, missing fields, any service shows "error"
    Evidence: .sisyphus/evidence/task-17-health-endpoint.txt

  Scenario: Request logger creates structured logs
    Tool: Bash (curl + grep)
    Steps:
      1. Make a test request: `curl -s http://localhost:3000/api/auth/get-session`
      2. Check server logs for structured log entry containing: `"method":"GET"`, `"path":"/api/auth/get-session"`, `"duration"`, `"status"`
      3. Verify log is valid JSON
    Expected Result: Each request produces a structured JSON log with method, path, duration, status
    Failure Indicators: No log output, unstructured text, missing fields
    Evidence: .sisyphus/evidence/task-17-request-logger.txt
  ```

  **Commit**: `feat(dashboard): add structured logging and health endpoint`

### A9. Alchemy Architecture Pattern

Use shared infra exports pattern:
```typescript
// apps/infra/alchemy.run.ts (or root alchemy.run.ts)
export const db = await D1Database('skald-db');
export const mangaBucket = await R2Bucket('skald-manga');
export const sessionKv = await KVNamespace('skald-sessions');
export const syncQueue = await Queue('sync-queue', { dlq: syncDlq });

// apps/dashboard/alchemy.run.ts
import { db, mangaBucket, sessionKv, syncQueue } from 'infra/alchemy';
// Bind all to dashboard Nuxt worker

// apps/reader/alchemy.run.ts
import { db, mangaBucket } from 'infra/alchemy';  // read-only, no queue
```
- Reader gets **read-only** bindings (DB + R2), no queue or session KV
- Dashboard gets **full** bindings (DB + R2 + KV + Queue)
- Presigned URLs: sign R2 S3 endpoint, return custom CDN URL for reads

### A10. Manga Reader Performance Best Practices (Reference)

Agents implementing T11/T12/T15 should reference these patterns:
- Preload: 5 pages ahead + next chapter on last 5 pages (Mihon)
- IntersectionObserver: threshold 0.01, rootMargin 300px
- Cache-Control for images: `public, max-age=31536000, immutable`
- LRU cache: 100MB limit, evict oldest accessed
- Chapter numbers stored as FLOAT (not string) for proper sorting
- Grayscale AVIF for manga = 70% smaller files
- Service Worker: network-first with Cache API fallback for images
- MangaDex credit display in reader UI (Acceptable Usage Policy)
- Scanlator group attribution on each chapter

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `pnpm turbo run build` + `pnpm turbo run lint` + `pnpm turbo run test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright-local` skill)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (features working together). Test edge cases: empty state, invalid input, rapid actions. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1 — everything in spec was built, nothing beyond spec was built. Check "Must NOT do" compliance. Detect cross-task contamination. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `feat(infra): initialize turborepo monorepo with alchemy IaC`
- **Wave 2**: `feat(shared): add drizzle schema and types for manga library`
- **Wave 3**: `feat(dashboard): scaffold nuxt app with better auth` + `feat(reader): scaffold nuxt app with nuxt UI`
- **Wave 4**: `feat(dashboard): add R2 storage API endpoints` + `feat(shared): add MangaDex API client`
- **Wave 5**: `feat(dashboard): add MangaDex sync queue consumer` + `feat(dashboard): add admin library management UI` + `feat(reader): add manga library browser` + `feat(reader): add MangaDex search UI`
- **Wave 6**: `feat(reader): add vertical scroll reader` + `feat(reader): add reading progress tracking` + `feat(dashboard): add admin overview and user management` + `feat(infra): add image optimization pipeline`
- **Wave 7**: `feat(reader): add offline downloads and CBZ export` + `feat(dashboard): add cron-based chapter sync`
- **Each task**: Pre-commit: `pnpm turbo run test --filter={workspace}`

---

## Success Criteria

### Verification Commands
```bash
pnpm turbo run build                    # Expected: all workspaces build successfully
pnpm turbo run test                     # Expected: all Vitest suites pass
curl -s https://dashboard.example.com/api/auth/session  # Expected: valid session JSON or 401
curl -s https://reader.example.com/api/health           # Expected: 200 OK
```

### Final Checklist
- [ ] All "Must Have" present and verified
- [ ] All "Must NOT Have" absent and verified
- [ ] All tests pass
- [ ] Evidence files exist for every task
- [ ] User can authenticate on both apps
- [ ] User can upload manga via dashboard
- [ ] User can search MangaDex and trigger import
- [ ] User can read manga in vertical scroll reader
- [ ] Reading progress persists across sessions
- [ ] Cron detects new chapters automatically
