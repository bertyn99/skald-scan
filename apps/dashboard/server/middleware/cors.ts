import { defineEventHandler, getRequestHeader, setResponseHeaders } from 'h3'

export default defineEventHandler((event) => {
  const readerUrl = process.env.READER_URL ?? 'http://localhost:3001'
  const origin = getRequestHeader(event, 'origin')

  if (origin === readerUrl || origin?.startsWith('http://localhost:')) {
    setResponseHeaders(event, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true'
    })
  }

  if (event.method === 'OPTIONS') {
    event.node.res.statusCode = 204
    return ''
  }
})
