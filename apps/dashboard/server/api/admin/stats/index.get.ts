import { chapters, manga, pages, sessions, users } from '@skald-scan/shared'
import { count, gt, isNull, sql } from 'drizzle-orm'
import { defineEventHandler, setResponseHeader } from 'h3'

import { useDrizzle, requireAdminRole } from '../../../utils/storage'

export default defineEventHandler(async (event) => {
  requireAdminRole(event)

  const db = useDrizzle(event)

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [
    mangaCount,
    chapterCount,
    userCount,
    activeUsersCount,
    storageSum,
  ] = await Promise.all([
    db.select({ count: count() }).from(manga).where(isNull(manga.deletedAt)).get(),
    db.select({ count: count() }).from(chapters).get(),
    db.select({ count: count() }).from(users).get(),
    db.select({ count: sql<number>`count(distinct ${sessions.userId})` })
      .from(sessions)
      .where(gt(sessions.expiresAt, sevenDaysAgo))
      .get(),
    db.select({ total: sql<number>`coalesce(sum(${pages.fileSize}), 0)` })
      .from(pages)
      .get(),
  ])

  setResponseHeader(event, 'Cache-Control', 'private, max-age=30, stale-while-revalidate=60')

  return {
    totalManga: mangaCount?.count ?? 0,
    totalChapters: chapterCount?.count ?? 0,
    totalUsers: userCount?.count ?? 0,
    activeUsers: activeUsersCount?.count ?? 0,
    totalStorageBytes: storageSum?.total ?? 0,
  }
})
