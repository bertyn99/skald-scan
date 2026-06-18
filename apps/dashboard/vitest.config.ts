import { defineConfig } from 'vitest/config'

// `nitro-test-utils` is installed (plan amendment A12) but not yet wired up.
// v3.0.2 requires a newer `nitro` than the deprecated `nitro@3.0.0` currently
// resolved transitively here (`nitro/builder` subpath is not exported), and the
// in-process global server it starts would also conflict with the existing
// per-handler `vi.mock` tests. Migration is TODO once nitro is upgraded and
// tests are rewritten to use `$fetchRaw` instead of manual event fixtures.
export default defineConfig({
  test: {
    include: ['server/__tests__/**/*.test.ts'],
    environment: 'node'
  }
})
