import { describe, expect, it } from 'vitest'
import { locationListSchema, shipmentListSchema, inventoryListResponseSchema, readResponseSchema, routeComparisonSchema, scenarioRecordSchema, simulationOutputSchema, forecastResponseSchema, supplierSearchResponseSchema } from '@altair/shared/contracts'
import { demoRequest, initialState } from './transport'

describe('recovered workspace demo contracts', () => {
  it('loads map geography, fictional observations and all operational lists', async () => {
    for (const [path, schema] of [['/locations', locationListSchema], ['/shipments', shipmentListSchema], ['/inventory', inventoryListResponseSchema], ['/observations', readResponseSchema]] as const) {
      expect(schema.safeParse((await demoRequest(path, undefined, initialState())).data).success, path).toBe(true)
    }
  })
  it('compares routes with the real engine and replays a frozen scenario', async () => {
    const state = initialState(), shipment = state.shipments[0]
    const route = { originId: shipment.originId, destinationId: shipment.destinationId }
    const comparison = routeComparisonSchema.parse((await demoRequest('/routes/compare', route, state)).data)
    expect(comparison.alternatives.length).toBeGreaterThan(0)
    expect(comparison.engineVersion).toContain('altair-routing')
    const created = await demoRequest('/scenarios', { name: 'Demo closure', routeRequest: route, modifications: [{ kind: 'connection', edgeId: comparison.alternatives[0].edgeIds[0], closed: true }] }, state)
    const record = scenarioRecordSchema.parse(created.data)
    const before = JSON.stringify(record.snapshot)
    const first = await demoRequest(`/scenarios/${record.id}/execute`, {}, created.state)
    const output = simulationOutputSchema.parse(first.data)
    expect(output.changes.length).toBe(1)
    expect((await demoRequest(`/scenarios/${record.id}/execute`, {}, first.state)).data).toEqual(first.data)
    expect(JSON.stringify(first.state.scenarios[0].snapshot)).toBe(before)
  })
  it('keeps mutations isolated between browser states and persists shipment milestones', async () => {
    const a = initialState(), b = initialState(), first = a.shipments[0]
    const created = await demoRequest('/shipments', { productId: first.productId, originId: first.originId, destinationId: first.destinationId, quantity: '5', unit: 'units' }, a)
    expect(created.state.shipments.length).toBe(b.shipments.length + 1)
    expect(initialState().shipments.length).toBe(b.shipments.length)
    const id = created.state.shipments.at(-1)!.id
    const event = { kind: 'milestone', status: 'in_transit', title: 'Demo departure', occurredAt: new Date().toISOString(), idempotencyKey: 'one' }
    const saved = await demoRequest(`/shipments/${id}/events`, event, created.state)
    expect(saved.state.shipments.at(-1)!.status).toBe('in_transit')
    expect((await demoRequest(`/shipments/${id}/events`, event, saved.state)).state.events.length).toBe(saved.state.events.length)
  })
  it('runs deterministic forecasting and supplier matching', async () => {
    const state = initialState()
    const forecast = forecastResponseSchema.parse((await demoRequest('/forecasts', { inventoryId: state.inventory[0].id, dailyDemand: 2 }, state)).data)
    expect(forecast.consumption.averageDaily).toBe(2)
    const suppliers = supplierSearchResponseSchema.parse((await demoRequest('/suppliers/search', {}, state)).data)
    expect(suppliers.data.length).toBeGreaterThan(0)
    expect(suppliers.data.every(s => s.availability === 'unverified')).toBe(true)
  })
})
