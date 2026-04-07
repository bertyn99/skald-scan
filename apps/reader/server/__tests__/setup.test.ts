import { describe, it, expect, vi, beforeEach } from 'vitest'
import proxyHandler from '../api/proxy/[...]'
import * as h3 from 'h3'

// Mock h3
vi.mock('h3', () => {
  return {
    defineEventHandler: vi.fn((handler) => handler),
    getMethod: vi.fn(() => 'GET'),
    getHeaders: vi.fn(() => ({ host: 'localhost', 'user-agent': 'test' })),
    readRawBody: vi.fn(),
    setResponseHeaders: vi.fn(),
    setResponseHeader: vi.fn(),
  }
})

// Mock useRuntimeConfig
globalThis.useRuntimeConfig = vi.fn(() => ({
  public: {
    dashboardUrl: 'http://localhost:3000'
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

  it('strips prefix correctly and forwards request', async () => {
    const event = {
      node: {
        req: { url: '/api/proxy/api/manga' }
      }
    } as any

    await proxyHandler(event)

    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/manga', expect.objectContaining({
      method: 'GET',
      headers: { 'user-agent': 'test' }, // host should be stripped
      body: undefined
    }))
  })
})
