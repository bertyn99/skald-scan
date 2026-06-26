import { Language, isLanguageCode, parseAcceptLanguage } from '@skald-scan/shared'
import { readonly } from 'vue'

// Single source of truth for the reader's preferred manga language.
//
// Resolution priority on init():
//   1. ?lang= route query (handled by the page, not here)
//   2. user.preferredLanguage from GET /api/users/me (authenticated users;
//      always fetched even when a cookie exists, so a preference change on
//      device A propagates to device B instead of being shadowed by a stale
//      cookie)
//   3. skald-lang cookie (anonymous users)
//   4. Accept-Language header (SSR only; browsers send it)
//   5. Language.En (final fallback)
//
// NOTE: the existing useAuthSession composable does NOT hydrate user.preferredLanguage
// (it only stores an `{ email }` shape and never calls /api/users/me), so this
// composable fetches the profile itself. Hydrating useAuthSession is a
// follow-up cleanup — leaving it alone here to minimize blast radius.
const COOKIE_NAME = 'skald-lang'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export const isValidLanguageCodeReader = isLanguageCode

export function useReaderLanguage() {
  const language = useState<string>('reader-lang', () => Language.En)
  const initialized = useState<boolean>('reader-lang-init', () => false)

  async function init(): Promise<void> {
    if (initialized.value) return

    const cookie = useCookie<string | null>(COOKIE_NAME)
    const token = useState<string | null>('auth-token')

    // Authenticated users: always fetch the profile so a preference change
    // on another device wins over a stale local cookie.
    if (token.value) {
      try {
        const me = await $fetch<{ preferredLanguage?: string | null }>(
          '/api/proxy/users/me',
          { headers: { Authorization: `Bearer ${token.value}` } }
        ).catch(() => null)
        if (me?.preferredLanguage && isLanguageCode(me.preferredLanguage)) {
          language.value = me.preferredLanguage
          initialized.value = true
          return
        }
      } catch {
        // fall through to cookie
      }
    }

    // Anonymous (or profile fetch failed): cookie wins.
    if (cookie.value && isLanguageCode(cookie.value)) {
      language.value = cookie.value
      initialized.value = true
      return
    }

    // SSR-side Accept-Language. useRequestHeaders is a Nuxt composable that
    // returns {} on the client, which is fine — the cookie path above covers
    // client-side returning users.
    const headers = useRequestHeaders(['accept-language'])
    const fromHeader = parseAcceptLanguage(headers['accept-language'])
    if (fromHeader) language.value = fromHeader

    initialized.value = true
  }

  async function setLanguage(next: string): Promise<void> {
    if (!isLanguageCode(next)) return
    language.value = next

    // Persist to cookie for anonymous users and SSR-side hydration.
    const cookie = useCookie<string>(COOKIE_NAME, {
      maxAge: COOKIE_MAX_AGE,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/'
    })
    cookie.value = next

    // Best-effort persist to the user profile. Anonymous users keep the cookie
    // as the source of truth on next load. Network errors are swallowed.
    const token = useState<string | null>('auth-token')
    if (token.value) {
      await $fetch('/api/proxy/users/me/preferences', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token.value}` },
        body: { language: next }
      }).catch(() => {})
    }
  }

  return { language: readonly(language), init, setLanguage }
}
