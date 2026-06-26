import { describe, it, expect, vi, beforeEach } from 'vitest'
import proxyHandler from '../api/proxy/[...]'
import * as h3 from 'h3'

// Mock h3
vi.mock('h3', () => {
  return {
    defineEventHandler: vi.fn((handler) => handler),
    getMethod: vi.fn(() => 'GET'),
    getHeader: vi.fn(() => null),
    getHeaders: vi.fn(() => ({ host: 'localhost', 'user-agent': 'test' })),
    readRawBody: vi.fn(),
    setResponseHeaders: vi.fn(),
    setResponseHeader: vi.fn(),
  }
})

// Mock useRuntimeConfig
globalThis.useRuntimeConfig = vi.fn(() => ({
  public: {
    dashboardUrl: 'http://localhost:3000',
    readerUrl: 'http://localhost:3001'
  }
})) as any

// Mock fetch
globalThis.fetch = vi.fn(async () => {
  const headers = new Map()
  headers.set('content-type', 'application/json')
  return {
    headers,
    body: 'mock body'
  }
}) as any

describe('Proxy Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('is properly defined', () => {
    expect(typeof proxyHandler).toBe('function')
  })

  it('strips prefix and prepends /api when missing', async () => {
    const event = {
      path: '/api/proxy/manga',
      node: {
        req: { url: '/api/proxy/manga' }
      }
    } as any

    await proxyHandler(event)

    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/manga', expect.objectContaining({
      method: 'GET',
      headers: { 'user-agent': 'test' },
      body: undefined
    }))
  })

  it('preserves /api prefix when already present', async () => {
    const event = {
      path: '/api/proxy/api/manga',
      node: {
        req: { url: '/api/proxy/api/manga' }
      }
    } as any

    await proxyHandler(event)

    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/manga', expect.objectContaining({
      method: 'GET'
    }))
  })

  it('forwards Authorization header', async () => {
    vi.mocked(h3.getHeaders).mockReturnValueOnce({
      host: 'localhost',
      authorization: 'Bearer test-token'
    })

    const event = {
      path: '/api/proxy/reading-progress',
      node: { req: { url: '/api/proxy/reading-progress' } }
    } as any

    await proxyHandler(event)

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/reading-progress',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer test-token' })
      })
    )
  })
})
