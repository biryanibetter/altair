import { monitoringConfigSchema, monitoringEvaluationSchema, observationSchema, type AlertCandidate, type MonitoringConfig, type MonitoringEvaluation, type Network, type Observation, type RiskSignal, type RouteRequest, type ScenarioSnapshot, type SupplySnapshot } from '@altair/shared/contracts'
import { compareRoutes } from '../routing/engine'
import { signalActive } from '../intelligence/risks'
import { forecastInventory } from '../supply/forecast'
import { units as parseMoney } from '../routing/money'

export interface MonitoringContext {
  evaluatedAt: string; network: Network; signals: RiskSignal[]; observations: Observation[]
  shipments: { id: string; status: string; updatedAt: string; routeRequest: RouteRequest | null }[]
  inventories: { supply: SupplySnapshot; baseline: ScenarioSnapshot }[]
}
export function evaluateMonitoring(c: MonitoringContext, input: MonitoringConfig): MonitoringEvaluation {
  const config = monitoringConfigSchema.parse(input), time = Date.parse(c.evaluatedAt)
  if (!Number.isFinite(time) || c.shipments.length > 100 || c.observations.length > 5000) throw Error('monitoring_snapshot_invalid_or_too_large')
  const candidates = new Map<string, AlertCandidate>(), evaluated = new Set<string>()
  const limitations = ['network_observations_are_not_cargo_location', 'explicit_route_mappings_only', 'estimates_not_delivery_or_stockout_guarantees', 'missing_evidence_does_not_automatically_clear_alerts', 'notifications_are_durable_in_app_alerts_not_external_delivery']
  const current = (p: { observedAt: string; expiresAt: string | null; nature: string }) => Date.parse(p.observedAt) <= time && p.expiresAt !== null && Date.parse(p.expiresAt) > time && !['simulated', 'historical'].includes(p.nature)
  const add = (rule: AlertCandidate['rule'], targetKind: AlertCandidate['targetKind'], targetId: string, active: boolean, title: string, action: string, evidence: string[] = []) => {
    if (!config.rules[rule].enabled) return
    const dedupKey = `${rule}:${targetKind}:${targetId}`
    evaluated.add(dedupKey)
    if (active) candidates.set(dedupKey, { dedupKey, rule, targetKind, targetId, severity: config.rules[rule].severity, title, action, evidence: [...new Set(evidence)].sort().slice(0, 100) })
  }
  for (const s of config.shipments) if (!c.shipments.some(row => row.id === s.shipmentId)) throw Error('monitoring_target_unavailable')
  for (const m of config.trafficMappings) if (m.edgeIds.some(id => !c.network.edges.some(e => e.id === id && e.mode === 'land'))) throw Error('monitoring_route_mapping_unavailable')
  const latest = new Map<string, Observation>()
  for (const raw of c.observations) {
    const o = observationSchema.parse(raw)
    if (o.nature === 'simulated' || o.nature === 'historical' || o.data.kind !== 'traffic') continue
    const old = latest.get(o.data.providerId)
    if (!old || o.observedAt > old.observedAt) latest.set(o.data.providerId, o)
  }
  const network = structuredClone(c.network), road = new Map<string, Observation[]>()
  for (const mapping of config.trafficMappings) {
    const o = latest.get(mapping.providerId)
    if (!o || o.data.kind !== 'traffic' || Date.parse(o.observedAt) > time || Date.parse(o.expiresAt) <= time || Date.parse(o.data.freshUntil) <= time || o.data.validFrom && Date.parse(o.data.validFrom) > time || o.data.validUntil && Date.parse(o.data.validUntil) <= time) continue
    for (const edgeId of mapping.edgeIds) {
      road.set(edgeId, [...(road.get(edgeId) ?? []), o])
      if (o.data.status === 'closed') {
        const e = network.edges.find(e => e.id === edgeId)!
        if (e.metadata) e.metadata.state = 'closed'
      }
    }
  }
  for (const shipment of c.shipments) {
    const terminal = ['delivered', 'cancelled'].includes(shipment.status)
    add('stale_shipment', 'shipment', shipment.id, !terminal && time - Date.parse(shipment.updatedAt) >= config.staleShipmentHours * 3600000, 'Shipment update is overdue', 'Request a verified update from the carrier or shipment owner.', [`last_owner_update:${shipment.updatedAt}`])
    const monitored = config.shipments.find(s => s.shipmentId === shipment.id)
    if (!monitored) continue
    const edges = monitored.edgeIds.map(id => c.network.edges.find(e => e.id === id))
    if (edges.some(e => !e)) throw Error('monitoring_route_mapping_unavailable')
    const nodes = new Set(edges.flatMap(e => [e!.originId, e!.destinationId]))
    const signals = c.signals.filter(s => signalActive(s, c.evaluatedAt) && s.nature !== 'simulated' && (s.target.kind === 'edge' && monitored.edgeIds.includes(s.target.id) || s.target.kind === 'node' && nodes.has(s.target.id)))
    const environmental = signals.filter(s => s.category === 'weather' && ['high', 'critical'].includes(s.severity))
    if (terminal || environmental.length) add('severe_environment', 'shipment', shipment.id, !terminal && environmental.length > 0, 'Severe environmental exposure on monitored route', 'Review weather/marine evidence and consider a safer schedule or route; exposure is not proof of closure.', environmental.map(s => s.id))
    const roadEvidence = monitored.edgeIds.flatMap(id => road.get(id) ?? [])
    const disrupted = roadEvidence.filter(o => o.data.kind === 'traffic' && o.data.status !== 'open')
    const transportRisks = signals.filter(s => s.category !== 'weather' && ['high', 'critical'].includes(s.severity))
    const knownClosed = edges.some(e => e!.metadata?.state === 'closed' && !e!.metadata.hypothetical && current(e!.metadata.provenance))
    // Evidence rules remain latched until reviewed or shipment completion. An open
    // road segment cannot prove that every prior weather/geopolitical cause cleared.
    if (terminal || knownClosed || disrupted.length || transportRisks.length) add('disrupted_route', 'shipment', shipment.id, !terminal && (knownClosed || disrupted.length > 0 || transportRisks.length > 0), 'Potential disruption on monitored route', 'Verify carrier impact and compare alternatives before rerouting cargo.', [...disrupted.map(o => `${o.provider}:${o.recordKey}`), ...transportRisks.map(s => s.id), ...(knownClosed ? ['curated_connection_closed'] : [])])
    if (!shipment.routeRequest || terminal) continue
    const comparison = compareRoutes(network, shipment.routeRequest, c.evaluatedAt, c.signals)
    if (comparison.coverage.truncated) { limitations.push(`route_search_incomplete:${shipment.id}`); continue }
    const route = comparison.alternatives[0]
    const currentRoute = route && !route.hypothetical && route.provenance.every(current)
    if (currentRoute && route.cost.total && route.cost.components.every(component => current(component.provenance)) && monitored.baselineCost && route.cost.total.currency === monitored.baselineCost.currency) {
      const before = parseMoney(monitored.baselineCost.amount), after = parseMoney(route.cost.total.amount)
      if (before > BigInt(0)) add('increased_cost', 'shipment', shipment.id, (after - before) * BigInt(1000000) > before * BigInt(Math.round(config.costIncreasePercent * 10000)), 'Estimated route cost has increased', 'Request a current freight quote and compare currency-matched alternatives.', [`baseline:${monitored.baselineCost.amount} ${monitored.baselineCost.currency}`, `current_estimate:${route.cost.total.amount} ${route.cost.total.currency}`])
    }
    if (currentRoute && route.durationHours && monitored.baselineDurationHours !== null) add('route_delay', 'shipment', shipment.id, route.durationHours.max - monitored.baselineDurationHours > config.routeDelayHours, 'Estimated route duration has increased', 'Confirm ETA and expedite critical replenishments if needed.', [`baseline_hours:${monitored.baselineDurationHours}`, `current_max_hours:${route.durationHours.max}`])
  }
  for (const q of config.inventories) {
    const s = c.inventories.find(s => s.supply.inventory.id === q.inventoryId)
    if (!s) throw Error('monitoring_target_unavailable')
    const forecast = forecastInventory(s.supply, q, { baseline: s.baseline, transport: { ...s.baseline, network } })
    if (forecast.stockoutAt !== null || forecast.consumption.averageDaily !== null) add('potential_stockout', 'inventory', q.inventoryId, forecast.stockoutAt !== null, 'Potential inventory stockout within monitoring horizon', 'Review procurement recommendations, verify incoming quantities and expedite or source alternatives.', [`estimated_stockout:${forecast.stockoutAt ?? 'not_within_horizon'}`, ...forecast.limitations])
  }
  return monitoringEvaluationSchema.parse({ version: 'monitoring-1.0.0', evaluatedAt: c.evaluatedAt, candidates: [...candidates.values()], evaluatedKeys: [...evaluated].sort(), limitations: [...new Set(limitations)] })
}
