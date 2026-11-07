import { createHash } from 'node:crypto'
import { observationSchema, riskSignalIntelligenceSchema, type Network, type RiskSignal, type RouteAlternative } from '@altair/shared/contracts'

export function signalActive(signal: RiskSignal, time: string): boolean {
  const t = Date.parse(time)
  return Date.parse(signal.observedAt) <= t && Date.parse(signal.validFrom ?? signal.observedAt) <= t && (!signal.validUntil || Date.parse(signal.validUntil) > t) && (!signal.provenance.expiresAt || Date.parse(signal.provenance.expiresAt) > t)
}
export function riskExposure(signals: RiskSignal[], targets: { nodes: string[]; edges: string[]; suppliers: string[] }, time: string) {
  const seen = new Set<string>(); const factors: RouteAlternative['riskFactors'] = []
  const severity = { low: 0.25, medium: 0.5, high: 0.75, critical: 1 }
  for (const raw of [...signals].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) {
    const s = riskSignalIntelligenceSchema.parse(raw)
    const ids = s.target.kind === 'node' ? targets.nodes : s.target.kind === 'edge' ? targets.edges : targets.suppliers
    if (seen.has(s.id) || !ids.includes(s.target.id) || !signalActive(s, time)) continue
    seen.add(s.id)
    factors.push({ id: s.id, reason: `${s.category}:${s.status}:${s.rule}`, contribution: severity[s.severity] * s.provenance.confidence * (s.status === 'potential' ? 0.5 : 1), source: s.provenance })
  }
  return { value: factors.length ? Math.max(...factors.map(f => f.contribution)) : null, factors }
}
function weatherId(key: string): string {
  const h = createHash('sha256').update(key).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`
}
export function normalizeRisks(input: { network: Network; signals: unknown[]; observations: unknown[]; legacySignals?: number }, _evaluatedAt: string) {
  const byId = new Map<string, RiskSignal>(); let unmappedObservations = 0
  for (const raw of input.signals) {
    const s = riskSignalIntelligenceSchema.parse(raw)
    if (s.target.kind === 'node' && !input.network.nodes.some(n => n.id === s.target.id) || s.target.kind === 'edge' && !input.network.edges.some(e => e.id === s.target.id)) throw Error('unknown_risk_target')
    const old = byId.get(s.id)
    if (old && JSON.stringify(old) !== JSON.stringify(s)) throw Error('conflicting_risk_evidence')
    byId.set(s.id, s)
  }
  for (const raw of input.observations) {
    const o = observationSchema.parse(raw), d = o.data
    if (d.kind !== 'weather' && d.kind !== 'marine') { if (d.kind === 'news') unmappedObservations++; continue }
    // Zero-radius exact curated coordinate match; no proximity inference or network changes.
    const nodes = input.network.nodes.filter(n => n.coordinates && Math.abs(n.coordinates[0] - d.longitude) < 0.000001 && Math.abs(n.coordinates[1] - d.latitude) < 0.000001)
    if (!nodes.length) { unmappedObservations++; continue }
    let level: 'medium' | 'high' | null = null
    if (d.variable === 'wind_speed_10m' && d.unit === 'km/h') level = d.value >= 70 ? 'high' : d.value >= 50 ? 'medium' : null
    if (d.variable === 'precipitation' && d.unit === 'mm') level = d.value >= 20 ? 'high' : d.value >= 10 ? 'medium' : null
    if (d.variable === 'wave_height' && d.unit === 'm') level = d.value >= 4 ? 'high' : d.value >= 2.5 ? 'medium' : null
    if (!level) continue
    const validUntil = Math.min(Date.parse(o.expiresAt), Date.parse(o.observedAt) + 3600000)
    if (validUntil <= Math.max(Date.parse(o.observedAt), Date.parse(o.fetchedAt))) continue
    for (const node of nodes) {
      const s = riskSignalIntelligenceSchema.parse({ id: weatherId(`${o.provider}/${o.recordKey}/${node.id}/weather-thresholds-v1`), category: 'weather', severity: level, observedAt: o.fetchedAt, validFrom: o.observedAt, validUntil: new Date(validUntil).toISOString(), target: { kind: 'node', id: node.id }, evidence: `${d.variable}=${d.value} ${d.unit}; exact node coordinates, inferred severity, not closure evidence`, provenance: { source: `${o.provider}: ${o.recordKey}`, sourceUrl: o.sourceUrl, observedAt: o.fetchedAt, expiresAt: o.expiresAt, confidence: 0.6, nature: o.nature }, status: 'potential', rule: 'weather-thresholds-v1', nature: o.nature })
      byId.set(s.id, s)
    }
  }
  return { signals: [...byId.values()].sort((a, b) => a.id < b.id ? -1 : 1), coverage: { unmappedObservations, legacySignals: input.legacySignals ?? 0, rules: ['structured-evidence-v1', 'weather-thresholds-v1: wind>=50/70kmh; precipitation>=10/20mm; waves>=2.5/4m; exact-coordinate association'] } }
}
