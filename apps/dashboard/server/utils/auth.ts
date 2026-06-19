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
import { drizzle } from 'drizzle-orm/d1'
import { count, eq } from 'drizzle-orm'
import type { H3Event } from 'h3'

type AuthCloudflareEnv = {
  DB?: Parameters<typeof drizzle>[0]
  BETTER_AUTH_SECRET?: string
  BETTER_AUTH_URL?: string
  READER_URL?: string
}

const createDatabaseAdapter = (env?: AuthCloudflareEnv) => {
  if (env?.DB) {
    const db = drizzle(env.DB)

    return drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        user: sharedUsers,
        session: sharedSessions,
        account: sharedAccounts,
        verification: sharedVerifications
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
      fields: {
        image: 'image_url'
      },
      additionalFields: {
        role: {
          type: [UserRole.Admin, UserRole.Reader],
          required: false,
          defaultValue: UserRole.Reader,
          input: false
        }
      }
    },
    session: {
      modelName: 'sessions',
      fields: {
        ipAddress: 'ip_address',
        userAgent: 'user_agent'
      }
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            if (!env?.DB) return
            const db = drizzle(env.DB)
            const userCount = await db.select({ count: count() }).from(sharedUsers).get()
            if ((userCount?.count ?? 0) <= 1 && user.role !== UserRole.Admin) {
              await db.update(sharedUsers)
                .set({ role: UserRole.Admin, updatedAt: Date.now() })
                .where(eq(sharedUsers.id, user.id))
            }
          }
        }
      }
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
