import { pages } from '@skald-scan/shared'
import { drizzle } from 'drizzle-orm/d1'
import { eq, asc } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'

import {
  buildPageR2Key,
  getDatabaseFromEvent,
  getStorageFromEvent,
  readEventParam
} from '../../../../../utils/storage'

// CRC32 lookup table
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c
  }
  return table
})()

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = (CRC_TABLE[(crc ^ (data[i] ?? 0)) & 0xff] ?? 0) ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function writeUint16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true)
}

function writeUint32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value, true)
}

type CentralDirectoryEntry = {
  nameBytes: Uint8Array
  crc: number
  size: number
  offset: number
}

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

  // Stream the ZIP: fetch and emit ONE page at a time so peak memory stays at
  // roughly one page (~2MB) rather than buffering every page + the full ZIP.
  const encoder = new TextEncoder()
  const centralDirectory: CentralDirectoryEntry[] = []
  let localOffset = 0
  let emittedFiles = 0

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (const record of pageRecords) {
          const key = record.r2Key || buildPageR2Key(mangaId, chapterId, record.pageNumber)
          const object = await storage.get(key)
          if (!object?.body) continue

          // Hold only this single page in memory while writing it out.
          const pageBuffer = new Uint8Array(await new Response(object.body).arrayBuffer())
          const crc = crc32(pageBuffer)
          const name = `${String(record.pageNumber).padStart(3, '0')}.webp`
          const nameBytes = encoder.encode(name)

          // Local file header (30 bytes + filename)
          const header = new Uint8Array(30 + nameBytes.length)
          const view = new DataView(header.buffer)
          writeUint32(view, 0, 0x04034b50) // local file header signature
          writeUint16(view, 4, 20) // version needed
          writeUint16(view, 6, 0) // general purpose flag
          writeUint16(view, 8, 0) // compression (stored)
          writeUint16(view, 10, 0) // last mod time
          writeUint16(view, 12, 0) // last mod date
          writeUint32(view, 14, crc) // CRC-32
          writeUint32(view, 18, pageBuffer.length) // compressed size
          writeUint32(view, 22, pageBuffer.length) // uncompressed size
          writeUint16(view, 26, nameBytes.length) // filename length
          writeUint16(view, 28, 0) // extra field length
          header.set(nameBytes, 30)

          controller.enqueue(header)
          controller.enqueue(pageBuffer)

          centralDirectory.push({
            nameBytes,
            crc,
            size: pageBuffer.length,
            offset: localOffset
          })
          localOffset += header.length + pageBuffer.length
          emittedFiles += 1
        }

        if (emittedFiles === 0) {
          throw createError({ statusCode: 404, statusMessage: 'No page images could be loaded' })
        }

        // Central directory
        const centralOffset = localOffset
        let centralSize = 0

        for (const entry of centralDirectory) {
          const cdHeader = new Uint8Array(46 + entry.nameBytes.length)
          const view = new DataView(cdHeader.buffer)
          writeUint32(view, 0, 0x02014b50) // central directory signature
          writeUint16(view, 4, 20) // version made by
          writeUint16(view, 6, 20) // version needed
          writeUint16(view, 8, 0) // general purpose flag
          writeUint16(view, 10, 0) // compression (stored)
          writeUint16(view, 12, 0) // last mod time
          writeUint16(view, 14, 0) // last mod date
          writeUint32(view, 16, entry.crc) // CRC-32
          writeUint32(view, 20, entry.size) // compressed size
          writeUint32(view, 24, entry.size) // uncompressed size
          writeUint16(view, 28, entry.nameBytes.length) // filename length
          writeUint16(view, 30, 0) // extra field length
          writeUint16(view, 32, 0) // file comment length
          writeUint16(view, 34, 0) // disk number start
          writeUint16(view, 36, 0) // internal file attributes
          writeUint32(view, 38, 0) // external file attributes
          writeUint32(view, 42, entry.offset) // local header offset
          cdHeader.set(entry.nameBytes, 46)

          controller.enqueue(cdHeader)
          centralSize += cdHeader.length
        }

        // End of central directory record (22 bytes)
        const eocd = new Uint8Array(22)
        const eocdView = new DataView(eocd.buffer)
        writeUint32(eocdView, 0, 0x06054b50) // EOCD signature
        writeUint16(eocdView, 4, 0) // disk number
        writeUint16(eocdView, 6, 0) // disk with CD start
        writeUint16(eocdView, 8, centralDirectory.length) // entries on this disk
        writeUint16(eocdView, 10, centralDirectory.length) // total entries
        writeUint32(eocdView, 12, centralSize) // central directory size
        writeUint32(eocdView, 16, centralOffset) // central directory offset
        writeUint16(eocdView, 20, 0) // comment length

        controller.enqueue(eocd)
        controller.close()
      } catch (error) {
        controller.error(error instanceof Error ? error : new Error(String(error)))
      }
    }
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.comicbook+zip',
      'Content-Disposition': `attachment; filename="${chapterId}.cbz"`,
      'Cache-Control': 'private, max-age=3600'
    }
  })
})
