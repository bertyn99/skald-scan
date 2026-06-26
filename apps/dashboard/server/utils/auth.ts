import {
  UserRole,
  accounts as sharedAccounts,
  sessions as sharedSessions,
  users as sharedUsers,
  verifications as sharedVerifications
} from '@skald-scan/shared'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { bearer } from 'better-auth/plugins'
import { memoryAdapter } from 'better-auth/adapters/memory'
import type { H3Event } from 'h3'

import { type D1Binding, useDrizzle } from './drizzle'

type AuthCloudflareEnv = {
  DB?: D1Binding
  BETTER_AUTH_SECRET?: string
  BETTER_AUTH_URL?: string
  READER_URL?: string
}

const createDatabaseAdapter = (env?: AuthCloudflareEnv) => {
  if (env?.DB) {
    const db = useDrizzle(env.DB)

    return drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        users: sharedUsers,
        sessions: sharedSessions,
        accounts: sharedAccounts,
        verifications: sharedVerifications
      }
    })
  }

  return memoryAdapter({
    users: [],
    sessions: [],
    accounts: [],
    verifications: []
  })
}

export const createAuth = (env?: AuthCloudflareEnv) => {
  const readerUrl = env?.READER_URL ?? process.env.READER_URL ?? 'http://localhost:3001'
  const dashboardUrl = env?.BETTER_AUTH_URL ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
  const secret = env?.BETTER_AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET

  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('BETTER_AUTH_SECRET is required in production')
  }

  return betterAuth({
    secret: secret ?? 'dev-only-secret-change-me',
    baseURL: dashboardUrl,
    trustedOrigins: [dashboardUrl, readerUrl],
    database: createDatabaseAdapter(env),
    emailAndPassword: {
      enabled: true
    },
    plugins: [bearer()],
    user: {
      modelName: 'users',
      additionalFields: {
        role: {
          type: [UserRole.Admin, UserRole.Reader],
          required: false,
          defaultValue: UserRole.Reader,
          input: false
        },
        preferredLanguage: {
          type: 'string',
          required: false,
          // No defaultValue: leaving the column NULL is what we want for
          // "user hasn't picked yet" — `null` would work but Better Auth's
          // string-typed additionalField validates defaultValue against the
          // string type, so omitting it avoids a runtime type mismatch.
          // input: false — the field is updated only via our
          // PUT /api/users/me/preferences endpoint (which validates against
          // the Language enum). Allowing signUp to set it would let a
          // malicious client store arbitrary strings.
          input: false
        }
      }
    },
    session: {
      modelName: 'sessions'
    },
    account: {
      modelName: 'accounts'
    },
    verification: {
      modelName: 'verifications'
    }
  })
}

const getCloudflareEnv = (event: H3Event): AuthCloudflareEnv | undefined => {
  const maybeContext = event.context as {
    cloudflare?: {
      env?: AuthCloudflareEnv
    }
  }

  return maybeContext.cloudflare?.env
}

export const getAuthFromEvent = (event: H3Event) => createAuth(getCloudflareEnv(event))

export const auth = createAuth()

export type DashboardAuth = ReturnType<typeof createAuth>
export type DashboardAuthSession = DashboardAuth['$Infer']['Session']
