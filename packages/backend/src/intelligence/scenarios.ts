import { createHash } from 'node:crypto'
import { scenarioInputSchema, scenarioSnapshotSchema, type ScenarioInput, type ScenarioSnapshot, type SimulationOutput, type RouteComparison } from '@altair/shared/contracts'
import { compareRoutes, ENGINE_VERSION } from '../routing/engine'
import { decimal, multiply, units } from '../routing/money'
import { evaluateReplenishment } from './replenishment'

export const TWIN_ENGINE_VERSION = 'altair-twin-1.0.0'
export class ScenarioError extends Error {}
// Canonical sorted-key representation: insensitive to JSON/Postgres object key ordering.
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
  return JSON.stringify(value)
}
export const hashValue = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex')

function validateTargets(s: ScenarioSnapshot, input: ScenarioInput) {
  for (const m of input.modifications) {
    if (m.kind === 'connection' && !s.network.edges.some(e => e.id === m.edgeId)) throw new ScenarioError('unknown_connection')
    if (m.kind === 'supplier_unavailable' && !s.supplierIds.includes(m.supplierId)) throw new ScenarioError('unknown_supplier')
    if (m.kind === 'inventory_reduction') { const row = s.inventory.find(i => i.id === m.inventoryId); if (!row || units(m.quantity) > units(row.quantity)) throw new ScenarioError('invalid_inventory_reduction') }
    if (m.kind === 'demand_increase' && !input.demand.some(d => d.productId === m.productId && d.unit === m.unit)) throw new ScenarioError('demand_baseline_or_unit_missing')
    if (m.kind === 'replenishment_delay' && !input.replenishments.some(r => r.shipmentId === m.shipmentId)) throw new ScenarioError('replenishment_baseline_missing')
  }
  for (const r of input.replenishments) {
    const shipment = s.shipments.find(sh => sh.id === r.shipmentId)
    if (!shipment || !shipment.productId) throw new ScenarioError('unknown_shipment_or_product')
    if (s.inventory.some(i => i.productId === shipment.productId && i.unit !== r.unit) || input.demand.some(d => d.productId === shipment.productId && d.unit !== r.unit)) throw new ScenarioError('replenishment_unit_mismatch')
    if (r.routeRequest && (r.routeRequest.originId !== shipment.originId || r.routeRequest.destinationId !== shipment.destinationId)) throw new ScenarioError('shipment_route_mismatch')
  }
  for (const d of input.demand) if (s.inventory.some(i => i.productId === d.productId && i.unit !== d.unit)) throw new ScenarioError('demand_unit_mismatch')
  if (s.network.edges.some(e => e.metadata?.hypothetical) && !input.hypothetical) throw new ScenarioError('hypothetical_snapshot_requires_label')
}

export function applyScenarioChanges(snapshot: ScenarioSnapshot, input: ScenarioInput) {
  const changed = structuredClone(snapshot), modifiedInput = structuredClone(input)
  const unavailable = new Set<string>(); const delays = new Map<string, number>(); const changes: SimulationOutput['changes'] = []
  for (const m of [...input.modifications].sort((a, b) => canonical(a) < canonical(b) ? -1 : 1)) {
    if (m.kind === 'connection') {
      const edge = changed.network.edges.find(e => e.id === m.edgeId)!
      if (!edge.metadata) {
        if (m.closed) { // Missing metadata cannot fabricate evidence; remove a closed edge from this isolated graph.
          changed.network.edges = changed.network.edges.filter(e => e.id !== m.edgeId)
        }
        changes.push({ target: m.edgeId, reason: m.closed ? 'scenario_connection_closed' : 'unknown_connection_inputs_remain_unavailable' }); continue
      }
      const data = edge.metadata
      const assumedProvenance = { ...data.provenance, source: `Scenario assumption based on: ${data.provenance.source}`.slice(0, 1000), nature: 'simulated' as const }
      data.provenance = assumedProvenance
      if (m.closed) data.state = 'closed'
      if (m.capacityFactor !== undefined) { if (data.capacityKg !== null) data.capacityKg *= m.capacityFactor; if (data.capacityM3 !== null) data.capacityM3 *= m.capacityFactor }
      if (m.costFactor !== undefined) for (const c of data.costs) if (c.amount !== null) { c.amount = multiply(c.amount, m.costFactor); c.provenance = { ...c.provenance, source: `Scenario assumption based on: ${c.provenance.source}`.slice(0, 1000), nature: 'simulated' } }
      if (m.timeFactor !== undefined && data.durationHours) { data.durationHours.min *= m.timeFactor; data.durationHours.max *= m.timeFactor }
      changes.push({ target: m.edgeId, reason: m.closed ? 'scenario_connection_closed' : `scenario_connection_adjusted:${canonical(m)}` })
    } else if (m.kind === 'supplier_unavailable') { unavailable.add(m.supplierId); changes.push({ target: m.supplierId, reason: 'scenario_supplier_unavailable' }) }
    else if (m.kind === 'inventory_reduction') { const row = changed.inventory.find(i => i.id === m.inventoryId)!; row.quantity = decimal(units(row.quantity) - units(m.quantity)); changes.push({ target: m.inventoryId, reason: `scenario_inventory_reduced_by:${m.quantity}:${row.unit}` }) }
    else if (m.kind === 'demand_increase') { const d = modifiedInput.demand.find(d => d.productId === m.productId && d.unit === m.unit)!; d.quantity = decimal(units(d.quantity) + units(m.quantity)); changes.push({ target: m.productId, reason: `scenario_demand_increased_by:${m.quantity}:${m.unit}` }) }
    else { delays.set(m.shipmentId, m.delayHours); changes.push({ target: m.shipmentId, reason: `scenario_replenishment_delayed_hours:${m.delayHours}` }) }
  }
  return { snapshot: changed, input: modifiedInput, unavailable, delays, changes }
}

