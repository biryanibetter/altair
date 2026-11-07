import { z } from 'zod'

export const boundedNumber = z.number().finite().min(0).max(1e12)
export const amountSchema = z.string().regex(/^\d{1,12}(?:\.\d{1,6})?$/)
export const currencySchema = z.string().regex(/^[A-Z]{3}$/)
export const modeSchema = z.enum(['land', 'sea', 'air'])
export const coordinatesSchema = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
export const geometrySchema = z.object({ type: z.literal('LineString'), coordinates: z.array(coordinatesSchema).min(2).max(20000) }).strict()
export const provenanceSchema = z.object({
  source: z.string().min(1).max(1000), sourceUrl: z.url().nullable(), observedAt: z.iso.datetime(), expiresAt: z.iso.datetime().nullable(),
  confidence: z.number().min(0).max(1), nature: z.enum(['live', 'historical', 'estimated', 'simulated']),
}).strict().refine(p => !p.expiresAt || Date.parse(p.expiresAt) >= Date.parse(p.observedAt), 'expiry_before_observation')
export const durationSchema = z.object({ min: boundedNumber, max: boundedNumber }).strict().refine(d => d.max >= d.min, 'invalid_duration_range')
export const costInputSchema = z.object({ name: z.string().min(1).max(200), amount: amountSchema.nullable(), currency: currencySchema, basis: z.enum(['shipment', 'kg', 'm3']), provenance: provenanceSchema }).strict()
export const connectionMetadataSchema = z.object({
  version: z.literal(1), hypothetical: z.boolean(), provenance: provenanceSchema,
  distanceKm: boundedNumber.nullable(), durationHours: durationSchema.nullable(), geometry: geometrySchema.nullable(),
  costs: z.array(costInputSchema).max(30), costCoverage: z.enum(['complete', 'partial', 'unavailable']),
  state: z.enum(['open', 'closed', 'unknown']), capacityKg: boundedNumber.nullable(), capacityM3: boundedNumber.nullable(),
  handling: z.array(z.string().min(1).max(100)).max(20).nullable(), prohibitedCommodities: z.array(z.string().min(1).max(100)).max(100),
  risk: z.number().min(0).max(1).nullable(),
}).strict()
export const networkNodeSchema = z.object({ id: z.uuid(), name: z.string().min(1).max(200), kind: z.enum(['port', 'airport', 'terminal', 'hub', 'city', 'border']), countryCode: z.string().length(2), coordinates: coordinatesSchema.nullable() }).strict()
export const networkEdgeSchema = z.object({ id: z.uuid(), originId: z.uuid(), destinationId: z.uuid(), mode: modeSchema, metadata: connectionMetadataSchema.nullable() }).strict().refine(e => e.originId !== e.destinationId)
export const networkSchema = z.object({ version: z.literal(1), nodes: z.array(networkNodeSchema).max(500), edges: z.array(networkEdgeSchema).max(2000) }).strict().superRefine((g, ctx) => {
  const nodes = new Set(g.nodes.map(n => n.id)); const edges = new Set(g.edges.map(e => e.id))
  if (nodes.size !== g.nodes.length || edges.size !== g.edges.length || g.edges.some(e => !nodes.has(e.originId) || !nodes.has(e.destinationId))) ctx.addIssue({ code: 'custom', message: 'duplicate_or_missing_network_ids' })
})
export const routeRequestSchema = z.object({
  originId: z.uuid(), destinationId: z.uuid(),
  shipment: z.object({ massKg: boundedNumber.positive().optional(), volumeM3: boundedNumber.positive().optional(), commodity: z.string().min(1).max(100).optional(), handling: z.array(z.string().min(1).max(100)).max(20).default([]) }).strict().default({ handling: [] }),
  preferences: z.object({ modes: z.array(modeSchema).min(1).max(3).default(['land', 'sea', 'air']), allowHypothetical: z.boolean().default(false), enrichGeometry: z.boolean().default(false) }).strict().default({ modes: ['land', 'sea', 'air'], allowHypothetical: false, enrichGeometry: false }),
  constraints: z.object({
    maxDurationHours: boundedNumber.optional(), maxCost: z.object({ amount: amountSchema, currency: currencySchema }).strict().optional(),
    maxHops: z.number().int().min(1).max(10).default(6), maxExpansions: z.number().int().min(1).max(5000).default(5000),
    maxAlternatives: z.number().int().min(1).max(50).default(10), requireConfirmed: z.boolean().default(false), minConfidence: z.number().min(0).max(1).default(0),
    excludedNodeIds: z.array(z.uuid()).max(500).default([]), excludedEdgeIds: z.array(z.uuid()).max(2000).default([]),
  }).strict().default({ maxHops: 6, maxExpansions: 5000, maxAlternatives: 10, requireConfirmed: false, minConfidence: 0, excludedNodeIds: [], excludedEdgeIds: [] }),
  priorities: z.object({ cost: z.number().min(0).max(1e6), time: z.number().min(0).max(1e6), risk: z.number().min(0).max(1e6) }).strict().default({ cost: 1, time: 1, risk: 1 }),
}).strict().superRefine((r, ctx) => {
  if (r.originId === r.destinationId || r.priorities.cost + r.priorities.time + r.priorities.risk === 0 || r.constraints.excludedNodeIds.includes(r.originId) || r.constraints.excludedNodeIds.includes(r.destinationId)) ctx.addIssue({ code: 'custom', message: 'conflicting_route_parameters' })
})
const money = z.object({ amount: z.string().regex(/^\d+(?:\.\d+)?$/), currency: currencySchema })
export const routeAlternativeSchema = z.object({
  id: z.string(), edgeIds: z.array(z.uuid()), nodes: z.array(networkNodeSchema), legs: z.array(networkEdgeSchema), modes: z.array(modeSchema),
  geometry: z.object({ type: z.literal('FeatureCollection'), features: z.array(z.object({ type: z.literal('Feature'), geometry: geometrySchema, properties: z.object({ edgeId: z.uuid(), mode: modeSchema }) })) }), geometryGaps: z.array(z.uuid()),
  cost: z.object({ components: z.array(z.object({ edgeId: z.uuid(), name: z.string(), basis: z.string(), amount: z.string().nullable(), currency: currencySchema, provenance: provenanceSchema })), subtotals: z.array(money), total: money.nullable(), complete: z.boolean() }),
  durationHours: durationSchema.nullable(), knownDurationHours: durationSchema, distanceKm: boundedNumber.nullable(),
  risk: z.number().min(0).max(1).nullable(), riskFactors: z.array(z.object({ id: z.string(), reason: z.string(), contribution: z.number().min(0).max(1), source: provenanceSchema.nullable() })),
  confidence: z.number().min(0).max(1), hypothetical: z.boolean(), feasibility: z.enum(['feasible', 'conditional']), reasons: z.array(z.string()), provenance: z.array(provenanceSchema),
  paretoOptimal: z.boolean().nullable(), score: z.number(), scoreBreakdown: z.object({ cost: z.number(), time: z.number(), risk: z.number() }), rankingReasons: z.array(z.string()),
})
export const routeComparisonSchema = z.object({
  providerEstimates: z.array(z.discriminatedUnion('status', [
    z.object({ edgeId: z.uuid(), status: z.literal('available'), estimate: z.object({ distanceKm: boundedNumber, durationHours: boundedNumber, geometry: geometrySchema.nullable(), provenance: provenanceSchema, parametersHash: z.string(), assumptions: z.array(z.string()) }) }),
    z.object({ edgeId: z.uuid(), status: z.enum(['unavailable', 'unconfigured']), reason: z.string() }),
  ])).optional(),
  engineVersion: z.string(), evaluatedAt: z.iso.datetime(), alternatives: z.array(routeAlternativeSchema), reasons: z.array(z.string()),
  rejected: z.array(z.object({ edgeId: z.uuid(), reasons: z.array(z.string()) })),
  rejectedRoutes: z.array(z.object({ edgeIds: z.array(z.uuid()), reasons: z.array(z.string()) })),
  coverage: z.object({ expansions: z.number().int(), evaluatedCandidates: z.number().int(), truncated: z.boolean(), paretoScope: z.literal('evaluated_candidates'), limits: z.object({ maxHops: z.number(), maxExpansions: z.number(), maxCandidates: z.number() }) }),
  assumptions: z.array(z.string()),
})
export type Network = z.infer<typeof networkSchema>
export type NetworkEdge = z.infer<typeof networkEdgeSchema>
export type RouteRequest = z.infer<typeof routeRequestSchema>
export type RouteComparison = z.infer<typeof routeComparisonSchema>
export type RouteAlternative = z.infer<typeof routeAlternativeSchema>
export type Provenance = z.infer<typeof provenanceSchema>
