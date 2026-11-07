import type { ScenarioInput, ScenarioSnapshot } from '@altair/shared/contracts'
import { compareRoutes } from '../routing/engine'

// Shared transport/crisis semantics. No forecast-specific route simulation.
export function evaluateReplenishment(snapshot: ScenarioSnapshot, baseline: ScenarioSnapshot, replenishment: ScenarioInput['replenishments'][number], unavailable: Set<string> = new Set(), delays: Map<string, number> = new Map()) {
  const shipment = snapshot.shipments.find(s => s.id === replenishment.shipmentId)
  const result = (status: 'eligible' | 'unavailable' | 'unknown', reason: string, arrivalAt: string | null = null) => ({ status, arrivalAt, reasons: [reason] })
  if (!shipment) return result('unknown', 'replenishment_shipment_unknown')
  if (shipment.status === 'delivered' || shipment.status === 'cancelled') return result('unavailable', 'replenishment_already_delivered_or_cancelled')
  if (shipment.supplierId && unavailable.has(shipment.supplierId)) return result('unavailable', 'supplier_unavailable')
  if (!shipment.estimatedArrival) return result('unknown', 'replenishment_arrival_unknown')
  let hours = delays.get(shipment.id) ?? 0
  const reasons: string[] = []
  if (replenishment.routeRequest) {
    const before = compareRoutes(baseline.network, replenishment.routeRequest, baseline.evaluatedAt, baseline.risks)
    const after = compareRoutes(snapshot.network, replenishment.routeRequest, snapshot.evaluatedAt, snapshot.risks)
    if (before.coverage.truncated || after.coverage.truncated) return result('unknown', 'replenishment_route_search_incomplete')
    const a = before.alternatives[0], b = after.alternatives[0]
    if (!b) return result('unavailable', 'replenishment_route_unavailable')
    if (!a?.durationHours || !b.durationHours || b.feasibility === 'conditional') return result('unknown', 'replenishment_route_estimate_unconfirmed')
    hours += Math.max(0, b.durationHours.max - a.durationHours.max)
    reasons.push('replenishment_arrival_adjusted_by_explicit_route_duration_delta')
  } else reasons.push('route_dependency_unspecified_not_inferred')
  const time = Date.parse(shipment.estimatedArrival) + hours * 3600000
  if (time < Date.parse(snapshot.evaluatedAt)) return { status: 'unknown' as const, arrivalAt: null, reasons: [...reasons, 'overdue_replenishment_not_assumed_available'] }
  return { status: 'eligible' as const, arrivalAt: new Date(time).toISOString(), reasons }
}