function supplyImpacts(snapshot: ScenarioSnapshot, baseline: ScenarioSnapshot, input: ScenarioInput, unavailable: Set<string>, delays: Map<string, number>): SimulationOutput['baseline']['supply'] {
  const groups = new Map<string, { productId: string; unit: string; stock: bigint; stockKnown: boolean; demand: bigint | null; replenishment: bigint; reasons: Set<string>; complete: boolean }>()
  const group = (productId: string, unit: string) => {
    const key = `${productId}:${unit}`
    if (!groups.has(key)) groups.set(key, { productId, unit, stock: BigInt(0), stockKnown: false, demand: null, replenishment: BigInt(0), reasons: new Set(), complete: true })
    return groups.get(key)!
  }
  for (const i of snapshot.inventory) { const g = group(i.productId, i.unit); g.stock += units(i.quantity); g.stockKnown = true }
  for (const d of input.demand) group(d.productId, d.unit).demand = units(d.quantity)
  for (const r of input.replenishments) {
    const shipment = snapshot.shipments.find(sh => sh.id === r.shipmentId)!, g = group(shipment.productId!, r.unit)
    const evaluation = evaluateReplenishment(snapshot, baseline, r, unavailable, delays)
    for (const reason of evaluation.reasons) g.reasons.add(reason)
    if (evaluation.status !== 'eligible') { if (evaluation.status === 'unknown') g.complete = false; continue }
    const arrival = Date.parse(evaluation.arrivalAt!)
    const start = Date.parse(snapshot.evaluatedAt), end = start + input.horizonHours * 3600000
    if (arrival < start) { g.complete = false; g.reasons.add('overdue_replenishment_not_assumed_available'); continue }
    if (arrival > end) { g.reasons.add('replenishment_outside_horizon'); continue }
    g.replenishment += units(r.quantity)
  }
  return [...groups.values()].sort((a, b) => `${a.productId}:${a.unit}` < `${b.productId}:${b.unit}` ? -1 : 1).map(g => {
    if (!g.stockKnown) { g.complete = false; g.reasons.add('inventory_baseline_unavailable') }
    const supplyKnown = g.complete
    if (g.demand === null) { g.complete = false; g.reasons.add('demand_baseline_unavailable') }
    const available = g.stock + g.replenishment
    return { productId: g.productId, unit: g.unit, available: supplyKnown ? decimal(available) : null, demand: g.demand === null ? null : decimal(g.demand), shortage: g.complete && g.demand !== null ? decimal(g.demand > available ? g.demand - available : BigInt(0)) : null, complete: g.complete, reasons: [...g.reasons].sort() }
  })
}
const signedMoney = (value: bigint) => value < BigInt(0) ? `-${decimal(-value)}` : decimal(value)
function routeChanges(baseline: RouteComparison, simulated: RouteComparison): SimulationOutput['routeChanges'] {
  const before = baseline.alternatives[0], after = simulated.alternatives[0]
  const comparable = before?.cost.total && after?.cost.total && before.cost.total.currency === after.cost.total.currency
  return { lostRouteIds: baseline.alternatives.filter(a => !simulated.alternatives.some(b => b.id === a.id)).map(a => a.id), gainedRouteIds: simulated.alternatives.filter(a => !baseline.alternatives.some(b => b.id === a.id)).map(a => a.id), conditionalRouteIds: simulated.alternatives.filter(a => a.feasibility === 'conditional').map(a => a.id), preferredCostDelta: comparable ? { amount: signedMoney(units(after.cost.total!.amount) - units(before.cost.total!.amount)), currency: before.cost.total!.currency } : null, preferredDurationDeltaHours: before?.durationHours && after?.durationHours ? after.durationHours.max - before.durationHours.max : null, reasons: ['Changes refer to returned ranked alternatives; bounded search and result limits can affect membership.', ...(simulated.reasons), ...simulated.rejected.flatMap(r => r.reasons)] }
}

export function simulateScenario(rawSnapshot: ScenarioSnapshot, rawInput: ScenarioInput, version: string): SimulationOutput {
  if (version !== TWIN_ENGINE_VERSION) throw new ScenarioError('unsupported_engine_version')
  const snapshot = scenarioSnapshotSchema.parse(rawSnapshot), input = scenarioInputSchema.parse(rawInput)
  validateTargets(snapshot, input)
  const changed = applyScenarioChanges(snapshot, input)
  const baseline = { routes: compareRoutes(snapshot.network, input.routeRequest, snapshot.evaluatedAt, snapshot.risks), supply: supplyImpacts(snapshot, snapshot, input, new Set(), new Map()) }
  const simulated = { routes: compareRoutes(changed.snapshot.network, input.routeRequest, snapshot.evaluatedAt, snapshot.risks), supply: supplyImpacts(changed.snapshot, snapshot, changed.input, changed.unavailable, changed.delays) }
  return { engineVersion: version, routingEngineVersion: ENGINE_VERSION, snapshotHash: hashValue(snapshot), inputHash: hashValue(input), evaluatedAt: snapshot.evaluatedAt, nature: 'simulated', baseline, simulated, routeChanges: routeChanges(baseline.routes, simulated.routes), changes: changed.changes, assumptions: [...input.assumptions, 'Scenario conditions are hypothetical; operational records are never modified.', 'Supply balances are product/unit-specific over a fixed horizon; no unit conversion or demand forecasting.', 'Only explicitly supplied quantities and shipment route dependencies affect replenishment; unrelated route disruptions are not inferred.', 'Unknown metrics stay unavailable; no replacement supplier, customs fee or service schedule is assumed.'] }
}
