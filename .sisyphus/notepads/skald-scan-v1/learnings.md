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
