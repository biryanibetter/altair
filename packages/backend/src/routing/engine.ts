import { networkSchema, routeRequestSchema, type Network, type NetworkEdge, type RouteRequest, type RouteComparison, type RouteAlternative, type RiskSignal } from '@altair/shared/contracts'
import { decimal, multiply, units } from './money'
import { riskExposure } from '../intelligence/risks'

export const ENGINE_VERSION = 'altair-routing-1.0.0'
const MAX_CANDIDATES = 500
const stable = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
function checkEdge(edge: NetworkEdge, r: RouteRequest, time: string) {
  const hard: string[] = [], conditional: string[] = []; const m = edge.metadata
  if (!r.preferences.modes.includes(edge.mode)) hard.push('mode_excluded')
  if (r.constraints.excludedEdgeIds.includes(edge.id) || r.constraints.excludedNodeIds.includes(edge.originId) || r.constraints.excludedNodeIds.includes(edge.destinationId)) hard.push('explicitly_excluded')
  if (!m) conditional.push('connection_evidence_unknown')
  else {
    if (m.hypothetical && !r.preferences.allowHypothetical) hard.push('hypothetical_not_allowed')
    if (m.state === 'closed') hard.push('connection_closed')
    if (m.capacityKg === 0 || m.capacityM3 === 0) hard.push('zero_connection_capacity')
    if (m.state === 'unknown') conditional.push('operational_state_unknown')
    if (Date.parse(m.provenance.observedAt) > Date.parse(time)) conditional.push('future_evidence')
    if (m.provenance.expiresAt && Date.parse(m.provenance.expiresAt) <= Date.parse(time)) conditional.push('stale_evidence')
    if (m.provenance.confidence < r.constraints.minConfidence) hard.push('confidence_below_minimum')
    for (const [quantity, capacity, label] of [[r.shipment.massKg, m.capacityKg, 'kg'], [r.shipment.volumeM3, m.capacityM3, 'm3']] as const) {
      if (quantity !== undefined && capacity === null) conditional.push(`capacity_${label}_unknown`)
      else if (quantity !== undefined && capacity !== null && quantity > capacity) hard.push(`capacity_${label}_exceeded`)
    }
    if (r.shipment.handling.length && m.handling === null) conditional.push('handling_unknown')
    else if (r.shipment.handling.some(h => !m.handling?.includes(h))) hard.push('handling_unsupported')
    if (r.shipment.commodity && m.prohibitedCommodities.includes(r.shipment.commodity)) hard.push('commodity_prohibited')
  }
  if (!m && r.constraints.minConfidence > 0) hard.push('confidence_below_minimum')
  if (r.constraints.requireConfirmed && conditional.length) hard.push('confirmation_required')
  return { hard, conditional }
}

