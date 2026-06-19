import { defineEventHandler } from 'h3'

export default defineEventHandler(() => ({
  ok: true,
  service: 'skald-scan-dashboard',
  timestamp: Date.now()
}))
