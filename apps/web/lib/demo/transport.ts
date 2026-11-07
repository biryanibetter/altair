// Stateless demo adapter. Only fictional, browser-owned state enters this module.
// It never creates a Supabase client or reads production records.
import { z } from 'zod'
import * as c from '@altair/shared/contracts'
import { compareRoutes, simulateScenario, TWIN_ENGINE_VERSION, forecastInventory, matchSuppliers, importDependency } from '@altair/backend'
import { demoLocations, demoProducts, demoWarehouses, demoShipments, demoInventory, demoAlerts, demoSuppliers, demoConnections, demoObservations } from './data'

const pick = <T extends z.ZodObject>(schema: T, value: unknown) => schema.strip().parse(value)
export const stateSchema = z.object({
  shipments: z.array(c.shipmentRecordSchema).max(100), inventory: z.array(c.inventoryRecordSchema).max(100),
  alerts: z.array(c.alertRecordSchema).max(100), scenarios: z.array(c.scenarioRecordSchema).max(20),
  events: z.array(c.shippingEventSchema.extend({ idempotencyKey: z.string().optional() })).max(500),
  config: c.monitoringConfigSchema,
})
export type DemoWorkspaceState = z.infer<typeof stateSchema>
export function initialState(): DemoWorkspaceState {
  return stateSchema.parse({
    shipments: demoShipments.map(s => pick(c.shipmentRecordSchema, s)),
    inventory: demoInventory.map(s => pick(c.inventoryRecordSchema, s)),
    alerts: demoAlerts.map(a => ({ ...a, shipmentId: a.shipmentId ?? null, title: `Demo · ${a.title}`, targetKind: a.targetKind === 'inventory' ? 'inventory' : 'shipment', dedupKey: a.id, occurrence: 1, action: 'Review fictional demonstration evidence', acknowledgedAt: null, resolvedAt: null })),
    scenarios: [], events: [], config: c.monitoringConfigSchema.parse({}),
  })
}
const locations = demoLocations.map(l => pick(c.locationSelectionSchema, l))
const products = demoProducts.map(p => pick(c.productSelectionSchema, p))
const warehouses = demoWarehouses.map(w => pick(c.warehouseSelectionSchema, w))
const fixedTime = '2026-11-07T09:00:00.000Z'
const provenance = { source: 'Fictional ALTAIR demo fixture — not a carrier quotation', sourceUrl: null, observedAt: fixedTime, expiresAt: null, confidence: 0.8, nature: 'simulated' as const }
export const demoNetwork = c.networkSchema.parse({ version: 1, nodes: locations, edges: demoConnections.map((e, i) => ({
  id: `10000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, originId: e.originId, destinationId: e.destinationId, mode: e.mode,
  metadata: { version: 1, hypothetical: false, provenance, distanceKm: e.distanceKm, durationHours: { min: e.typicalDurationHours, max: e.typicalDurationHours * 1.2 }, geometry: null,
    costs: [{ name: 'Demo transport estimate', amount: String(e.costUsd), currency: 'USD', basis: 'shipment', provenance }], costCoverage: 'complete', state: 'open', capacityKg: 100000, capacityM3: 1000, handling: [], prohibitedCommodities: [], risk: 0.2 },
})) })
function snapshot(state: DemoWorkspaceState) {
  return c.scenarioSnapshotSchema.parse({ version: 1, evaluatedAt: fixedTime, network: demoNetwork, risks: [],
    inventory: state.inventory.map(({ id, productId, warehouseId, quantity, unit }) => ({ id, productId, warehouseId, quantity, unit })),
    shipments: state.shipments.map(({ id, supplierId, productId, estimatedArrival, status, originId, destinationId }) => ({ id, supplierId, productId, estimatedArrival, status, originId, destinationId })),
    supplierIds: demoSuppliers.map(s => s.id), references: { demo: true },
  })
}
function observations() {
  return demoObservations.map(o => c.observationSchema.parse({ ...o, job: o.data.kind === 'vessel' ? 'aisstream' : 'opensky', provider: o.data.kind === 'vessel' ? 'aisstream' : 'opensky', nature: 'simulated', recordKey: o.id, sourceId: o.id, sourceUrl: 'https://example.com/altair-demo', license: 'Fictional demonstration fixture', fetchedAt: o.observedAt, expiresAt: o.data.freshUntil, sourceUpdatedAt: null,
    data: { ...o.data, latitude: o.data.longitude, longitude: o.data.latitude, evidenceOnly: true, providerId: `DEMO-${o.data.providerId}` } }))
}
function supplierCatalog() {
  return demoSuppliers.map(s => ({ id: s.id, name: `Demo · ${s.name}`, countryCode: locations.find(l => l.id === s.locationId)?.countryCode ?? null, locationId: s.locationId, verificationStatus: 'unverified', verifiedAt: null, expiresAt: null, products: products.map(p => ({ productId: p.id, hsCode: p.hsCode, classification: 'HS2022', evidenceId: s.id })), capabilities: [], evidence: [{ id: s.id, sourceUrl: 'https://example.com/altair-demo', description: 'Fictional supplier catalog; no verified availability', observedAt: fixedTime, expiresAt: '2027-01-01T00:00:00.000Z', status: 'inferred' }] }))
}

export async function demoRequest(path: string, body: unknown, rawState: unknown, method = body === undefined ? 'GET' : 'POST') {
  const state = stateSchema.parse(rawState), url = new URL(path, 'https://demo.invalid'), route = url.pathname
  const now = new Date().toISOString()
  const page = (rows: unknown[]) => ({ data: rows, nextCursor: null })
  let data: unknown
  if (route === '/locations') data = page(locations)
  else if (route === '/products') data = page(products)
  else if (route === '/warehouses') data = page(warehouses)
  else if (route === '/shipments' && method === 'GET') data = page(state.shipments)
  else if (route === '/shipments') {
    const input = c.shipmentWriteSchema.parse(body)
    data = c.shipmentRecordSchema.parse({ ...input, id: crypto.randomUUID(), inventoryId: null, confirmedQuantity: null, verifiedUntil: null, trackingNumber: `DEMO-${state.shipments.length + 1}`, status: 'planned', estimatedArrival: null, updatedAt: now })
    state.shipments.push(data as z.infer<typeof c.shipmentRecordSchema>)
  } else if (/^\/shipments\/[^/]+\/events$/.test(route)) {
    const shipment = state.shipments.find(s => s.id === route.split('/')[2])
    if (!shipment) throw Error('Demo shipment not found')
    if (method === 'GET') data = page(state.events.filter(e => e.shipment_id === shipment.id))
    else {
      const input = c.shippingEventInputSchema.parse(body)
      const duplicate = state.events.find(e => e.shipment_id === shipment.id && e.idempotencyKey === input.idempotencyKey)
      if (duplicate) data = duplicate
      else {
        if (input.kind === 'partner_response' && !state.events.some(e => e.id === input.requestId && e.shipment_id === shipment.id && ['quotation_request', 'reroute_request'].includes(e.kind))) throw Error('Demo request not found')
        const event = { id: crypto.randomUUID(), shipment_id: shipment.id, kind: input.kind, title: input.title, note: input.note, source: input.source, occurred_at: input.kind === 'milestone' ? input.occurredAt : now, created_at: now, payload: 'payload' in input ? input.payload ?? {} : {}, request_id: input.kind === 'partner_response' ? input.requestId : null, decision: input.kind === 'partner_response' ? input.decision : null, idempotencyKey: input.idempotencyKey }
        state.events.push(event); data = event
        if (input.kind === 'milestone') { shipment.status = input.status; shipment.updatedAt = now; shipment.estimatedArrival = input.estimatedArrival ?? shipment.estimatedArrival; shipment.trackingNumber = input.trackingNumber ?? shipment.trackingNumber }
      }
    }
  } else if (/^\/shipments\/[^/]+$/.test(route)) data = state.shipments.find(s => s.id === route.split('/')[2])
  else if (route === '/inventory' && method === 'GET') data = { version: 'supply-1.0.0', ...page(state.inventory) }
  else if (route === '/inventory') { const input = c.inventoryWriteSchema.parse(body); data = { ...input, id: crypto.randomUUID() }; state.inventory.push(data as z.infer<typeof c.inventoryRecordSchema>) }
  else if (route === '/alerts') data = page(state.alerts)
  else if (/^\/alerts\/[^/]+$/.test(route)) {
    const alert = state.alerts.find(a => a.id === route.split('/')[2]); if (!alert) throw Error('Demo alert not found')
    const input = c.alertTransitionSchema.parse(body); alert.state = input.state; alert.updatedAt = now; if (input.state === 'acknowledged') alert.acknowledgedAt = now; else alert.resolvedAt = now; data = alert
  } else if (route === '/observations') data = { data: observations(), meta: { availability: 'available', nextCursor: null } }
  else if (['/weather', '/trade'].includes(route)) data = { data: [], meta: { availability: 'unavailable', nextCursor: null } }
  else if (route === '/risks') data = { data: [], meta: { nextCursor: null, availability: 'unavailable', evaluatedAt: now, coverage: { unmappedObservations: 0, legacySignals: 0, rules: [] } } }
  else if (route === '/routes/compare') data = compareRoutes(demoNetwork, c.routeRequestSchema.parse(body), fixedTime)
  else if (route === '/scenarios' && method === 'GET') data = page(state.scenarios.map(s => ({ id: s.id, name: s.name, createdAt: s.createdAt, engineVersion: s.engineVersion, executed: s.output !== null })))
  else if (route === '/scenarios') {
    const input = c.scenarioInputSchema.parse(body)
    const record = c.scenarioRecordSchema.parse({ id: crypto.randomUUID(), name: input.name, createdAt: now, engineVersion: TWIN_ENGINE_VERSION, baselineReference: 'fictional-demo-snapshot', input, snapshot: snapshot(state), output: null })
    simulateScenario(record.snapshot, input, TWIN_ENGINE_VERSION) // Validate targets before saving.
    state.scenarios.push(record); data = record
  } else if (/^\/scenarios\/[^/]+(?:\/execute)?$/.test(route)) {
    const record = state.scenarios.find(s => s.id === route.split('/')[2]); if (!record) throw Error('Demo scenario not found')
    if (route.endsWith('/execute')) { record.output ??= simulateScenario(record.snapshot, record.input, record.engineVersion); data = record.output } else data = record
  } else if (route === '/forecasts') {
    const input = c.forecastRequestSchema.parse(body), inventory = state.inventory.find(i => i.id === input.inventoryId)
    if (!inventory) throw Error('Demo inventory not found')
    data = forecastInventory({ evaluatedAt: now, inventory, movements: [], orders: [], replenishments: [] }, input)
  } else if (route === '/suppliers/search') data = matchSuppliers(supplierCatalog(), c.supplierSearchSchema.parse(body), now)
  else if (route === '/monitoring/config') { if (method === 'PUT') state.config = c.monitoringConfigSchema.parse(body); data = { config: state.config } }
  else if (route === '/monitoring/evaluate') data = { version: 'monitoring-1.0.0', evaluatedAt: now, candidates: [], evaluatedKeys: [], limitations: ['Demo mode: fictional alerts only; no live provider evaluation.'] }
  else if (route === '/ingestion/status' || route === '/freshness') data = { data: [] }
  else if (route === '/import-dependencies') data = importDependency([], c.importDependencyRequestSchema.parse(body))
  else throw Error('This action requires a connected workspace; no production change was made.')
  return { data, state }
}