function aggregate(path: NetworkEdge[], g: Network, r: RouteRequest, time: string): RouteAlternative | null {
  const reasons = [...new Set(path.flatMap(e => checkEdge(e, r, time).conditional))]
  const components: RouteAlternative['cost']['components'] = []; const sums = new Map<string, bigint>()
  let complete = true, min = 0, max = 0, durationKnown = true, distance: number | null = 0, confidence = 1, risk: number | null = 0
  const factors: RouteAlternative['riskFactors'] = []
  for (const e of path) {
    const m = e.metadata
    if (!m) { complete = false; durationKnown = false; distance = null; confidence = 0; risk = null; continue }
    confidence = Math.min(confidence, m.provenance.confidence, ...m.costs.map(c => c.provenance.confidence))
    if (m.durationHours) { min += m.durationHours.min; max += m.durationHours.max } else durationKnown = false
    distance = distance !== null && m.distanceKm !== null ? distance + m.distanceKm : null
    risk = risk !== null && m.risk !== null ? Math.max(risk, m.risk) : null
    if (m.risk !== null) factors.push({ id: e.id, reason: 'declared_connection_risk_index_not_probability', contribution: m.risk, source: m.provenance })
    if (m.costCoverage !== 'complete' || m.costs.length === 0) complete = false
    for (const c of m.costs) {
      const quantity = c.basis === 'shipment' ? 1 : c.basis === 'kg' ? r.shipment.massKg : r.shipment.volumeM3
      const amount = c.amount !== null && quantity !== undefined ? multiply(c.amount, quantity) : null
      components.push({ edgeId: e.id, name: c.name, basis: c.basis, amount, currency: c.currency, provenance: c.provenance })
      if (amount === null) complete = false
      else sums.set(c.currency, (sums.get(c.currency) ?? BigInt(0)) + units(amount))
      if (Date.parse(c.provenance.observedAt) > Date.parse(time) || c.provenance.expiresAt && Date.parse(c.provenance.expiresAt) <= Date.parse(time)) reasons.push('cost_evidence_not_current')
    }
  }
  const subtotals = [...sums.entries()].sort(([a], [b]) => stable(a, b)).map(([currency, amount]) => ({ currency, amount: decimal(amount) }))
  const total = complete && subtotals.length === 1 ? subtotals[0] : null
  if (r.constraints.maxCost && (!total || total.currency !== r.constraints.maxCost.currency || units(total.amount) > units(r.constraints.maxCost.amount))) return null
  if (r.constraints.maxDurationHours !== undefined && (!durationKnown || max > r.constraints.maxDurationHours)) return null
  if (r.constraints.requireConfirmed && reasons.length) return null
  const nodeIds = [path[0].originId, ...path.map(e => e.destinationId)]
  return {
    id: path.map(e => e.id).join('/'), edgeIds: path.map(e => e.id), nodes: nodeIds.map(id => g.nodes.find(n => n.id === id)!), legs: path, modes: [...new Set(path.map(e => e.mode))],
    geometry: { type: 'FeatureCollection', features: path.flatMap(e => e.metadata?.geometry ? [{ type: 'Feature' as const, geometry: e.metadata.geometry, properties: { edgeId: e.id, mode: e.mode } }] : []) }, geometryGaps: path.filter(e => !e.metadata?.geometry).map(e => e.id),
    cost: { components, subtotals, total, complete }, durationHours: durationKnown ? { min, max } : null, knownDurationHours: { min, max }, distanceKm: distance,
    risk, riskFactors: factors, confidence, hypothetical: path.some(e => e.metadata?.hypothetical), feasibility: reasons.length ? 'conditional' : 'feasible', reasons: [...new Set(reasons)], provenance: path.flatMap(e => e.metadata ? [e.metadata.provenance] : []),
    paretoOptimal: null, score: 0, scoreBreakdown: { cost: 0, time: 0, risk: 0 }, rankingReasons: [],
  }
}

// Stable binary heap prevents exponential queue sorting. Total retained states are bounded.
type State = { node: string; path: NetworkEdge[]; visited: Set<string>; weight: number; key: string }
class Queue {
  private data: State[] = []
  get length() { return this.data.length }
  private before(a: State, b: State) { return a.weight < b.weight || a.weight === b.weight && stable(a.key, b.key) < 0 }
  push(value: State) { let i = this.data.length; this.data.push(value); while (i > 0) { const p = (i - 1) >> 1; if (!this.before(value, this.data[p])) break; this.data[i] = this.data[p]; i = p } this.data[i] = value }
  pop(): State { const top = this.data[0], last = this.data.pop()!; if (this.data.length) { let i = 0; while (i * 2 + 1 < this.data.length) { let c = i * 2 + 1; if (c + 1 < this.data.length && this.before(this.data[c + 1], this.data[c])) c++; if (!this.before(this.data[c], last)) break; this.data[i] = this.data[c]; i = c } this.data[i] = last } return top }
}

