import {
  buildMangaDexCoverUrl,
  type MangaDexManga,
  type MangaDexSearchResponse,
} from '@skald-scan/shared'

export interface MangaDexSearchItem {
  id: string
  title: string
  description: string | null
  coverUrl: string | null
  author: string | null
  status: string | null
  tags: string[]
}

export function mapMangaDexSearchResults(
  response: MangaDexSearchResponse<MangaDexManga>,
): MangaDexSearchItem[] {
  const coverFileNames = new Map<string, string>()
  for (const item of response.included ?? []) {
    if (item.type === 'cover_art') {
      coverFileNames.set(item.id, item.attributes.fileName)
    }
  }

  return response.data.map((entry) => mapMangaDexSearchItem(entry, coverFileNames))
}

function resolveCoverFileName(
  entry: MangaDexManga,
  coverFileNames: Map<string, string>,
): string | undefined {
  const coverRelationship = entry.relationships?.find((rel) => rel.type === 'cover_art')
  if (!coverRelationship) {
    return undefined
  }

  if (coverRelationship.attributes?.fileName) {
    return coverRelationship.attributes.fileName
  }

  return coverFileNames.get(coverRelationship.id)
}

export function mapMangaDexSearchItem(
  entry: MangaDexManga,
  coverFileNames: Map<string, string> = new Map(),
): MangaDexSearchItem {
  const title = pickLocalized(entry.attributes.title) ?? 'Unknown'
  const description = entry.attributes.description
    ? pickLocalized(entry.attributes.description)
    : null

  const tags = entry.attributes.tags
    ?.map((tag) => pickLocalized(tag.attributes.name))
    .filter((name): name is string => Boolean(name)) ?? []

  const coverFileName = resolveCoverFileName(entry, coverFileNames)
  const coverUrl = coverFileName
    ? buildMangaDexCoverUrl(entry.id, coverFileName, { size: 256 })
    : null

  return {
    id: entry.id,
    title,
    description,
    coverUrl,
    author: null,
    status: entry.attributes.status ?? null,
    tags,
  }
}

function pickLocalized(values: Record<string, string>): string | null {
  const preferred = values.en ?? values['ja-ro'] ?? values.ja
  if (preferred) {
    return preferred
  }

  const first = Object.values(values)[0]
  return first ?? null
}
