import { z } from 'zod'
import { amountSchema, boundedNumber, networkSchema, routeRequestSchema, routeComparisonSchema } from './routing'
import { riskSignalIntelligenceSchema } from './intelligence'

const unit = z.string().trim().min(1).max(80)
const connectionChange = z.object({ kind: z.literal('connection'), edgeId: z.uuid(), closed: z.literal(true).optional(), capacityFactor: z.number().min(0).max(1).optional(), costFactor: z.number().min(1).max(1000).optional(), timeFactor: z.number().min(1).max(1000).optional() }).strict().refine(m => m.closed ? m.capacityFactor === undefined && m.costFactor === undefined && m.timeFactor === undefined : m.capacityFactor !== undefined || m.costFactor !== undefined || m.timeFactor !== undefined, 'conflicting_or_empty_connection_change')
export const scenarioModificationSchema = z.discriminatedUnion('kind', [
  connectionChange,
  z.object({ kind: z.literal('supplier_unavailable'), supplierId: z.uuid() }).strict(),
  z.object({ kind: z.literal('inventory_reduction'), inventoryId: z.uuid(), quantity: amountSchema }).strict(),
  z.object({ kind: z.literal('demand_increase'), productId: z.uuid(), unit, quantity: amountSchema }).strict(),
  z.object({ kind: z.literal('replenishment_delay'), shipmentId: z.uuid(), delayHours: boundedNumber.positive().max(8760) }).strict(),
])
export const scenarioInputSchema = z.object({
  name: z.string().trim().min(1).max(200), routeRequest: routeRequestSchema, horizonHours: boundedNumber.positive().max(8760).default(168),
  hypothetical: z.boolean().default(false), assumptions: z.array(z.string().min(1).max(1000)).max(30).default([]),
  demand: z.array(z.object({ productId: z.uuid(), unit, quantity: amountSchema }).strict()).max(100).default([]),
  replenishments: z.array(z.object({ shipmentId: z.uuid(), unit, quantity: amountSchema, routeRequest: routeRequestSchema.optional() }).strict()).max(10).default([]),
  modifications: z.array(scenarioModificationSchema).max(100),
}).strict().superRefine((s, ctx) => {
  const keys = s.modifications.map(m => m.kind === 'connection' ? `edge:${m.edgeId}` : m.kind === 'inventory_reduction' ? `inventory:${m.inventoryId}` : m.kind === 'supplier_unavailable' ? `supplier:${m.supplierId}` : m.kind === 'replenishment_delay' ? `shipment:${m.shipmentId}` : `demand:${m.productId}:${m.unit}`)
  if (new Set(keys).size !== keys.length || new Set(s.demand.map(d => `${d.productId}:${d.unit}`)).size !== s.demand.length || new Set(s.replenishments.map(r => r.shipmentId)).size !== s.replenishments.length) ctx.addIssue({ code: 'custom', message: 'duplicate_scenario_parameters' })
})
export const scenarioSnapshotSchema = z.object({
  version: z.literal(1), evaluatedAt: z.iso.datetime(), network: networkSchema, risks: z.array(riskSignalIntelligenceSchema).max(5000),
  inventory: z.array(z.object({ id: z.uuid(), productId: z.uuid(), warehouseId: z.uuid(), quantity: amountSchema, unit }).strict()).max(1000),
  shipments: z.array(z.object({ id: z.uuid(), supplierId: z.uuid().nullable(), productId: z.uuid().nullable(), estimatedArrival: z.iso.datetime().nullable(), status: z.enum(['planned', 'in_transit', 'delivered', 'delayed', 'cancelled']), originId: z.uuid().nullable(), destinationId: z.uuid().nullable() }).strict()).max(1000),
  supplierIds: z.array(z.uuid()).max(1000), references: z.record(z.string(), z.unknown()),
}).strict().superRefine((s, ctx) => {
  if (new Set(s.inventory.map(i => i.id)).size !== s.inventory.length || new Set(s.shipments.map(i => i.id)).size !== s.shipments.length) ctx.addIssue({ code: 'custom', message: 'duplicate_snapshot_ids' })
})
const supply = z.object({ productId: z.uuid(), unit, available: z.string().nullable(), demand: z.string().nullable(), shortage: z.string().nullable(), complete: z.boolean(), reasons: z.array(z.string()) })
const conditions = z.object({ routes: routeComparisonSchema, supply: z.array(supply) })
export const simulationOutputSchema = z.object({
  engineVersion: z.string(), routingEngineVersion: z.string(), snapshotHash: z.string().regex(/^[a-f0-9]{64}$/), inputHash: z.string().regex(/^[a-f0-9]{64}$/), evaluatedAt: z.iso.datetime(), nature: z.literal('simulated'),
  baseline: conditions, simulated: conditions,
  routeChanges: z.object({ lostRouteIds: z.array(z.string()), gainedRouteIds: z.array(z.string()), conditionalRouteIds: z.array(z.string()), preferredCostDelta: z.object({ amount: z.string(), currency: z.string() }).nullable(), preferredDurationDeltaHours: z.number().nullable(), reasons: z.array(z.string()) }),
  changes: z.array(z.object({ target: z.string(), reason: z.string() })), assumptions: z.array(z.string()),
})
export const scenarioRecordSchema = z.object({ id: z.uuid(), name: z.string(), createdAt: z.iso.datetime(), engineVersion: z.string(), baselineReference: z.string(), input: scenarioInputSchema, snapshot: scenarioSnapshotSchema, output: simulationOutputSchema.nullable() })
export type ScenarioInput = z.infer<typeof scenarioInputSchema>
export type ScenarioSnapshot = z.infer<typeof scenarioSnapshotSchema>
export type SimulationOutput = z.infer<typeof simulationOutputSchema>
export type ScenarioRecord = z.infer<typeof scenarioRecordSchema>
