import { afterEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('../supabase/server', () => ({ createSupabaseServerClient: vi.fn() }))
import { createSupabaseServerClient } from '../supabase/server'
import { GET as inventory, POST as create } from '../../app/api/v1/inventory/route'
import { PATCH as patch } from '../../app/api/v1/inventory/[id]/route'
import { POST as movement } from '../../app/api/v1/inventory/movements/route'
import { POST as order } from '../../app/api/v1/inventory/orders/route'
import { PATCH as updateOrder } from '../../app/api/v1/inventory/orders/[id]/route'
import { PATCH as replenishment } from '../../app/api/v1/inventory/replenishments/[id]/route'
import { POST as forecast } from '../../app/api/v1/forecasts/route'
import { POST as suppliers } from '../../app/api/v1/suppliers/search/route'
import { POST as dependency } from '../../app/api/v1/import-dependencies/route'
afterEach(() => vi.clearAllMocks())
const id = '10000000-0000-4000-8000-000000000001'
it('all actual supply Next.js handlers reject unverified identities', async () => {
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as never)
  for (const handler of [inventory, create, movement, order, forecast, suppliers, dependency]) expect((await handler(new Request('http://localhost/api/v1/test'))).status).toBe(401)
  for (const handler of [patch, updateOrder, replenishment]) expect((await handler(new Request('http://localhost/api/v1/test'), { params: Promise.resolve({ id }) })).status).toBe(401)
})
it('supplier and trade handlers return explicit empty evidence rather than fabricated data', async () => {
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id } }, error: null }) }, rpc: async (name: string) => ({ data: name === 'intelligence_snapshot' ? { network: { nodes: [], edges: [] }, riskEvidence: { signals: [], observations: [] } } : [], error: null }) } as never)
  const search = await suppliers(new Request('http://localhost/api/v1/suppliers/search', { method: 'POST', body: '{}' }))
  expect(search.status).toBe(200); expect((await search.json()).data).toEqual([])
  const trade = await dependency(new Request('http://localhost/api/v1/import-dependencies', { method: 'POST', body: JSON.stringify({ reporter: 'Qatar', hsCode: '10', classification: 'HS2022', currency: 'QAR' }) }))
  expect(trade.status).toBe(200); expect((await trade.json()).periods).toEqual([])
})
