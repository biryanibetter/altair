import { describe, expect, it } from 'vitest'
import { riskSignalIntelligenceSchema } from '@altair/shared/contracts'
import { normalizeRisks, riskExposure } from '../src/intelligence/risks'
import { compareRoutes } from '../src/routing/engine'
import { graph, id, now, provenance, request } from './routing-fixtures'

export const signal = () => riskSignalIntelligenceSchema.parse({ id: id(80), category: 'geopolitical', severity: 'critical', observedAt: now, validUntil: '2026-11-08T12:00:00.000Z', target: { kind: 'node', id: id(1) }, evidence: 'Hypothetical news article, does not confirm closure', provenance, status: 'potential', rule: 'structured-evidence-v1', nature: 'simulated' })
describe('evidence-backed risk intelligence', () => {
  it('deduplicates targeted signals, reports stale evidence and never closes routes from news', () => {
    const risk = signal(); const g = graph()
    const exposure = riskExposure([risk, risk], { nodes: [id(1), id(2)], edges: [id(11)], suppliers: [] }, now)
    expect(exposure.value).toBe(0.4); expect(exposure.factors).toHaveLength(1)
    expect(riskExposure([risk], { nodes: [id(1)], edges: [], suppliers: [] }, '2026-11-09T00:00:00.000Z').value).toBeNull()
    expect(compareRoutes(g, request(), now, [risk]).alternatives).toHaveLength(3)
    expect(compareRoutes(g, request(), now, [risk]).alternatives.every(a => a.riskFactors.some(f => f.id === risk.id))).toBe(true)
    expect(g).toEqual(graph())
  })
  it('applies requested confidence thresholds to applicable risk evidence as well as connections', () => {
    const s = signal(); s.provenance.confidence = 0.1
    const r = compareRoutes(graph(), request({ constraints: { minConfidence: 0.7 } }), now, [s])
    expect(r.alternatives).toEqual([])
  })
  it('normalizes mapped weather with explicit thresholds and leaves unmapped news unassigned', () => {
    const g = graph(); g.nodes[0].coordinates = [51, 25]
    const observations = [{ id: id(90), job: 'weather', provider: 'open-meteo', recordKey: 'wind', sourceId: id(91), sourceUrl: 'https://open-meteo.com', license: 'CC BY 4.0', nature: 'estimated', observedAt: now, fetchedAt: now, expiresAt: '2026-11-07T12:00:00.000Z', sourceUpdatedAt: null, data: { kind: 'weather', latitude: 25, longitude: 51, variable: 'wind_speed_10m', unit: 'km/h', value: 70 } }]
    const r = normalizeRisks({ network: g, signals: [], observations }, now)
    expect(r.signals).toHaveLength(1); expect(r.signals[0].severity).toBe('high'); expect(r.signals[0].status).toBe('potential')
    expect(r.signals[0].target).toEqual({ kind: 'node', id: id(1) })
    const noMapping = normalizeRisks({ network: graph(), signals: [], observations }, now)
    expect(noMapping.signals).toEqual([]); expect(noMapping.coverage.unmappedObservations).toBe(1)
  })
  it('requires evidence, targets and confidence; geopolitical reports cannot be confirmed closures', () => {
    expect(riskSignalIntelligenceSchema.safeParse({ ...signal(), evidence: '' }).success).toBe(false)
    expect(riskSignalIntelligenceSchema.safeParse({ ...signal(), status: 'confirmed' }).success).toBe(false)
    for (const category of ['transportation', 'supplier'] as const) expect(normalizeRisks({ network: graph(), observations: [], signals: [{ ...signal(), category, status: 'confirmed' }] }, now).signals).toHaveLength(1)
  })
  it('keeps forecasts outside their applicable hour inactive, even when synchronized recently', () => {
    const g = graph(); g.nodes[0].coordinates = [51, 25]
    const observation = { job: 'weather', provider: 'open-meteo', recordKey: 'future', sourceId: id(91), sourceUrl: 'https://open-meteo.com', license: 'CC BY 4.0', nature: 'estimated', observedAt: '2026-11-06T18:00:00Z', fetchedAt: now, expiresAt: '2026-11-06T13:00:00Z', sourceUpdatedAt: null, data: { kind: 'weather', latitude: 25, longitude: 51, variable: 'wind_speed_10m', unit: 'km/h', value: 80 } }
    const r = normalizeRisks({ network: g, signals: [], observations: [observation] }, now)
    expect(riskExposure(r.signals, { nodes: [id(1)], edges: [], suppliers: [] }, now).value).toBeNull()
    expect(r.signals).toHaveLength(0)
  })
})
