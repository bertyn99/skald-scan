type ImageFormat = 'webp' | 'avif' | 'json'

type ResizeFit = 'contain' | 'cover' | 'crop' | 'scale-down'

type ResizeOptions = {
  width?: number
  height?: number
  fit?: ResizeFit
  format?: ImageFormat
  quality?: number
}

const VALID_WIDTHS = [200, 400, 600, 800] as const
const MAX_WIDTH = 1200
const DEFAULT_QUALITY = 80

export const isValidWidth = (w: unknown): w is number =>
  typeof w === 'number' && VALID_WIDTHS.includes(w as typeof VALID_WIDTHS[number])

export const clampWidth = (w: number): number => {
  if (w <= 200) return 200
  if (w <= 400) return 400
  if (w <= 600) return 600
  if (w <= 800) return 800
  return MAX_WIDTH
}

export const buildResizeOptions = (w: unknown): ResizeOptions | null => {
  if (w == null) return null

  const width = typeof w === 'string' ? Number.parseInt(w, 10) : typeof w === 'number' ? w : null
  if (!width || !Number.isFinite(width) || width < 1) return null

  return {
    width: Math.min(width, MAX_WIDTH),
    fit: 'scale-down',
    format: 'webp',
    quality: DEFAULT_QUALITY,
  }
}

export const buildVariantR2Key = (baseKey: string, width: number): string => {
  const dotIndex = baseKey.lastIndexOf('.')
  if (dotIndex === -1) return `${baseKey}_${width}w`

  return `${baseKey.slice(0, dotIndex)}_${width}w${baseKey.slice(dotIndex)}`
}

export const imageResponseHeaders = (maxAge = 31536000): Record<string, string> => ({
  'Content-Type': 'image/webp',
  'Cache-Control': `public, max-age=${maxAge}, immutable`,
})
