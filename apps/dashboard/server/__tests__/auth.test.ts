import { describe, expect, expectTypeOf, it } from 'vitest'

import { auth, createAuth } from '../utils/auth'
import authHandler from '../api/auth/[...]'
import authMiddleware from '../middleware/auth'
import type { DashboardAuthSession } from '../utils/auth'

/**
 * Minimal structural stub matching the fields `authMiddleware` actually reads.
 * Intersects with `Partial<H3Event>` so a single `as` (not `as unknown as`)
 * suffices when handing the stub to the middleware.
 */
type MiddlewareEventStub = Partial<Parameters<typeof authMiddleware>[0]> & {
  path: string
  context: Record<string, unknown>
}

describe('auth scaffold', () => {
  it('creates Better Auth instance with role additionalFields and drizzle config', async () => {
    const authInstance = createAuth({})

    expect(authInstance).toBeDefined()
    expect(typeof authInstance.handler).toBe('function')
    expect(auth).toBeDefined()

    expect(authInstance.options.emailAndPassword?.enabled).toBe(true)
    expect(authInstance.options.user?.modelName).toBe('users')

    const roleField = authInstance.options.user?.additionalFields?.role
    expect(roleField).toBeDefined()
    expect(roleField?.defaultValue).toBe('reader')
    expect(roleField?.input).toBe(false)
    expect(roleField?.type).toEqual(['admin', 'reader'])

    expect(authInstance.options.database).toBeDefined()
    expect(typeof authInstance.options.database).toBe('function')
  })

  it('exports auth catch-all route handler as event handler function', () => {
    expect(typeof authHandler).toBe('function')
  })

  it('middleware skips /api/auth routes', async () => {
    const event = {
      path: '/api/auth/sign-in/email',
      context: {
        auth: { untouched: true },
      },
    } as MiddlewareEventStub

    await authMiddleware(event as Parameters<typeof authMiddleware>[0])
    expect(event.context.auth).toEqual({ untouched: true })
  })

  it('middleware sets auth context for non-auth routes', async () => {
    const event = {
      path: '/api/manga',
      context: {},
    } as MiddlewareEventStub

    await authMiddleware(event as Parameters<typeof authMiddleware>[0])

    const authContext = event.context.auth
    expect(authContext).toBeDefined()
    expect(typeof authContext?.handler).toBe('function')
  })

  it('exports client auth object', async () => {
    const { authClient } = await import('../../lib/auth')

    expect(authClient).toBeDefined()
    expect(typeof authClient).toBe('function')
  })

  it('auth session types are inferred from Better Auth config', () => {
    expectTypeOf<DashboardAuthSession>().toHaveProperty('user')
    expectTypeOf<DashboardAuthSession>().toHaveProperty('session')
  })
})
