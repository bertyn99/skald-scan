import { authClient } from '../../lib/auth'

export default defineNuxtRouteMiddleware(async (to) => {
  const { data: session } = await authClient.getSession({
    fetchOptions: { headers: useRequestHeaders(['cookie']) }
  })

  const user = session?.user as { role?: string } | undefined

  if (user?.role === 'admin') {
    return
  }

  if (session?.user) {
    return navigateTo('/auth/forbidden')
  }

  return navigateTo(`/auth/sign-in?redirect=${encodeURIComponent(to.fullPath)}`)
})
