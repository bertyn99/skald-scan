import { UserRole, sessions as sharedSessions, users as sharedUsers } from '@skald-scan/shared'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { memoryAdapter } from 'better-auth/adapters/memory'
import { drizzle } from 'drizzle-orm/d1'
import type { H3Event } from 'h3'

type AuthCloudflareEnv = {
  DB?: Parameters<typeof drizzle>[0]
}

const createDatabaseAdapter = (env?: AuthCloudflareEnv) => {
  if (env?.DB) {
    const db = drizzle(env.DB)

    return drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        user: sharedUsers,
        session: sharedSessions,
      },
    })
  }

  return memoryAdapter({
    users: [],
    sessions: [],
    accounts: [],
    verifications: [],
  })
}

export const createAuth = (env?: AuthCloudflareEnv) =>
  betterAuth({
    database: createDatabaseAdapter(env),
    emailAndPassword: {
      enabled: true,
    },
    user: {
      modelName: 'users',
      fields: {
        image: 'image_url',
      },
      additionalFields: {
        role: {
          type: [UserRole.Admin, UserRole.Reader],
          required: false,
          defaultValue: UserRole.Reader,
          input: false,
        },
      },
    },
    session: {
      modelName: 'sessions',
      fields: {
        ipAddress: 'ip_address',
        userAgent: 'user_agent',
      },
    },
  })

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
