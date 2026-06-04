import { pages } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and, asc } from 'drizzle-orm'
import { createError, defineEventHandler, readEventParam, setHeader } from 'h3'

import {
  buildPageR2Key,
  getDatabaseFromEvent,
  getStorageFromEvent,
} from '../../../../../utils/storage'

export default defineEventHandler(async (event) => {
  const mangaId = readEventParam(event, 'mangaId')
  const chapterId = readEventParam(event, 'chapterId')

  if (!mangaId || !chapterId) {
    throw createError({ statusCode: 400, statusMessage: 'mangaId and chapterId are required' })
  }

  const database = getDatabaseFromEvent(event)
  const db = drizzle(database)
  const pageRecords = await db.select({ pageNumber: pages.pageNumber, r2Key: pages.r2Key })
    .from(pages)
    .where(eq(pages.chapterId, chapterId))
    .orderBy(asc(pages.pageNumber))
    .all()

  if (pageRecords.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'No pages found for this chapter' })
  }

  const storage = getStorageFromEvent(event)

  // Build CBZ (ZIP) file in memory using minimal ZIP structure
  const files: { name: string; data: Uint8Array }[] = []

  for (const record of pageRecords) {
    const key = record.r2Key || buildPageR2Key(mangaId, chapterId, record.pageNumber)
    const object = await storage.get(key)
    if (!object?.body) continue

    const arrayBuf = await new Response(object.body).arrayBuffer()
    files.push({
      name: String(record.pageNumber).padStart(3, '0') + '.webp',
      data: new Uint8Array(arrayBuf),
    })
  }

  if (files.length === 0) {
    throw createError({ statusCode: 404, statusMessage: 'No page images could be loaded' })
  }

  const zipBuffer = buildZip(files)

  setHeader(event, 'Content-Type', 'application/vnd.comicbook+zip')
  setHeader(event, 'Content-Disposition', `attachment; filename="${chapterId}.cbz"`)
  setHeader(event, 'Cache-Control', 'private, max-age=3600')

  return zipBuffer
})

// Minimal ZIP file builder — no external dependency needed
function buildZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const encoder = new TextEncoder()
  const localHeaders: Uint8Array[] = []
  const centralHeaders: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const nameBytes = encoder.encode(file.name)
    const localHeader = new Uint8Array(30 + nameBytes.length + file.data.length)

    // Local file header signature
    const view = new DataView(localHeader.buffer)
    view.setUint32(0, 0x04034b50, true) // signature
    view.setUint16(4, 20, true) // version needed
    view.setUint16(6, 0, true) // flags
    view.setUint16(8, 0, true) // compression (stored)
    view.setUint16(10, 0, true) // mod time
    view.setUint16(12, 0, true) // mod date
    view.setUint32(14, crc32(file.data), true) // crc32
    view.setUint32(18, file.data.length, true) // compressed size
    view.setUint32(22, file.data.length, true) // uncompressed size
    view.setUint16(26, nameBytes.length, true) // filename length
    view.setUint16(28, 0, true) // extra field length

    localHeader.set(nameBytes, 30)
    localHeader.set(file.data, 30 + nameBytes.length)

    localHeaders.push(localHeader)

    // Central directory entry
    const centralEntry = new Uint8Array(46 + nameBytes.length)
    const cview = new DataView(centralEntry.buffer)
    cview.setUint32(0, 0x02014b50, true) // signature
    cview.setUint16(4, 20, true) // version made by
    cview.setUint16(6, 20, true) // version needed
    cview.setUint16(8, 0, true) // flags
    cview.setUint16(10, 0, true) // compression
    cview.setUint16(12, 0, true) // mod time
    cview.setUint16(14, 0, true) // mod date
    cview.setUint32(16, crc32(file.data), true) // crc32
    cview.setUint32(20, file.data.length, true) // compressed size
    cview.setUint32(24, file.data.length, true) // uncompressed size
    cview.setUint16(28, nameBytes.length, true) // filename length
    cview.setUint16(30, 0, true) // extra field length
    cview.setUint16(32, 0, true) // comment length
    cview.setUint16(34, 0, true) // disk number
    cview.setUint16(36, 0, true) // internal attrs
    cview.setUint32(38, 0, true) // external attrs
    cview.setUint32(42, offset, true) // local header offset

    centralEntry.set(nameBytes, 46)
    centralHeaders.push(centralEntry)

    offset += localHeader.length
  }

  const centralOffset = offset
  let centralSize = 0
  for (const c of centralHeaders) centralSize += c.length

  // End of central directory
  const eocd = new Uint8Array(22)
  const eocdView = new DataView(eocd.buffer)
  eocdView.setUint32(0, 0x06054b50, true) // signature
  eocdView.setUint16(4, 0, true) // disk number
  eocdView.setUint16(6, 0, true) // central dir disk
  eocdView.setUint16(8, files.length, true) // entries on disk
  eocdView.setUint16(10, files.length, true) // total entries
  eocdView.setUint32(12, centralSize, true) // central dir size
  eocdView.setUint32(16, centralOffset, true) // central dir offset
  eocdView.setUint16(20, 0, true) // comment length

  const totalSize = offset + centralSize + 22
  const result = new Uint8Array(totalSize)
  let pos = 0
  for (const lh of localHeaders) {
    result.set(lh, pos)
    pos += lh.length
  }
  for (const ch of centralHeaders) {
    result.set(ch, pos)
    pos += ch.length
  }
  result.set(eocd, pos)

  return result
}

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0)
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}
