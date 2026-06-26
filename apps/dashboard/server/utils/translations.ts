import { mangaTranslations } from '@skald-scan/shared'
import type { MangaDexManga } from '@skald-scan/shared'
import { and, eq, inArray, not, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'

import type { DrizzleD1Database } from './drizzle'

// Build translation rows from a MangaDex manga entity for the configured languages.
// alt_titles is flattened to a per-language string array (NOT the raw object array)
// so the manga_translations_fts trigger can tokenize values via json_each.
export function buildTranslationRows(
  mangaId: string,
  mdManga: MangaDexManga,
  languages: string[],
): Array<{
  mangaId: string
  language: string
  title: string
  description: string | null
  altTitles: string
  tags: string | null
}> {
  const attrs = mdManga.attributes
  return languages
    .map((lang) => {
      const title = attrs.title[lang]
        ?? attrs.altTitles?.find(a => a[lang])?.[lang]
      if (!title) return null

      const description = attrs.description?.[lang] ?? null

      const altTitles = JSON.stringify(
        (attrs.altTitles ?? [])
          .map(a => a[lang])
          .filter((s): s is string => typeof s === 'string')
      )

      const localizedTags = attrs.tags
        ?.map(tag => tag.attributes.name[lang]
          ?? Object.values(tag.attributes.name)[0]
          ?? '')
        .filter((name): name is string => typeof name === 'string' && name.length > 0) ?? []
      const tagsJson = localizedTags.length > 0 ? JSON.stringify(localizedTags) : null

      return { mangaId, language: lang, title, description, altTitles, tags: tagsJson }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
}

// Atomic upsert of translations for a manga. Runs as a single D1 batch:
//   - chunked INSERT ... ON CONFLICT (manga_id, language) DO UPDATE
//   - DELETE rows for languages no longer in the configured set
// Drizzle's db.batch() takes query builders and runs them in one transaction.
// Do NOT use env.DB.batch() — that takes raw D1 prepared statements.
export async function refreshMangaTranslations(
  db: DrizzleD1Database,
  mangaId: string,
  mdManga: MangaDexManga,
  languages: string[],
): Promise<{ upserted: number; removedLanguages: string[] }> {
  const rows = buildTranslationRows(mangaId, mdManga, languages)
  if (languages.length === 0) {
    return { upserted: 0, removedLanguages: [] }
  }

  const CHUNK_SIZE = 9 // D1 ~100 params/stmt; 6 cols * 9 rows = 54
  const builders: BatchItem<'sqlite'>[] = []

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)
    builders.push(
      db.insert(mangaTranslations)
        .values(chunk)
        .onConflictDoUpdate({
          target: [mangaTranslations.mangaId, mangaTranslations.language],
          set: {
            title: sql`excluded.title`,
            description: sql`excluded.description`,
            altTitles: sql`excluded.alt_titles`,
            tags: sql`excluded.tags`,
            updatedAt: new Date()
          }
        })
    )
  }

  const presentLanguages = new Set(rows.map(r => r.language))
  const removedLanguages = languages.filter(l => !presentLanguages.has(l))

  builders.push(
    db.delete(mangaTranslations).where(
      and(
        eq(mangaTranslations.mangaId, mangaId),
        not(inArray(mangaTranslations.language, languages))
      )
    )
  )

  // Drizzle's batch signature requires a non-empty tuple; cast the built array.
  await db.batch(builders as unknown as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]])

  return { upserted: rows.length, removedLanguages }
}
