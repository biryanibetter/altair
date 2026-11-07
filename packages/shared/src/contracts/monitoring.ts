import { z } from 'zod'
import { amountSchema, currencySchema } from './routing'
import { forecastRequestSchema } from './supply'

export const alertRuleSchema = z.enum(['disrupted_route', 'severe_environment', 'stale_shipment', 'increased_cost', 'route_delay', 'potential_stockout'])
export const alertSeveritySchema = z.enum(['low', 'medium', 'high', 'critical'])
const rule = z.object({ enabled: z.boolean().default(true), severity: alertSeveritySchema.default('high') }).strict().default({ enabled: true, severity: 'high' })
export const monitoringConfigSchema = z.object({
  rules: z.object({ disrupted_route: rule, severe_environment: rule, stale_shipment: rule, increased_cost: rule, route_delay: rule, potential_stockout: rule }).strict().prefault({}),
  staleShipmentHours: z.number().min(1).max(8760).default(24),
  costIncreasePercent: z.number().min(0).max(10000).default(20),
  routeDelayHours: z.number().min(0).max(8760).default(2),
  shipments: z.array(z.object({ shipmentId: z.uuid(), edgeIds: z.array(z.uuid()).min(1).max(20), baselineCost: z.object({ amount: amountSchema, currency: currencySchema }).strict().nullable().default(null), baselineDurationHours: z.number().positive().max(8760).nullable().default(null) }).strict()).max(50).default([]),
  inventories: z.array(forecastRequestSchema).max(10).default([]),
  trafficMappings: z.array(z.object({ providerId: z.string().min(1).max(1000), edgeIds: z.array(z.uuid()).min(1).max(20) }).strict()).max(100).default([]),
}).strict().superRefine((c, ctx) => {
  for (const values of [c.shipments.map(s => s.shipmentId), c.inventories.map(i => i.inventoryId), c.trafficMappings.map(m => m.providerId)]) if (new Set(values).size !== values.length) ctx.addIssue({ code: 'custom', message: 'duplicate_monitoring_target' })
  if (c.inventories.some(i => i.scenarioId)) ctx.addIssue({ code: 'custom', message: 'monitoring_uses_current_operations_not_private_simulations' })
})
export const alertCandidateSchema = z.object({
  dedupKey: z.string().min(1).max(200), rule: alertRuleSchema, targetKind: z.enum(['shipment', 'inventory']), targetId: z.uuid(), severity: alertSeveritySchema,
  title: z.string().min(1).max(200), action: z.string().min(1).max(1000), evidence: z.array(z.string().max(1000)).max(100),
}).strict()
export const monitoringEvaluationSchema = z.object({ version: z.literal('monitoring-1.0.0'), evaluatedAt: z.iso.datetime(), candidates: z.array(alertCandidateSchema).max(1000), evaluatedKeys: z.array(z.string().max(200)).max(1000), limitations: z.array(z.string()).max(100) })
export const alertRecordSchema = z.object({
  id: z.uuid(), title: z.string(), shipmentId: z.uuid().nullable(), rule: alertRuleSchema.nullable(), dedupKey: z.string().nullable(), targetKind: z.enum(['shipment', 'inventory']).nullable(), targetId: z.uuid().nullable(), severity: alertSeveritySchema,
  state: z.enum(['open', 'acknowledged', 'resolved']), action: z.string().nullable(), evidence: z.array(z.string()), occurrence: z.number().int().positive(), notificationCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(), acknowledgedAt: z.iso.datetime().nullable(), resolvedAt: z.iso.datetime().nullable(),
})
export const alertQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50), cursor: z.uuid().optional(), state: z.enum(['open', 'acknowledged', 'resolved']).optional() }).strict()
export const alertTransitionSchema = z.object({ state: z.enum(['acknowledged', 'resolved']) }).strict()
export type MonitoringConfig = z.infer<typeof monitoringConfigSchema>
export type AlertCandidate = z.infer<typeof alertCandidateSchema>
export type MonitoringEvaluation = z.infer<typeof monitoringEvaluationSchema>
