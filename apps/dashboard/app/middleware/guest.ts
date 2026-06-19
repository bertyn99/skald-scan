import { authClient } from '../../lib/auth'

export default defineNuxtRouteMiddleware(async () => {
  const { data: session } = await authClient.getSession({
    fetchOptions: { headers: useRequestHeaders(['cookie']) }
  })

  const user = session?.user as { role?: string } | undefined

  if (user?.role === 'admin') {
    return navigateTo('/admin')
  }
})
