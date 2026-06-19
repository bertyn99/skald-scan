import { createAuthClient } from 'better-auth/client'

export function createReaderAuthClient(dashboardUrl: string) {
  return createAuthClient({
    baseURL: dashboardUrl,
    basePath: '/api/auth',
    fetchOptions: {
      auth: {
        type: 'Bearer',
        token: () => localStorage.getItem('skald-auth-token') ?? ''
      }
    }
  })
}
