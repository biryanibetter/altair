import { describe, expect, it } from 'vitest'
import { networkSchema, routeRequestSchema, routeComparisonSchema } from '@altair/shared/contracts'
import { compareRoutes } from '../src/routing/engine'

import { graph, request, now, id } from './routing-fixtures'

describe('deterministic directed routing', () => {
  it('aggregates decimal costs exactly and identifies non-dominated alternatives', () => {
    const result = compareRoutes(graph(), request(), now)
    expect(routeComparisonSchema.safeParse(result).success).toBe(true)
    const cheap = result.alternatives.find(r => r.edgeIds.length === 2 && r.edgeIds[0] === id(11))!
    expect(cheap.cost.total).toEqual({ amount: '0.30', currency: 'USD' })
    expect(cheap.durationHours).toEqual({ min: 20, max: 24 })
    expect(cheap.paretoOptimal).toBe(true)
    expect(result.alternatives.find(r => r.edgeIds[0] === id(14))!.paretoOptimal).toBe(false)
    expect(result.alternatives.every(r => r.geometry.features.length === 0 && r.geometryGaps.length > 0)).toBe(true)
  })
  it('changes ranking with priorities without changing candidate discovery', () => {
    const cost = compareRoutes(graph(), request({ priorities: { cost: 1, time: 0, risk: 0 } }), now)
    const time = compareRoutes(graph(), request({ priorities: { cost: 0, time: 1, risk: 0 } }), now)
    expect(cost.alternatives[0].edgeIds).toEqual([id(11), id(12)])
    expect(time.alternatives[0].edgeIds).toEqual([id(13)])
    expect(cost.coverage).toEqual(time.coverage)
    expect(compareRoutes(graph(), request(), now)).toEqual(compareRoutes(graph(), request(), now))
  })
  it('does not lose small monetary differences while ranking large exact totals', () => {
    const g = graph(); g.edges = [g.edges[0], g.edges[1], g.edges[2]]
    g.edges[0].metadata!.costs[0].amount = '100000000000.000002'; g.edges[1].metadata!.costs[0].amount = '0'; g.edges[2].metadata!.costs[0].amount = '100000000000.000001'
    expect(compareRoutes(g, request({ priorities: { cost: 1, time: 0, risk: 0 } }), now).alternatives[0].edgeIds).toEqual([id(13)])
  })
  it('never creates reverse, nearby or implicit transfer connections', () => {
    expect(compareRoutes(graph(), request({ originId: id(4), destinationId: id(1) }), now).alternatives).toEqual([])
    expect(compareRoutes({ ...graph(), edges: [] }, request(), now).reasons).toContain('no_feasible_path')
  })
  it('filters closures, capacity, modes, handling and hypothetical opt-in', () => {
    const g = graph(); g.edges[0].metadata!.state = 'closed'; g.edges[2].metadata!.capacityKg = 50
    g.edges[3].metadata!.handling = []
    expect(compareRoutes(g, request(), now).alternatives).toEqual([])
    expect(compareRoutes(graph(), request({ preferences: { allowHypothetical: false } }), now).alternatives).toEqual([])
    expect(compareRoutes(graph(), request({ preferences: { allowHypothetical: true, modes: ['sea'] } }), now).alternatives).toEqual([])
  })
  it('reports unknown capacity, availability and stale evidence as conditional', () => {
    const g = graph(); g.edges = [g.edges[2]]; g.edges[0].metadata!.capacityKg = null
    const r = compareRoutes(g, request(), now).alternatives[0]
    expect(r.feasibility).toBe('conditional'); expect(r.reasons).toContain('capacity_kg_unknown')
    expect(compareRoutes(g, request({ constraints: { requireConfirmed: true } }), now).alternatives).toEqual([])
    g.edges[0].metadata = null
    expect(compareRoutes(g, request(), now).alternatives[0].cost.total).toBeNull()
    expect(compareRoutes(g, request({ constraints: { maxDurationHours: 99 } }), now).alternatives).toEqual([])
  })
  it('enforces minimum confidence after all applicable cost and risk evidence is aggregated', () => {
    const g = graph()
    for (const e of g.edges) { e.metadata!.provenance.confidence = 1; e.metadata!.costs[0].provenance.confidence = 0.1 }
    const r = compareRoutes(g, request({ constraints: { minConfidence: 0.9, requireConfirmed: true } }), now)
    expect(r.alternatives).toEqual([])
    expect(r.rejectedRoutes.some(rejected => rejected.reasons.includes('route_confidence_below_minimum'))).toBe(true)
  })
  it('rejects zero-capacity connections even without a declared shipment mass', () => {
    const g = graph(); g.edges = [g.edges[2]]; g.edges[0].metadata!.capacityKg = 0
    expect(compareRoutes(g, request({ shipment: {} }), now).alternatives).toEqual([])
  })
  it('ranks lower risk first when risk is the only objective', () => {
    const g = graph(); g.edges[0].metadata!.risk = 0.1; g.edges[1].metadata!.risk = 0.1
    expect(compareRoutes(g, request({ priorities: { cost: 0, time: 0, risk: 1 } }), now).alternatives[0].edgeIds).toEqual([id(11), id(12)])
  })
  it('keeps unknown and mixed-currency amounts unavailable and respects hard ceilings', () => {
    const g = graph(); g.edges = g.edges.slice(0, 2); g.edges[1].metadata!.costs[0].currency = 'QAR'
    const r = compareRoutes(g, request(), now).alternatives[0]
    expect(r.cost.total).toBeNull(); expect(r.cost.subtotals).toHaveLength(2)
    expect(r.paretoOptimal).toBeNull()
    expect(compareRoutes(g, request({ constraints: { maxCost: { amount: '1.00', currency: 'USD' } } }), now).alternatives).toEqual([])
    g.edges[1].metadata!.costs = []
    expect(compareRoutes(g, request(), now).alternatives[0].cost.total).toBeNull()
  })
  it('reports bounded-search truncation instead of global optimality', () => {
    const r = compareRoutes(graph(), request({ constraints: { maxExpansions: 1 } }), now)
    expect(r.coverage.truncated).toBe(true)
    expect(r.coverage.paretoScope).toBe('evaluated_candidates')
  })
  it('rejects invalid inputs, duplicate IDs, all-zero priorities and malformed graphs', () => {
    for (const extra of [{ ownerId: id(7) }, { priorities: { cost: 0, time: 0, risk: 0 } }, { shipment: { massKg: -1 } }, { originId: id(4) }, { constraints: { maxHops: 100 } }]) expect(() => request(extra)).toThrow()
    const g = graph(); g.edges.push(g.edges[0]); expect(networkSchema.safeParse(g).success).toBe(false)
    expect(() => compareRoutes(graph(), request({ originId: id(99) }), now)).toThrow('unknown_location')
  })
})
