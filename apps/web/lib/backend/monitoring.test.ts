import { afterEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('../supabase/server', () => ({ createSupabaseServerClient: vi.fn() }))
import { createSupabaseServerClient } from '../supabase/server'
import { GET as config, PUT as configure } from '../../app/api/v1/monitoring/config/route'
import { POST as evaluate } from '../../app/api/v1/monitoring/evaluate/route'
import { GET as alerts } from '../../app/api/v1/alerts/route'
import { PATCH as transition } from '../../app/api/v1/alerts/[id]/route'
import { GET as observations } from '../../app/api/v1/observations/route'
import { POST as scheduled } from '../../app/api/internal/monitoring/route'
afterEach(() => vi.clearAllMocks())
const id = '10000000-0000-4000-8000-000000000001'
it('all actual monitoring routes reject unverified identities and internal scheduler calls', async () => {
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as never)
  for (const handler of [config, configure, evaluate, alerts, observations]) expect((await handler(new Request('http://localhost/api/v1/test'))).status).toBe(401)
  expect((await transition(new Request('http://localhost/api/v1/test'), { params: Promise.resolve({ id }) })).status).toBe(401)
  vi.stubEnv('INGESTION_SECRET', 'a'.repeat(32))
  try { expect((await scheduled(new Request('http://localhost/api/internal/monitoring', { method: 'POST' }))).status).toBe(401) }
  finally { vi.unstubAllEnvs() }
})
it('maps owner-JWT configuration RPC conflicts without exposing database details', async () => {
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id } }, error: null }) }, rpc: async () => ({ data: null, error: { message: 'monitoring_configuration_changed sensitive details' } }) } as never)
  const response = await evaluate(new Request('http://localhost/api/v1/monitoring/evaluate', { method: 'POST', body: '{}' }))
  expect(response.status).toBe(409)
  expect(JSON.stringify(await response.json())).not.toContain('sensitive')
})
