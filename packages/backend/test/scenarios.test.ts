import { describe, expect, it } from 'vitest'
import { scenarioInputSchema, scenarioSnapshotSchema, simulationOutputSchema } from '@altair/shared/contracts'
import { simulateScenario, TWIN_ENGINE_VERSION } from '../src/intelligence/scenarios'
import { graph, request, id, now } from './routing-fixtures'

export const snapshot = () => scenarioSnapshotSchema.parse({ version: 1, evaluatedAt: now, network: graph(), risks: [], inventory: [{ id: id(50), productId: id(51), warehouseId: id(52), quantity: '100.000', unit: 'kg' }], shipments: [{ id: id(60), supplierId: id(61), productId: id(51), estimatedArrival: '2026-11-07T00:00:00.000Z', status: 'planned', originId: id(1), destinationId: id(4) }], supplierIds: [id(61)], references: { capturedBy: 'test: explicitly hypothetical' } })
export const scenarioInput = (modifications: unknown[] = []) => scenarioInputSchema.parse({ name: 'HYPOTHETICAL Qatar disruption', routeRequest: request(), horizonHours: 24, hypothetical: true, assumptions: ['All demo connections and quantities are hypothetical'], demand: [{ productId: id(51), unit: 'kg', quantity: '120.00' }], replenishments: [{ shipmentId: id(60), quantity: '50.00', unit: 'kg' }], modifications })
describe('isolated repeatable digital twin', () => {
  it('closes a route, reranks alternatives and never changes the baseline', () => {
    const s = snapshot(), before = JSON.stringify(s)
    const result = simulateScenario(s, scenarioInput([{ kind: 'connection', edgeId: id(13), closed: true }]), TWIN_ENGINE_VERSION)
    expect(simulationOutputSchema.safeParse(result).success).toBe(true)
    expect(result.baseline.routes.alternatives).toHaveLength(3)
    expect(result.simulated.routes.alternatives).toHaveLength(2)
    expect(result.routeChanges.lostRouteIds).toContain(id(13))
    expect(JSON.stringify(s)).toBe(before)
    expect(simulateScenario(s, scenarioInput([{ kind: 'connection', edgeId: id(13), closed: true }]), TWIN_ENGINE_VERSION)).toEqual(result)
  })
  it('applies simultaneous capacity, cost, time, supplier, stock and demand disruptions', () => {
    const input = scenarioInput([{ kind: 'connection', edgeId: id(13), capacityFactor: 0.01 }, { kind: 'connection', edgeId: id(11), costFactor: 2, timeFactor: 3 }, { kind: 'supplier_unavailable', supplierId: id(61) }, { kind: 'inventory_reduction', inventoryId: id(50), quantity: '20.00' }, { kind: 'demand_increase', productId: id(51), unit: 'kg', quantity: '10.00' }])
    const r = simulateScenario(snapshot(), input, TWIN_ENGINE_VERSION)
    expect(r.baseline.supply[0].available).toBe('150.00'); expect(r.baseline.supply[0].shortage).toBe('0.00')
    expect(r.simulated.supply[0].available).toBe('80.00'); expect(r.simulated.supply[0].shortage).toBe('50.00')
    const changed = r.simulated.routes.alternatives.find(a => a.edgeIds[0] === id(11))!
    expect(changed.cost.total!.amount).toBe('0.40'); expect(changed.durationHours!.max).toBe(48)
    expect(r.changes).toHaveLength(5)
  })
  it('delays replenishment beyond the horizon and computes exact supply quantities', () => {
    const r = simulateScenario(snapshot(), scenarioInput([{ kind: 'replenishment_delay', shipmentId: id(60), delayHours: 24 }]), TWIN_ENGINE_VERSION)
    expect(r.simulated.supply[0].available).toBe('100.00'); expect(r.simulated.supply[0].shortage).toBe('20.00')
    expect(r.simulated.supply[0].reasons).toContain('replenishment_outside_horizon')
  })
  it('does not claim a complete shortage when replenishment search was truncated', () => {
    const input = scenarioInput()
    input.replenishments[0].routeRequest = request({ constraints: { maxExpansions: 1 } })
    const r = simulateScenario(snapshot(), input, TWIN_ENGINE_VERSION)
    expect(r.baseline.supply[0].complete).toBe(false)
    expect(r.baseline.supply[0].available).toBeNull()
    expect(r.baseline.supply[0].shortage).toBeNull()
    expect(r.baseline.supply[0].reasons).toContain('replenishment_route_search_incomplete')
  })
  it('does not manufacture absent supply baselines, capacities or currencies', () => {
    const s = snapshot(); s.network.edges[2].metadata!.capacityKg = null; s.network.edges[2].metadata!.costs = []
    const r = simulateScenario(s, scenarioInput([{ kind: 'connection', edgeId: id(13), capacityFactor: 0.5, costFactor: 2 }]), TWIN_ENGINE_VERSION)
    expect(r.simulated.routes.alternatives.find(a => a.id === id(13))!.cost.total).toBeNull()
    const input = scenarioInput(); input.demand = []; input.replenishments = []
    expect(simulateScenario(s, input, TWIN_ENGINE_VERSION).simulated.supply[0].shortage).toBeNull()
  })
  it('does not invent zero stock when a product has no inventory baseline', () => {
    const s = snapshot(); s.inventory = []
    expect(simulateScenario(s, scenarioInput(), TWIN_ENGINE_VERSION).baseline.supply[0].shortage).toBeNull()
  })
  it('labels adjusted cost assumptions simulated and includes explicit route-dependent replenishment delays', () => {
    const input = scenarioInput([{ kind: 'connection', edgeId: id(13), timeFactor: 10, costFactor: 2 }])
    input.replenishments[0].routeRequest = request({ priorities: { cost: 0, time: 1, risk: 0 } })
    const r = simulateScenario(snapshot(), input, TWIN_ENGINE_VERSION)
    const adjusted = r.simulated.routes.alternatives.find(a => a.id === id(13))!
    expect(adjusted.cost.components[0].provenance.source).toContain('Scenario assumption')
    expect(r.simulated.supply[0].shortage).toBe('20.00')
  })
  it('rejects conflicting, duplicate, unknown, unit-mismatched and unsupported-version scenarios', () => {
    expect(() => scenarioInput([{ kind: 'connection', edgeId: id(13), closed: true, capacityFactor: 0.5 }])).toThrow()
    expect(() => scenarioInput([{ kind: 'supplier_unavailable', supplierId: id(61) }, { kind: 'supplier_unavailable', supplierId: id(61) }])).toThrow()
    for (const mods of [[{ kind: 'connection', edgeId: id(99), closed: true }], [{ kind: 'inventory_reduction', inventoryId: id(50), quantity: '101' }], [{ kind: 'demand_increase', productId: id(51), unit: 'tonne', quantity: '1' }]]) expect(() => simulateScenario(snapshot(), scenarioInput(mods), TWIN_ENGINE_VERSION)).toThrow()
    expect(() => simulateScenario(snapshot(), scenarioInput(), 'old-version')).toThrow('unsupported_engine_version')
  })
})
