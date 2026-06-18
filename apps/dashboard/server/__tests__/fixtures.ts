import { vi } from 'vitest'
import type { H3Event } from 'h3'

// ─── Types ──────────────────────────────────────────────

type UserRole = 'admin' | 'reader'

interface TestAuthUser {
  id: string
  role: UserRole
}

interface TestAuthSession {
  session: { id: string }
  user: TestAuthUser
}

type AuthConfig = boolean | { userId?: string; role?: UserRole }

interface MockD1Statement {
  onBind?: (args: unknown[]) => void
  allResult?: { results: Record<string, unknown>[]; meta?: unknown }
  firstResult?: Record<string, unknown> | null
  runResult?: { success: boolean; meta?: unknown }
}

interface TestEnv {
  DB?: D1Database
  STORAGE?: R2Bucket
  SYNC_QUEUE?: { send: (message: unknown) => Promise<void> }
  SESSIONS?: { get: (key: string) => Promise<string | null>; put: (key: string, value: string) => Promise<void> }
}

interface TestEventConfig {
  auth?: AuthConfig
  env?: TestEnv
  body?: unknown
  params?: Record<string, string>
  query?: Record<string, unknown>
  method?: string
  path?: string
  headers?: Record<string, string>
}

// ─── Auth Session Builder ───────────────────────────────

function buildAuthSession(auth: AuthConfig | undefined): TestAuthSession | null {
  if (!auth) return null
  if (auth === true) {
    return {
      session: { id: 'session-test' },
      user: { id: 'user-test', role: 'admin' }
    }
  }
  return {
    session: { id: 'session-test' },
    user: {
      id: auth.userId ?? 'user-test',
      role: auth.role ?? 'admin'
    }
  }
}

// ─── Mock D1 Database ───────────────────────────────────

export function createMockD1(statements: MockD1Statement[] = []): D1Database {
  const queue = [...statements]
  return {
    prepare: vi.fn(() => {
      const stmt = queue.shift() ?? {}
      let bound = false
      return {
        bind: (...args: unknown[]) => {
          bound = true
          stmt.onBind?.(args)
          return {
            all: vi.fn().mockResolvedValue(stmt.allResult ?? { results: [] }),
            first: vi.fn().mockResolvedValue(stmt.firstResult ?? null),
            run: vi.fn().mockResolvedValue(stmt.runResult ?? { success: true }),
            raw: vi.fn().mockResolvedValue(
              stmt.allResult
                ? stmt.allResult.results.map((r) => Object.values(r))
                : stmt.firstResult
                  ? [Object.values(stmt.firstResult)]
                  : []
            )
          }
        },
        all: vi.fn().mockResolvedValue(stmt.allResult ?? { results: [] }),
        first: vi.fn().mockResolvedValue(stmt.firstResult ?? null),
        run: vi.fn().mockResolvedValue(stmt.runResult ?? { success: true }),
        raw: vi.fn().mockResolvedValue(
          stmt.allResult
            ? stmt.allResult.results.map((r) => Object.values(r))
            : stmt.firstResult
              ? [Object.values(stmt.firstResult)]
              : []
        )
      }
    }),
    batch: vi.fn().mockResolvedValue([]),
    exec: vi.fn().mockResolvedValue({ success: true })
  } as D1Database
}

// ─── Mock R2 Bucket ─────────────────────────────────────

interface MockR2Object {
  body: ReadableStream<Uint8Array>
  httpEtag: string
  httpMetadata?: { contentType?: string }
  arrayBuffer: () => Promise<ArrayBuffer>
  text: () => Promise<string>
}

export function createMockR2(
  storage: Record<string, MockR2Object> = {},
  overrides: Partial<R2Bucket> = {}
): R2Bucket {
  return {
    get: vi.fn(async (key: string): Promise<MockR2Object | null> => {
      return storage[key] ?? null
    }),
    put: vi.fn(async (key: string, _value: unknown): Promise<void> => {
      // Track the put if needed
    }),
    delete: vi.fn(async (_key: string): Promise<void> => {}),
    list: vi.fn().mockResolvedValue({ objects: [] }),
    head: vi.fn().mockResolvedValue(null),
    ...overrides
  } as R2Bucket
}

// ─── Mock Queue ─────────────────────────────────────────

export function createMockQueue() {
  const sent: unknown[] = []
  return {
    send: vi.fn(async (message: unknown): Promise<void> => {
      sent.push(message)
    }),
    _sent: sent
  }
}

// ─── Test Event Builder ─────────────────────────────────

export function createTestEvent(config: TestEventConfig = {}): H3Event {
  const authSession = buildAuthSession(config.auth)

  const event = {
    method: config.method ?? 'GET',
    path: config.path ?? '/',
    node: {
      req: {
        headers: config.headers ?? {}
      },
      res: {
        statusCode: 200,
        setHeader: vi.fn(),
        getHeader: vi.fn()
      }
    },
    context: {
      cloudflare: {
        env: {
          DB: createMockD1(),
          STORAGE: createMockR2(),
          SYNC_QUEUE: createMockQueue(),
          ...config.env
        }
      },
      authSession,
      body: config.body,
      params: config.params,
      query: config.query
    },
    waitUntil: vi.fn(),
    _setup: vi.fn()
  }

  return event as unknown as H3Event
}

// ─── Typed Helpers ──────────────────────────────────────

/**
 * Create an admin-authenticated event for testing write endpoints.
 */
export function createAdminEvent(config: Omit<TestEventConfig, 'auth'> = {}): H3Event {
  return createTestEvent({ ...config, auth: { role: 'admin' } })
}

/**
 * Create a reader-authenticated event for testing permission denials.
 */
export function createReaderEvent(config: Omit<TestEventConfig, 'auth'> = {}): H3Event {
  return createTestEvent({ ...config, auth: { role: 'reader' } })
}

/**
 * Create an unauthenticated event for testing 401 responses.
 */
export function createAnonymousEvent(config: Omit<TestEventConfig, 'auth'> = {}): H3Event {
  return createTestEvent({ ...config, auth: false })
}

// ─── Type Guards ────────────────────────────────────────

export function isCreateError(value: unknown): value is { statusCode: number; statusMessage: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'statusCode' in value &&
    'statusMessage' in value
  )
}

export function expectThrowWithStatus(statusCode: number) {
  return async (fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn()
      throw new Error(`Expected function to throw with status ${statusCode}, but it did not throw`)
    } catch (error) {
      if (isCreateError(error)) {
        if (error.statusCode !== statusCode) {
          throw new Error(`Expected status ${statusCode}, got ${error.statusCode}: ${error.statusMessage}`)
        }
        return
      }
      throw error
    }
  }
}

// ─── Re-exports for convenience ─────────────────────────

export type {
  MockD1Statement,
  TestAuthSession,
  TestEnv,
  TestEventConfig,
  AuthConfig
}
