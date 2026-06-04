export type MangaDexResult = 'ok' | 'error'

export interface MangaDexRelationship {
  id: string
  type: string
}

export interface MangaDexResource<TType extends string, TAttributes> {
  id: string
  type: TType
  attributes: TAttributes
  relationships?: MangaDexRelationship[]
}

export type MangaDexLocalizedString = Record<string, string>

export interface MangaDexTagAttributes {
  name: MangaDexLocalizedString
  description: MangaDexLocalizedString
  group: string
  version: number
}

export interface MangaDexTag extends MangaDexResource<'tag', MangaDexTagAttributes> {}

export type MangaDexContentRating = 'safe' | 'suggestive' | 'erotica' | 'pornographic'

export interface MangaDexMangaAttributes {
  title: MangaDexLocalizedString
  altTitles?: MangaDexLocalizedString[]
  description?: MangaDexLocalizedString
  status?: string
  contentRating?: MangaDexContentRating
  year?: number | null
  lastVolume?: string | null
  lastChapter?: string | null
  tags?: MangaDexTag[]
  state?: string
  chapterNumbersResetOnNewVolume?: boolean
  createdAt?: string
  updatedAt?: string
  version?: number
}

export interface MangaDexManga extends MangaDexResource<'manga', MangaDexMangaAttributes> {}

export interface MangaDexChapterAttributes {
  title?: string | null
  volume?: string | null
  chapter?: string | null
  pages: number
  translatedLanguage: string
  externalUrl?: string | null
  publishAt?: string
  readableAt?: string
  createdAt?: string
  updatedAt?: string
  version?: number
}

export interface MangaDexChapter extends MangaDexResource<'chapter', MangaDexChapterAttributes> {}

export interface MangaDexPage {
  fileName: string
  url: string
  dataSaverUrl: string
}

export interface MangaDexCoverArtAttributes {
  description?: string | null
  volume?: string | null
  fileName: string
  locale?: string | null
  createdAt?: string
  updatedAt?: string
  version?: number
}

export interface MangaDexCoverArt
  extends MangaDexResource<'cover_art', MangaDexCoverArtAttributes> {}

export interface MangaDexCoverArtWithUrl extends MangaDexCoverArt {
  url: string
}

export interface MangaDexAuthorAttributes {
  name: string
  imageUrl?: string | null
  biography?: MangaDexLocalizedString
  twitter?: string | null
  pixiv?: string | null
  melonBook?: string | null
  fanBox?: string | null
  booth?: string | null
  nicoVideo?: string | null
  skeb?: string | null
  fantia?: string | null
  tumblr?: string | null
  youtube?: string | null
  weibo?: string | null
  naver?: string | null
  website?: string | null
  createdAt?: string
  updatedAt?: string
  version?: number
}

export interface MangaDexAuthor extends MangaDexResource<'author', MangaDexAuthorAttributes> {}

export interface MangaDexSearchResponse<T> {
  result: MangaDexResult
  response: 'collection'
  data: T[]
  limit: number
  offset: number
  total: number
}

export interface MangaDexEntityResponse<T> {
  result: MangaDexResult
  response: 'entity'
  data: T
}

export interface MangaDexAtHomeChapter {
  dataHash?: string
  hash?: string
  data: string[]
  dataSaver: string[]
}

export interface MangaDexAtHomeResponse {
  result: MangaDexResult
  baseUrl: string
  chapter: MangaDexAtHomeChapter
}

export interface MangaDexErrorDetail {
  id?: string
  status?: number
  title?: string
  detail?: string
  context?: string
}

export interface MangaDexError {
  result: 'error'
  errors: MangaDexErrorDetail[]
}
