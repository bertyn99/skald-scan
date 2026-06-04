import { manga, chapters, users } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { count, sql } from 'drizzle-orm'
import { defineEventHandler } from 'h3'

import { getDatabaseFromEvent } from '../../utils/storage'

export default defineEventHandler(async (event) => {
  const database = getDatabaseFromEvent(event)
  const db = drizzle(database)

  const [mangaCount, chapterCount, userCount] = await Promise.all([
    db.select({ count: count() }).from(manga).get(),
    db.select({ count: count() }).from(chapters).get(),
    db.select({ count: count() }).from(users).get(),
  ])

  return {
    totalManga: mangaCount?.count ?? 0,
    totalChapters: chapterCount?.count ?? 0,
    totalUsers: userCount?.count ?? 0,
  }
})
