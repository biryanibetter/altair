import { describe, expect, it } from 'vitest'
import { forecastInventory } from '../src/supply/forecast'
import { matchSuppliers } from '../src/supply/suppliers'
import { importDependency } from '../src/supply/dependency'
import { scenarioInputSchema, scenarioSnapshotSchema, supplySnapshotSchema } from '@altair/shared/contracts'
import { graph, request as routeRequest, now as routeNow, id as routeId } from './routing-fixtures'

export const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`
export const now = '2026-11-01T00:00:00.000Z'
export function stockFixture() {
  return { evaluatedAt: now, inventory: { id: id(1), productId: id(2), warehouseId: id(3), quantity: '100', reservedQuantity: '20', unit: 'kg', historyStart: '2026-10-04T00:00:00.000Z' },
    movements: Array.from({ length: 28 }, (_, i) => ({ id: id(100 + i), inventoryId: id(1), kind: 'consumption' as const, quantity: '10', unit: 'kg', occurredAt: new Date(Date.parse('2026-10-04T00:00:00Z') + i * 86400000).toISOString() })),
    orders: [{ id: id(4), inventoryId: id(1), quantity: '40', reservedQuantity: '20', unit: 'kg', dueAt: '2026-11-03T00:00:00.000Z', status: 'confirmed' as const }], replenishments: [] }
}
const request = { inventoryId: id(1), leadTimeDays: 5, coverageDays: 10, safetyStock: '20', horizonDays: 30 }
function scenarioContext(f: ReturnType<typeof supplySnapshotSchema.parse>, modifications: unknown[], demand = '0') {
  const baseline = scenarioSnapshotSchema.parse({ version: 1, evaluatedAt: f.evaluatedAt, network: graph(), risks: [], inventory: [{ id: f.inventory.id, productId: f.inventory.productId, warehouseId: f.inventory.warehouseId, quantity: f.inventory.quantity, unit: f.inventory.unit }], shipments: [], supplierIds: [], references: {} })
  return { baseline, scenario: scenarioInputSchema.parse({ name: 'Hypothetical inventory scenario', routeRequest: routeRequest(), hypothetical: true, horizonHours: 24, demand: [{ productId: f.inventory.productId, unit: f.inventory.unit, quantity: demand }], modifications }) }
}
describe('inventory forecasting', () => {
  it('uses complete daily consumption, subtracts reservations once and combines coverage with orders', () => {
    const result = forecastInventory(stockFixture(), request)
    expect(result.availableStock).toBe('80.000000')
    expect(result.consumption.averageDaily).toBe(10)
    expect(result.consumption.historyDays).toBe(28)
    expect(result.coverageDays).toBe(8)
    expect(result.stockoutAt).toBe('2026-11-07T00:00:00.000Z')
    expect(result.safetyStockAt).toBe('2026-11-05T00:00:00.000Z')
    expect(result.reorderPoint).toBe('90.000000')
    expect(result.suggestedQuantity).toBe('110.000000')
    expect(result.consumption.uncertainty).not.toBeNull()
  })
  it('does not turn missing history or unknown lead time into zero demand or immediate delivery', () => {
    const f = stockFixture(); f.movements = []; f.inventory.historyStart = null as unknown as string
    const r = forecastInventory(f, { ...request, leadTimeDays: null })
    expect(r.consumption.averageDaily).toBeNull()
    expect(r.stockoutAt).toBeNull()
    expect(r.suggestedQuantity).toBeNull()
    expect(r.limitations).toContain('demand_history_unavailable')
    expect(r.limitations).toContain('lead_time_unknown')
  })
  it('counts zero-consumption days only in declared history and rejects inconsistent units', () => {
    const f = stockFixture(); f.movements = f.movements.slice(0, 1)
    expect(forecastInventory(f, request).consumption.averageDaily).toBeCloseTo(10 / 28)
    f.movements[0]!.unit = 'litre'
    expect(() => forecastInventory(f, request)).toThrow('unit_mismatch')
  })
  it('labels short history and explicitly supplied demand and compares delivery lead times', () => {
    const f = stockFixture(); f.inventory.historyStart = '2026-10-31T00:00:00.000Z'; f.movements = []
    const r = forecastInventory(f, { ...request, dailyDemand: 10, leadTimeDays: null, leadTimeAlternatives: [2, 12] })
    expect(r.consumption.method).toBe('explicit_daily_demand')
    expect(r.consumption.uncertainty).toBeNull()
    expect(r.leadTimeRisks.map(x => x.shortageBeforeArrival)).toEqual([false, true])
  })
  it('reuses crisis route delays and excludes unavailable or insufficiently verified suppliers', () => {
    const f = supplySnapshotSchema.parse({ ...stockFixture(), evaluatedAt: routeNow, orders: [], replenishments: [{ shipmentId: routeId(60), quantity: '100', unit: 'kg', confirmedQuantity: '100', verifiedUntil: '2026-12-01T00:00:00.000Z', routeRequest: routeRequest({ priorities: { cost: 0, time: 1, risk: 0 } }) }] })
    const baseline = scenarioSnapshotSchema.parse({ version: 1, evaluatedAt: routeNow, network: graph(), risks: [], inventory: [{ id: f.inventory.id, productId: f.inventory.productId, warehouseId: f.inventory.warehouseId, quantity: f.inventory.quantity, unit: f.inventory.unit }], shipments: [{ id: routeId(60), supplierId: routeId(61), productId: f.inventory.productId, estimatedArrival: '2026-11-07T00:00:00.000Z', status: 'planned', originId: routeId(1), destinationId: routeId(4) }], supplierIds: [routeId(61)], references: {} })
    const scenario = scenarioInputSchema.parse({ name: 'Hypothetical route delay', routeRequest: routeRequest(), hypothetical: true, horizonHours: 240, demand: [], replenishments: [{ shipmentId: routeId(60), quantity: '100', unit: 'kg' }], modifications: [{ kind: 'connection', edgeId: routeId(13), timeFactor: 10 }, { kind: 'replenishment_delay', shipmentId: routeId(60), delayHours: 24 }] })
    const before = forecastInventory(f, { ...request, dailyDemand: 10 }, { baseline })
    const after = forecastInventory(f, { ...request, dailyDemand: 10 }, { baseline, scenario })
    expect(after.replenishments[0]!.arrivalAt! > before.replenishments[0]!.arrivalAt!).toBe(true)
    expect(after.replenishments[0]!.reasons).toContain('replenishment_arrival_adjusted_by_explicit_route_duration_delta')
    const unavailable = forecastInventory(f, request, { baseline, scenario: { ...scenario, modifications: [{ kind: 'supplier_unavailable', supplierId: routeId(61) }] } })
    expect(unavailable.replenishments[0]?.status).toBe('unavailable')
    f.replenishments[0]!.confirmedQuantity = '20'
    expect(forecastInventory(f, request, { baseline }).replenishments[0]?.reasons).toContain('insufficient_verified_supplier_quantity')
    f.replenishments[0]!.verifiedUntil = '2020-01-01T00:00:00.000Z'
    expect(forecastInventory(f, request, { baseline }).replenishments[0]?.quantity).toBe('0.000000')
  })
  it('uses known future receipts to avoid recommending unnecessary excess coverage stock', () => {
    const f = supplySnapshotSchema.parse({ ...stockFixture(), orders: [], replenishments: [{ shipmentId: id(60), quantity: '100', unit: 'kg', confirmedQuantity: '100', verifiedUntil: '2026-12-01T00:00:00.000Z', routeRequest: null }] })
    const baseline = scenarioSnapshotSchema.parse({ version: 1, evaluatedAt: now, network: { version: 1, nodes: [], edges: [] }, risks: [], inventory: [{ id: id(1), productId: id(2), warehouseId: id(3), quantity: '100', unit: 'kg' }], shipments: [{ id: id(60), supplierId: null, productId: id(2), estimatedArrival: '2026-11-07T00:00:00.000Z', status: 'in_transit', originId: null, destinationId: null }], supplierIds: [], references: {} })
    expect(forecastInventory(f, request, { baseline }).suggestedQuantity).toBe('0.000000')
  })
  it('counts scenario-impaired reservations as uncovered dated order commitments', () => {
    const f = supplySnapshotSchema.parse(stockFixture()); f.inventory.quantity = '20'; f.orders[0]!.quantity = '20'
    const context = scenarioContext(f, [{ kind: 'inventory_reduction', inventoryId: id(1), quantity: '20' }])
    const r = forecastInventory(f, { ...request, dailyDemand: 0, safetyStock: '0', leadTimeDays: 1 }, context)
    expect(r.suggestedQuantity).toBe('20.000000')
    expect(r.projection.find(p => p.at === f.orders[0]!.dueAt)?.unfilledOrderQuantity).toBe('20.000000')
  })
  it('applies a finite scenario demand increase only within its stated horizon', () => {
    const f = supplySnapshotSchema.parse(stockFixture()); f.inventory.reservedQuantity = '0'; f.orders = []
    const context = scenarioContext(f, [{ kind: 'demand_increase', productId: id(2), unit: 'kg', quantity: '20' }])
    const r = forecastInventory(f, { ...request, dailyDemand: 0, safetyStock: '0', coverageDays: 30 }, context)
    expect(r.consumption.averageDaily).toBe(0)
    expect(r.projection.at(-1)?.available).toBe('80.000000')
    expect(r.suggestedQuantity).toBe('0.000000')
  })
  it('reports a commitments-only minimum deficit even when recurring demand is unknown', () => {
    const f = supplySnapshotSchema.parse(stockFixture()); f.movements = []; f.inventory.historyStart = null; f.inventory.quantity = '10'; f.inventory.reservedQuantity = '0'; f.orders[0]!.quantity = '100'; f.orders[0]!.reservedQuantity = '0'
    const r = forecastInventory(f, { ...request, safetyStock: '0' })
    expect(r.consumption.averageDaily).toBeNull()
    expect(r.projection.find(p => p.at === f.orders[0]!.dueAt)?.unfilledOrderQuantity).toBe('90.000000')
    expect(r.suggestedQuantity).toBe('90.000000')
    expect(r.limitations).toContain('commitments_only_lower_bound_recurring_demand_unknown')
  })
})

describe('supplier matching', () => {
  const supplier = { id: id(20), name: 'Evidence supplier', countryCode: 'QA', locationId: id(21), verificationStatus: 'verified' as const, verifiedAt: '2026-10-01T00:00:00.000Z', expiresAt: '2026-12-01T00:00:00.000Z', products: [{ productId: id(2), hsCode: '100630', classification: 'HS2022', evidenceId: id(22) }], capabilities: [{ name: 'cold-storage', evidenceId: id(22) }], evidence: [{ id: id(22), sourceUrl: 'https://example.com/catalog', description: 'Product catalog', observedAt: '2026-10-01T00:00:00.000Z', expiresAt: '2026-12-01T00:00:00.000Z', status: 'confirmed' as const }] }
  it('matches known products, HS edition, geography and capabilities without assuming availability', () => {
    const r = matchSuppliers([supplier], { productId: id(2), hsCode: '1006', classification: 'HS2022', countryCodes: ['QA'], capabilities: ['cold-storage'] }, now)
    expect(r.data[0]?.matchStatus).toBe('confirmed_catalog_match')
    expect(r.data[0]?.availability).toBe('unverified')
    expect(matchSuppliers([supplier], { countryCodes: ['US'] }, now).data).toHaveLength(0)
  })
  it('downgrades stale or inferred evidence and never mixes HS editions', () => {
    expect(matchSuppliers([supplier], { productId: id(2) }, '2027-01-01T00:00:00.000Z').data[0]?.matchStatus).toBe('potential_match')
    expect(matchSuppliers([supplier], { hsCode: '1006', classification: 'HS2017' }, now).data).toHaveLength(0)
    expect(matchSuppliers([{ ...supplier, evidence: supplier.evidence.map(e => ({ ...e, status: 'inferred' as const })) }], { productId: id(2) }, now).data[0]?.matchStatus).toBe('potential_match')
  })
})

describe('import dependency', () => {
  const trade = (partner: string | null, value: string, period = '2024') => ({ kind: 'trade' as const, period, reporter: 'Qatar', partner, hsCode: '1006', classification: 'HS2022', description: null, flow: 'import' as const, value, currency: 'QAR' as const, weightKg: null })
  it('calculates HHI and trends only on comparable non-overlapping origin records', () => {
    const r = importDependency([trade('India', '60'), trade('Pakistan', '40'), trade(null, '100'), trade('India', '50', '2023'), trade('Pakistan', '50', '2023')], { reporter: 'Qatar', hsCode: '1006', classification: 'HS2022', currency: 'QAR' }, ['India'])
    expect(r.periods.find(p => p.period === '2024')?.hhi).toBeCloseTo(0.52)
    expect(r.periods.find(p => p.period === '2024')?.exposedShare).toBe(0.6)
    expect(r.periods.find(p => p.period === '2024')?.totalValue).toBe('100.000000')
    expect(r.periods.at(-1)?.changePercent).toBe(0)
    expect(r.limitations).toContain('observed_origins_not_comprehensive_imports')
  })
  it('returns unavailable concentration for absent origins instead of zero dependency', () => {
    expect(importDependency([trade(null, '100')], { reporter: 'Qatar', hsCode: '1006', classification: 'HS2022', currency: 'QAR' }).periods[0]?.hhi).toBeNull()
  })
  it('preserves arbitrary ingested decimal precision when aggregating trade values', () => {
    const r = importDependency([trade('India', '9007199254740993.1234567'), trade('Pakistan', '0.0000001')], { reporter: 'Qatar', hsCode: '1006', classification: 'HS2022', currency: 'QAR' })
    expect(r.periods[0]?.totalValue).toBe('9007199254740993.1234568')
  })
})
