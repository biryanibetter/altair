import { networkSchema, routeRequestSchema } from '@altair/shared/contracts'

// Entirely hypothetical teaching fixture. No real service, quote or schedule is asserted.
export function qatarRoutingDemo() {
  const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`
  const evaluatedAt = '2026-11-06T12:00:00.000Z'
  const provenance = { source: 'ALTAIR hypothetical Qatar demonstration assumptions; NOT a quotation or service confirmation', sourceUrl: null, observedAt: evaluatedAt, expiresAt: null, confidence: 0.5, nature: 'simulated' }
  const nodes = [
    { id: id(1), name: 'Hypothetical UAE export hub', kind: 'hub', countryCode: 'AE', coordinates: [55.1, 24.9] },
    { id: id(2), name: 'Hypothetical Qatar arrival terminal', kind: 'terminal', countryCode: 'QA', coordinates: [51.55, 25.1] },
    { id: id(3), name: 'Hypothetical Doha distribution hub', kind: 'hub', countryCode: 'QA', coordinates: [51.5, 25.3] },
  ]
  const connection = (n: number, from: number, to: number, mode: string, amount: string, hours: number) => ({ id: id(n), originId: id(from), destinationId: id(to), mode, metadata: { version: 1, hypothetical: true, provenance, distanceKm: null, durationHours: { min: hours, max: hours + 4 }, geometry: null, costs: [{ name: 'Hypothetical all-in scenario assumption, not freight/customs quotation', amount, currency: 'USD', basis: 'shipment', provenance }], costCoverage: 'complete', state: 'open', capacityKg: 10000, capacityM3: null, handling: ['ambient'], prohibitedCommodities: [], risk: 0.2 } })
  return { label: 'HYPOTHETICAL Qatar-bound logistics demonstration', evaluatedAt, network: networkSchema.parse({ version: 1, nodes, edges: [connection(11, 1, 2, 'sea', '500.00', 36), connection(12, 2, 3, 'land', '100.00', 2), connection(13, 1, 3, 'air', '2000.00', 5), connection(14, 1, 3, 'land', '900.00', 20)] }), request: routeRequestSchema.parse({ originId: id(1), destinationId: id(3), shipment: { massKg: 1000, handling: ['ambient'] }, preferences: { allowHypothetical: true } }) }
}
