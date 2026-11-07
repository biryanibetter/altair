import { expect, it } from 'vitest'
import { createSupplyHandler, type SupplyStore } from '../src/supply/http'
import { observationSchema, riskSignalIntelligenceSchema, scenarioInputSchema, scenarioSnapshotSchema } from '@altair/shared/contracts'
import { graph, now, provenance, request as routeRequest } from './routing-fixtures'

const id = '10000000-0000-4000-8000-000000000001'
const post = (body: unknown) => new Request('http://localhost/api/v1/forecasts', { method: 'POST', body: JSON.stringify(body) })
it('authenticates all supply actions and rejects caller-controlled ownership and malformed queries', async () => {
  for (const action of ['list', 'create', 'patch', 'movement', 'order', 'updateOrder', 'replenishment', 'forecast', 'suppliers', 'dependency'] as const) {
    const res = await createSupplyHandler(action, async () => null)(post({}), id)
    expect(res.status).toBe(401); expect(res.headers.get('Cache-Control')).toBe('no-store')
  }
  const authorize = async () => ({}) as SupplyStore
  expect((await createSupplyHandler('forecast', authorize)(post({ inventoryId: id, ownerId: id }))).status).toBe(400)
  expect((await createSupplyHandler('list', authorize)(new Request('http://localhost/api/v1/inventory?limit=2&limit=3'))).status).toBe(400)
})
it('returns indistinguishable missing/cross-owner inventory and scenario errors without leaking storage details', async () => {
  const authorize = async () => ({ snapshot: async () => null }) as unknown as SupplyStore
  expect((await createSupplyHandler('forecast', authorize)(post({ inventoryId: id }))).status).toBe(404)
  const broken = async () => { throw Error('SECRET database details') }
  const res = await createSupplyHandler('forecast', broken)(post({ inventoryId: id }))
  expect(res.status).toBe(503); expect(JSON.stringify(await res.json())).not.toContain('SECRET')
})
it('connects active crisis origin exposure through explicit native-country mappings', async () => {
  const network = graph(), countryCode = network.nodes[0]!.countryCode
  const row = observationSchema.parse({ job: 'qatar-imports', provider: 'qatar-open-data', recordKey: 'one', sourceId: id, sourceUrl: 'https://example.com', license: 'test', nature: 'historical', observedAt: now, fetchedAt: now, expiresAt: '2027-01-01T00:00:00.000Z', sourceUpdatedAt: null, data: { kind: 'trade', period: '2024', reporter: 'Qatar', partner: 'Native country name', hsCode: '1006', classification: 'HS2022', description: null, flow: 'import', value: '10', currency: 'QAR', weightKg: null } })
  const signal = riskSignalIntelligenceSchema.parse({ id, category: 'geopolitical', severity: 'critical', observedAt: now, validUntil: '2026-11-08T12:00:00.000Z', target: { kind: 'node', id: network.nodes[0]!.id }, evidence: 'Hypothetical exposure', provenance, status: 'potential', rule: 'structured-evidence-v1', nature: 'simulated' })
  const store = { trade: async () => [row], suppliers: async () => [], intelligence: async () => ({ network, signals: [signal] }) } as unknown as SupplyStore
  const response = await createSupplyHandler('dependency', async () => store, () => now)(post({ reporter: 'Qatar', hsCode: '1006', classification: 'HS2022', currency: 'QAR', originCountryMappings: [{ origin: 'Native country name', countryCode }] }))
  expect(response.status).toBe(200)
  expect((await response.json()).periods[0].exposedShare).toBe(1)
})
it('rejects a scenario ID whose immutable stock baseline no longer matches current operations', async () => {
  const baseline = scenarioSnapshotSchema.parse({ version: 1, evaluatedAt: now, network: graph(), risks: [], inventory: [{ id, productId: id, warehouseId: id, quantity: '100', unit: 'kg' }], shipments: [], supplierIds: [], references: {} })
  const current = structuredClone(baseline); current.inventory[0]!.quantity = '10'
  const input = scenarioInputSchema.parse({ name: 'Old scenario', routeRequest: routeRequest(), hypothetical: true, modifications: [] })
  const store = { snapshot: async () => ({ baseline: current, supply: { evaluatedAt: now, inventory: { ...current.inventory[0], reservedQuantity: '0', historyStart: null }, movements: [], orders: [], replenishments: [] } }), scenario: async () => ({ engineVersion: 'altair-twin-1.0.0', input, snapshot: baseline }) } as unknown as SupplyStore
  const response = await createSupplyHandler('forecast', async () => store)(post({ inventoryId: id, scenarioId: id, dailyDemand: 1 }))
  expect(response.status).toBe(409)
  expect((await response.json()).error).toBe('scenario_baseline_changed')
  current.inventory[0]!.quantity = '100'
  expect((await createSupplyHandler('forecast', async () => store)(post({ inventoryId: id, scenarioId: id, dailyDemand: 1 }))).status).toBe(200)
})