export function compareRoutes(network: Network, input: RouteRequest, evaluatedAt: string, signals: RiskSignal[] = []): RouteComparison {
  const g = networkSchema.parse(network), r = routeRequestSchema.parse(input)
  if (!Number.isFinite(Date.parse(evaluatedAt))) throw new Error('invalid_evaluation_time')
  if (![r.originId, r.destinationId].every(id => g.nodes.some(n => n.id === id))) throw new Error('unknown_location')
  const adjacency = new Map<string, NetworkEdge[]>(); const rejected: RouteComparison['rejected'] = [], rejectedRoutes: RouteComparison['rejectedRoutes'] = []
  for (const e of [...g.edges].sort((a, b) => stable(a.id, b.id))) {
    const check = checkEdge(e, r, evaluatedAt)
    if (check.hard.length) rejected.push({ edgeId: e.id, reasons: check.hard })
    else adjacency.set(e.originId, [...(adjacency.get(e.originId) ?? []), e])
  }
  const queue = new Queue(); queue.push({ node: r.originId, path: [], visited: new Set([r.originId]), weight: 0, key: '' })
  const candidates: RouteAlternative[] = []; let expansions = 0, truncated = false
  while (queue.length && expansions < r.constraints.maxExpansions && candidates.length < MAX_CANDIDATES) {
    const state = queue.pop(); expansions++
    if (state.node === r.destinationId) { const route = aggregate(state.path, g, r, evaluatedAt); if (route) candidates.push(route); continue }
    const next = (adjacency.get(state.node) ?? []).filter(e => !state.visited.has(e.destinationId))
    if (state.path.length >= r.constraints.maxHops) { if (next.length) truncated = true; continue }
    for (const e of next) {
      if (queue.length >= 20000) { truncated = true; break }
      queue.push({ node: e.destinationId, path: [...state.path, e], visited: new Set([...state.visited, e.destinationId]), weight: state.weight + (e.metadata?.durationHours?.min ?? 1), key: `${state.key}/${e.id}` })
    }
  }
  if (queue.length) truncated = true
  for (const route of candidates) {
    const exposure = riskExposure(signals, { nodes: route.nodes.map(n => n.id), edges: route.edgeIds, suppliers: [] }, evaluatedAt)
    route.riskFactors.push(...exposure.factors)
    for (const factor of exposure.factors) if (factor.source) route.confidence = Math.min(route.confidence, factor.source.confidence)
    if (exposure.value !== null && route.risk !== null) route.risk = Math.max(route.risk, exposure.value)
  }
  const feasible = candidates.filter(route => {
    if (route.confidence >= r.constraints.minConfidence) return true
    rejectedRoutes.push({ edgeIds: route.edgeIds, reasons: ['route_confidence_below_minimum'] }); return false
  })
  rankAlternatives(feasible, r)
  return { engineVersion: ENGINE_VERSION, evaluatedAt, alternatives: feasible.slice(0, r.constraints.maxAlternatives), rejected, rejectedRoutes, reasons: feasible.length ? [] : ['no_feasible_path'], coverage: { expansions, evaluatedCandidates: candidates.length, truncated, paretoScope: 'evaluated_candidates', limits: { maxHops: r.constraints.maxHops, maxExpansions: r.constraints.maxExpansions, maxCandidates: MAX_CANDIDATES } }, assumptions: ['Only explicit directed connections are traversed; proximity and reverse services are never inferred.', 'Unknown costs are not zero; currencies are never converted.', 'Times exclude unmodeled customs, waiting and transfers; ranges are not probability distributions.', 'Risk is a conservative maximum observed index, not a probability; unknown risk is unavailable.', 'Pareto and ranking apply only to evaluated candidates; unknown objectives incur a conservative penalty.'] }
}

export function rankAlternatives(routes: RouteAlternative[], r: RouteRequest): void {
  const currencies = new Set(routes.flatMap(a => a.cost.total ? [a.cost.total.currency] : [])); const currencyComparable = currencies.size === 1
  const values = (a: RouteAlternative): (bigint | number | null)[] => [currencyComparable && a.cost.total ? units(a.cost.total.amount) : null, a.durationHours?.max ?? null, a.risk]
  const objectives = routes.map(values)
  routes.forEach((a, i) => {
    const v = objectives[i]
    a.paretoOptimal = v.some(n => n === null) ? null : !objectives.some((other, j) => i !== j && other.every(n => n !== null) && other.every((n, k) => n! <= v[k]!) && other.some((n, k) => n! < v[k]!))
    const keys = ['cost', 'time', 'risk'] as const; const sum = r.priorities.cost + r.priorities.time + r.priorities.risk
    keys.forEach((key, k) => {
      const known = objectives.flatMap(o => o[k] === null ? [] : [o[k]!])
      const lo = known.reduce<bigint | number>((a, b) => b < a ? b : a, known[0] ?? 0), hi = known.reduce<bigint | number>((a, b) => b > a ? b : a, known[0] ?? 0)
      const value = v[k]
      const normalized = value === null ? 1 : hi === lo ? 0 : typeof value === 'bigint' ? Number(value - (lo as bigint)) / Number((hi as bigint) - (lo as bigint)) : (value - (lo as number)) / ((hi as number) - (lo as number))
      a.scoreBreakdown[key] = normalized * r.priorities[key] / sum
    })
    a.score = a.scoreBreakdown.cost + a.scoreBreakdown.time + a.scoreBreakdown.risk
    a.rankingReasons = [v.some(n => n === null) ? 'provisional_missing_or_incomparable_objectives' : 'comparable_objectives', 'lower_weighted_normalized_score_is_better', 'ties_use_feasibility_then_stable_edge_ids']
  })
  routes.sort((a, b) => a.score - b.score || stable(a.feasibility === 'feasible' ? '0' : '1', b.feasibility === 'feasible' ? '0' : '1') || stable(a.id, b.id))
}
