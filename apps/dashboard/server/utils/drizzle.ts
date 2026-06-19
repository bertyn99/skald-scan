import { drizzle } from 'drizzle-orm/d1'
import type { H3Event } from 'h3'

export type D1Binding = Parameters<typeof drizzle>[0]
export type DrizzleD1Database = ReturnType<typeof drizzle>

const drizzleByBinding = new WeakMap<D1Binding, DrizzleD1Database>()

function isH3Event(source: H3Event | D1Binding): source is H3Event {
  return typeof source === 'object' && source !== null && 'context' in source
}

export function getD1Binding(event: H3Event): D1Binding {
  const maybeContext = event.context as {
    cloudflare?: {
      env?: {
        DB?: D1Binding
      }
    }
  }

  const binding = maybeContext.cloudflare?.env?.DB

  if (!maybeContext.cloudflare?.env) {
    throw new Error('Cloudflare env bindings are required')
  }

  if (!binding) {
    throw new Error('Cloudflare DB binding is required')
  }

  return binding
}

export function useDrizzle(source: H3Event | D1Binding): DrizzleD1Database {
  const binding = isH3Event(source) ? getD1Binding(source) : source

  let db = drizzleByBinding.get(binding)

  if (!db) {
    db = drizzle(binding)
    drizzleByBinding.set(binding, db)
  }

  return db
}
