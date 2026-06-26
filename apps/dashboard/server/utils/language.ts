import {
  Language,
  isLanguageCode,
  parseAcceptLanguage as parseAcceptLanguageShared
} from '@skald-scan/shared'
import type { H3Event } from 'h3'
import { getHeader } from 'h3'

import { readEventQuery } from './storage'

// Resolve the response language for a reader-facing request.
// Priority: ?lang= query param → user.preferredLanguage → Accept-Language → Language.En.
// Defensive against missing headers (test events don't always carry them).
export function resolveResponseLanguage(event: H3Event): { language: string; fallback: false } {
  const query = readEventQuery(event)
  const queryLang = typeof query.lang === 'string' ? query.lang.trim() : ''
  if (isLanguageCode(queryLang)) {
    return { language: queryLang, fallback: false }
  }

  const userPref = event.context.authSession?.user?.preferredLanguage
  if (typeof userPref === 'string' && isLanguageCode(userPref)) {
    return { language: userPref, fallback: false }
  }

  // h3's getHeader reads from event.node.req.headers; safe under h3 even when
  // the node req is missing (returns undefined). Falls back to nothing → null.
  const headerValue = safeGetHeader(event, 'accept-language')
  const fromHeader = parseAcceptLanguageShared(headerValue)
  if (fromHeader) {
    return { language: fromHeader, fallback: false }
  }

  return { language: Language.En, fallback: false }
}

// Re-exported so existing call sites in apps/dashboard keep working.
export const isValidLanguageCode = isLanguageCode
export const parseAcceptLanguage = parseAcceptLanguageShared

function safeGetHeader(event: H3Event, name: string): string | null {
  try {
    const value = getHeader(event, name)
    return typeof value === 'string' ? value : null
  } catch {
    return null
  }
}
