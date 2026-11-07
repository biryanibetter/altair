import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('../supabase/server', () => ({ createSupabaseServerClient: vi.fn() }))
import { createSupabaseServerClient } from '../supabase/server'
import { GET as trade } from '../../app/api/v1/trade/route'
import { GET as weather } from '../../app/api/v1/weather/route'
import { GET as freshness } from '../../app/api/v1/freshness/route'
import { GET as status } from '../../app/api/v1/ingestion/status/route'
import { POST as ingestion } from '../../app/api/internal/ingestion/[job]/route'

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })
describe('Next.js route wiring', () => {
  it('rejects every read route when Supabase does not verify the user', async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as never)
    for (const handler of [trade, weather, freshness, status]) {
      expect((await handler(new Request('http://localhost/api/v1/test'))).status).toBe(401)
    }
  })
  it('rejects internal requests before opening a database connection', async () => {
    vi.stubEnv('INGESTION_SECRET', 'synthetic-test-secret-at-least-32-characters')
    const result = await ingestion(new Request('http://localhost/api/internal/ingestion/weather', { method: 'POST' }), { params: Promise.resolve({ job: 'weather' }) })
    expect(result.status).toBe(401)
  })
  it('returns sanitized failures from unavailable authenticated reads', async () => {
    vi.mocked(createSupabaseServerClient).mockRejectedValue(new Error('secret connection details'))
    const response = await weather(new Request('http://localhost/api/v1/weather'))
    expect(response.status).toBe(503)
    expect(await response.text()).toBe('{"error":"service_unavailable"}')
  })
})
