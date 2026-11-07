import { expect, it } from 'vitest'
import { monitoringConfigSchema, observationSchema, scenarioSnapshotSchema, supplySnapshotSchema, forecastRequestSchema, riskSignalIntelligenceSchema } from '@altair/shared/contracts'
import { evaluateMonitoring, type MonitoringContext } from '../src/monitoring/evaluate'
import { graph, id, now, request } from './routing-fixtures'

function context(): MonitoringContext {
  const network = graph()
  for (const edge of network.edges) if (edge.metadata) { edge.metadata.hypothetical = false; edge.metadata.provenance.nature = 'estimated'; for (const cost of edge.metadata.costs) cost.provenance = { ...cost.provenance, nature: 'estimated' } }
  return { evaluatedAt: now, network, signals: [], observations: [], shipments: [{ id: id(90), status: 'in_transit', updatedAt: '2026-11-01T00:00:00.000Z', routeRequest: request() }], inventories: [] }
}
const config = () => monitoringConfigSchema.parse({ shipments: [{ shipmentId: id(90), edgeIds: [id(13)], baselineCost: { amount: '0.01', currency: 'USD' }, baselineDurationHours: 1 }] })
it('evaluates stale shipment updates, increased comparable estimates and route delay with actions', () => {
  const result = evaluateMonitoring(context(), config())
  expect(result.candidates.map(c => c.rule)).toEqual(expect.arrayContaining(['stale_shipment', 'increased_cost', 'route_delay']))
  expect(result.candidates.every(c => c.action.length > 0)).toBe(true)
  expect(new Set(result.candidates.map(c => c.dedupKey)).size).toBe(result.candidates.length)
})
it('does not infer cargo location or route disruption from vessel/aircraft positions or stale road data', () => {
  const c = context()
  const base = { job: 'here-incidents', provider: 'here', recordKey: 'road1', sourceId: id(6), sourceUrl: 'https://traffic.hereapi.com/v7/incidents', license: 'fixture', nature: 'live', observedAt: '2026-11-06T10:00:00.000Z', fetchedAt: now, expiresAt: '2026-11-07T00:00:00.000Z', sourceUpdatedAt: null }
  c.observations = [observationSchema.parse({ ...base, data: { kind: 'traffic', providerId: 'road1', latitude: 25, longitude: 51, status: 'closed', speedMps: null, jamFactor: null, validUntil: null, freshUntil: '2026-11-06T10:05:00.000Z', evidenceOnly: true } })]
  const cfg = config(); cfg.trafficMappings = [{ providerId: 'road1', edgeIds: [id(13)] }]
  const stale = evaluateMonitoring(c, cfg)
  expect(stale.candidates.some(a => a.rule === 'disrupted_route')).toBe(false)
  expect(stale.evaluatedKeys).not.toContain(`disrupted_route:shipment:${id(90)}`)
  c.observations[0]!.data = { kind: 'vessel', providerId: '123456789', latitude: 25, longitude: 51, freshUntil: '2026-11-07T00:00:00.000Z', evidenceOnly: true }
  expect(evaluateMonitoring(c, cfg).candidates.some(a => a.rule === 'disrupted_route')).toBe(false)
})
it('uses only explicit fresh road mappings, deduplicates events and clears only with sufficient fresh evidence', () => {
  const c = context(), cfg = config()
  cfg.trafficMappings = [{ providerId: 'road1', edgeIds: [id(13)] }]
  const o = observationSchema.parse({ job: 'here-incidents', provider: 'here', recordKey: 'road1', sourceId: id(6), sourceUrl: 'https://traffic.hereapi.com/v7/incidents', license: 'fixture', nature: 'live', observedAt: now, fetchedAt: now, expiresAt: '2026-11-07T00:00:00.000Z', sourceUpdatedAt: null, data: { kind: 'traffic', providerId: 'road1', latitude: 25, longitude: 51, status: 'closed', speedMps: null, jamFactor: null, validUntil: null, freshUntil: '2026-11-07T00:00:00.000Z', evidenceOnly: true } })
  c.observations = [o, o]
  const result = evaluateMonitoring(c, cfg)
  expect(result.candidates.filter(a => a.rule === 'disrupted_route')).toHaveLength(1)
  expect(evaluateMonitoring({ ...c, observations: [] }, cfg).candidates.some(a => a.rule === 'disrupted_route')).toBe(false)
  cfg.trafficMappings.push({ providerId: 'other-required-segment', edgeIds: [id(13)] })
  o.data = { ...o.data, status: 'open' } as typeof o.data
  expect(evaluateMonitoring(c, cfg).evaluatedKeys).not.toContain(`disrupted_route:shipment:${id(90)}`)
})
it('reuses risk intelligence and supply forecasting, leaving absent consumption unknown', () => {
  const c = context(), cfg = config()
  const baseline = scenarioSnapshotSchema.parse({ version: 1, evaluatedAt: now, network: c.network, risks: [], inventory: [], shipments: [], supplierIds: [], references: {} })
  const supply = supplySnapshotSchema.parse({ evaluatedAt: now, inventory: { id: id(70), productId: id(71), warehouseId: id(72), quantity: '10', reservedQuantity: '0', unit: 'kg', historyStart: null }, movements: [], orders: [], replenishments: [] })
  c.inventories = [{ supply, baseline }]
  cfg.inventories = [forecastRequestSchema.parse({ inventoryId: id(70), dailyDemand: 10, horizonDays: 7, leadTimeDays: 2 })]
  expect(evaluateMonitoring(c, cfg).candidates.find(a => a.rule === 'potential_stockout')).toMatchObject({ targetId: id(70), severity: 'high' })
  delete cfg.inventories[0]!.dailyDemand
  expect(evaluateMonitoring(c, cfg).candidates.some(a => a.rule === 'potential_stockout')).toBe(false)
  expect(evaluateMonitoring(c, cfg).evaluatedKeys).not.toContain(`potential_stockout:inventory:${id(70)}`)
})
it('honors disabled rules and refuses ownership references absent from the authorized snapshot', () => {
  const cfg = config(); cfg.rules.stale_shipment.enabled = false
  expect(evaluateMonitoring(context(), cfg).candidates.some(a => a.rule === 'stale_shipment')).toBe(false)
  cfg.shipments[0]!.shipmentId = id(999)
  expect(() => evaluateMonitoring(context(), cfg)).toThrow('monitoring_target_unavailable')
})
it('alerts for active targeted severe environmental intelligence, but not expired forecasts', () => {
  const c = context()
  c.signals = [riskSignalIntelligenceSchema.parse({ id: id(101), category: 'weather', severity: 'high', observedAt: now, validUntil: '2026-11-06T13:00:00.000Z', target: { kind: 'node', id: id(1) }, evidence: 'Fixture severe wind', provenance: { source: 'fixture forecast', sourceUrl: 'https://example.org', observedAt: now, expiresAt: '2026-11-06T13:00:00.000Z', confidence: 0.6, nature: 'estimated' }, status: 'potential', rule: 'weather-thresholds-v1', nature: 'estimated' })]
  expect(evaluateMonitoring(c, config()).candidates.some(a => a.rule === 'severe_environment')).toBe(true)
  c.evaluatedAt = '2026-11-06T14:00:00.000Z'
  const expired = evaluateMonitoring(c, config())
  expect(expired.candidates.some(a => a.rule === 'severe_environment')).toBe(false)
  expect(expired.evaluatedKeys).not.toContain(`severe_environment:shipment:${id(90)}`)
})
it.each(['stale', 'future'] as const)('does not trigger or clear cost/delay alerts using %s route evidence', state => {
  const c = context(), cfg = config()
  for (const e of c.network.edges) if (e.metadata) {
    e.metadata.provenance = { ...e.metadata.provenance, observedAt: state === 'future' ? '2026-11-06T13:00:00.000Z' : '2026-11-06T10:00:00.000Z', expiresAt: state === 'stale' ? '2026-11-06T11:00:00.000Z' : '2026-11-07T00:00:00.000Z' }
    for (const cost of e.metadata.costs) cost.provenance = e.metadata.provenance
  }
  const evaluation = evaluateMonitoring(c, cfg)
  for (const rule of ['increased_cost', 'route_delay']) {
    expect(evaluation.candidates.some(a => a.rule === rule)).toBe(false)
    expect(evaluation.evaluatedKeys).not.toContain(`${rule}:shipment:${id(90)}`)
  }
})
it('does not announce a curated closure before its observation time or after expiry', () => {
  const c = context(), e = c.network.edges.find(e => e.id === id(13))!
  e.metadata!.state = 'closed'
  e.metadata!.provenance.observedAt = '2026-11-06T13:00:00.000Z'
  expect(evaluateMonitoring(c, config()).candidates.some(a => a.rule === 'disrupted_route')).toBe(false)
  e.metadata!.provenance.observedAt = '2026-11-06T10:00:00.000Z'
  e.metadata!.provenance.expiresAt = '2026-11-06T11:00:00.000Z'
  expect(evaluateMonitoring(c, config()).candidates.some(a => a.rule === 'disrupted_route')).toBe(false)
})
