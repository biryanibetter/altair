import { afterEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('../supabase/server', () => ({ createSupabaseServerClient: vi.fn() }))
import { createSupabaseServerClient } from '../supabase/server'
import { POST } from '../../app/api/v1/routes/compare/route'
afterEach(() => vi.clearAllMocks())
it('routes compare rejects unverified users and returns a disconnected authenticated network', async () => {
  const req = () => new Request('http://localhost/api/v1/routes/compare', { method: 'POST', body: JSON.stringify({ originId: '00000000-0000-4000-8000-000000000001', destinationId: '00000000-0000-4000-8000-000000000002' }) })
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as never)
  expect((await POST(req())).status).toBe(401)
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'user' } }, error: null }) }, rpc: async () => ({ data: { network: { nodes: [1, 2].map(n => ({ id: `00000000-0000-4000-8000-00000000000${n}`, name: 'node', kind: 'hub', country_code: 'QA', longitude: null, latitude: null })), edges: [] }, riskEvidence: { signals: [], observations: [] } }, error: null }) } as never)
  const res = await POST(req()); expect(res.status).toBe(200)
  expect((await res.json()).reasons).toContain('no_feasible_path')
})
