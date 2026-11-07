import { afterEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('../supabase/server', () => ({ createSupabaseServerClient: vi.fn() }))
import { createSupabaseServerClient } from '../supabase/server'
import { GET as locations } from '../../app/api/v1/locations/route'
import { GET as products } from '../../app/api/v1/products/route'
import { GET as warehouses, POST as createWarehouse } from '../../app/api/v1/warehouses/route'
import { GET as shipments, POST as createShipment } from '../../app/api/v1/shipments/route'
import { GET as shipment } from '../../app/api/v1/shipments/[id]/route'
import { authenticatedIntegrationStore } from './integration'

afterEach(() => vi.clearAllMocks())
it('requires verified cookie identity for every selector and shipment operation', async () => {
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as never)
  for (const handler of [locations, products, warehouses, shipments]) expect((await handler(new Request('http://localhost/api/v1/test'))).status).toBe(401)
  for (const handler of [createWarehouse, createShipment]) expect((await handler(new Request('http://localhost/api/v1/test', { method: 'POST', body: '{}' }))).status).toBe(401)
  expect((await shipment(new Request('http://localhost/api/v1/shipments/unknown'), { params: Promise.resolve({ id: crypto.randomUUID() }) })).status).toBe(401)
})
it('uses verified identity for private inserts and never accepts a client owner', async () => {
  const writes: { table: string; payload: Record<string, unknown> }[] = []
  const client = { auth: { getUser: async () => ({ data: { user: { id: '20000000-0000-4000-8000-000000000001' } }, error: null }) }, from: (table: string) => ({ insert: (payload: Record<string, unknown>) => {
    writes.push({ table, payload })
    return { select: () => ({ single: async () => ({ data: payload, error: null }) }) }
  } }) }
  vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never)
  const store = await authenticatedIntegrationStore()
  await store!.createShipment({ productId: 'product', originId: 'origin', destinationId: 'destination', supplierId: null, quantity: '40', unit: 'kg', routeRequest: null, ownerId: 'attacker' })
  expect(writes).toEqual([{ table: 'shipments', payload: { owner_id: '20000000-0000-4000-8000-000000000001', product_id: 'product', supplier_id: null, origin_id: 'origin', destination_id: 'destination', quantity: '40', unit: 'kg', route_request: null } }])
})
