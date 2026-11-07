import { describe, expect, it } from 'vitest'
import { createIngestionHandler, createReadHandler } from '../src/http'
import type { Reader } from '../src/read'
import { createJobs } from '../src/providers'

const secret = 'synthetic-test-secret-at-least-32-characters'
const request = (token = secret) => new Request('http://localhost/api/internal/ingestion/weather', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
describe('HTTP boundaries', () => {
  it('requires valid scheduler credentials before touching persistence', async () => {
    const handler = createIngestionHandler({ secret, jobs: createJobs({}), run: async () => { throw new Error('should not run') } })
    expect((await handler(request('bad'), 'weather')).status).toBe(401)
    expect((await createIngestionHandler({ secret: undefined, jobs: createJobs({}), run: async () => { throw new Error('should not run') } })(request(), 'weather')).status).toBe(503)
    expect((await handler(request(), 'not-allowlisted')).status).toBe(404)
  })
  it('maps busy/deferred and hides internal failures', async () => {
    const handler = createIngestionHandler({ secret, jobs: createJobs({}), run: async job => ({ job: job.id, status: 'busy', count: 0 }) })
    expect((await handler(request(), 'weather')).status).toBe(409)
    const broken = createIngestionHandler({ secret, jobs: createJobs({}), run: async () => { throw new Error('postgres password SECRET') } })
    const r = await broken(request(), 'weather')
    expect(r.status).toBe(503)
    expect(await r.text()).not.toContain('SECRET')
  })
  it('requires a verified user for read APIs', async () => {
    expect((await createReadHandler('weather', async () => null)(new Request('http://localhost/api/v1/weather'))).status).toBe(401)
  })
  it('rejects invalid filters and returns explicit unavailable rather than fabricated data', async () => {
    const reader: Reader = { observations: async () => [], status: async () => [] }
    const handler = createReadHandler('weather', async () => reader)
    expect((await handler(new Request('http://localhost/api/v1/weather?limit=101'))).status).toBe(400)
    expect((await handler(new Request('http://localhost/api/v1/weather?job=comtrade'))).status).toBe(400)
    expect((await handler(new Request('http://localhost/api/v1/weather?limit=1&limit=2'))).status).toBe(400)
    const response = await handler(new Request('http://localhost/api/v1/weather'))
    expect(await response.json()).toEqual({ data: [], meta: { availability: 'unavailable', nextCursor: null } })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
})
