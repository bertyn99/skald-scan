import { createReaderAuthClient } from '../../lib/auth'

export function useAuthSession() {
  const config = useRuntimeConfig()
  const token = useState<string | null>('auth-token', () => null)

  if (import.meta.client && !token.value) {
    token.value = localStorage.getItem('skald-auth-token')
  }

  const authClient = createReaderAuthClient(config.public.dashboardUrl)

  async function signIn(email: string, password: string) {
    const result = await authClient.signIn.email({ email, password })
    if (result.error) throw new Error(result.error.message)
    const bearerToken = (result.data as { token?: string } | undefined)?.token
    if (bearerToken) {
      token.value = bearerToken
      localStorage.setItem('skald-auth-token', bearerToken)
    }
    return result
  }

  async function signUp(email: string, password: string, name?: string) {
    const result = await authClient.signUp.email({
      email,
      password,
      name: name ?? email.split('@')[0] ?? 'Reader'
    })
    if (result.error) throw new Error(result.error.message)
    const bearerToken = (result.data as { token?: string } | undefined)?.token
    if (bearerToken) {
      token.value = bearerToken
      localStorage.setItem('skald-auth-token', bearerToken)
    }
    return result
  }

  async function signOut() {
    await authClient.signOut()
    token.value = null
    localStorage.removeItem('skald-auth-token')
  }

  const loggedIn = computed(() => !!token.value)
  const user = ref<{ email: string } | null>(null)

  return { loggedIn, user, signIn, signUp, signOut, token }
}
