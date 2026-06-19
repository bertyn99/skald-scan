import { createAuthClient } from 'better-auth/client'

export const authClient = createAuthClient({
  basePath: '/api/auth'
})

export type AuthUser = {
  id: string
  email: string
  name?: string | null
  role: 'admin' | 'reader'
}
