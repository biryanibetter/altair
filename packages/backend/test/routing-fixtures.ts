import { networkSchema, routeRequestSchema } from '@altair/shared/contracts'
export const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
export const now = '2026-11-06T12:00:00.000Z'
export const provenance = { source: 'Hypothetical test assumptions, not a freight quotation', sourceUrl: null, observedAt: now, expiresAt: '2026-11-07T12:00:00.000Z', confidence: 0.8, nature: 'simulated' as const }
export const edge = (n: number, from: number, to: number, amount = '10.00', hours = 10) => ({
  id: id(n), originId: id(from), destinationId: id(to), mode: 'land' as const,
  metadata: { version: 1 as const, hypothetical: true, provenance, distanceKm: 100, durationHours: { min: hours, max: hours + 2 }, geometry: null,
    costs: [{ name: 'assumed total', amount, currency: 'USD', basis: 'shipment' as const, provenance }], costCoverage: 'complete' as const,
    state: 'open' as const, capacityKg: 1000, capacityM3: null, handling: ['ambient'], prohibitedCommodities: [], risk: 0.2 },
})
export const graph = () => networkSchema.parse({ version: 1, nodes: [1, 2, 3, 4].map(n => ({ id: id(n), name: n === 4 ? 'Hypothetical Qatar destination' : `Test hub ${n}`, kind: 'hub', countryCode: n === 4 ? 'QA' : 'AE', coordinates: null })), edges: [edge(11, 1, 2, '0.10'), edge(12, 2, 4, '0.20'), edge(13, 1, 4, '20.00', 2), edge(14, 1, 3, '40.00', 30), edge(15, 3, 4, '10.00', 30)] })
export const request = (extra = {}) => routeRequestSchema.parse({ originId: id(1), destinationId: id(4), shipment: { massKg: 100, handling: ['ambient'] }, preferences: { allowHypothetical: true }, ...extra })
