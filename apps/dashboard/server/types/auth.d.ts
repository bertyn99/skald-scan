import type { DashboardAuth, DashboardAuthSession } from '../utils/auth'

declare module 'h3' {
  interface H3EventContext {
    auth?: DashboardAuth
    authSession?: DashboardAuthSession | null
  }
}

export {}
