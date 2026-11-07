import { z } from 'zod'
import { provenanceSchema } from './routing'

export const riskTargetSchema = z.object({ kind: z.enum(['node', 'edge', 'supplier']), id: z.uuid() }).strict()
export const riskCategorySchema = z.enum(['weather', 'transportation', 'supplier', 'geopolitical'])
export const riskSignalIntelligenceSchema = z.object({
  id: z.uuid(), category: riskCategorySchema, severity: z.enum(['low', 'medium', 'high', 'critical']),
  observedAt: z.iso.datetime(), validFrom: z.iso.datetime().optional(), validUntil: z.iso.datetime().nullable(), target: riskTargetSchema,
  evidence: z.string().min(1).max(4000), provenance: provenanceSchema, status: z.enum(['potential', 'confirmed']),
  rule: z.string().min(1).max(200), nature: z.enum(['live', 'historical', 'estimated', 'simulated']),
}).strict().superRefine((r, ctx) => {
  if (r.category === 'geopolitical' && r.status === 'confirmed') ctx.addIssue({ code: 'custom', message: 'news_is_potential_evidence_only' })
  if (r.validUntil && Date.parse(r.validUntil) < Date.parse(r.validFrom ?? r.observedAt)) ctx.addIssue({ code: 'custom', message: 'invalid_risk_validity' })
})
export const risksQuerySchema = z.object({
  category: riskCategorySchema.optional(), targetId: z.uuid().optional(),
  freshness: z.enum(['active', 'stale', 'all']).default('active'), limit: z.coerce.number().int().min(1).max(100).default(50), cursor: z.uuid().optional(),
}).strict()
export const risksResponseSchema = z.object({
  data: z.array(riskSignalIntelligenceSchema), meta: z.object({ nextCursor: z.uuid().nullable(), availability: z.enum(['available', 'unavailable']), evaluatedAt: z.iso.datetime(), coverage: z.object({ unmappedObservations: z.number().int(), legacySignals: z.number().int(), rules: z.array(z.string()) }) }),
})
export type RiskSignal = z.infer<typeof riskSignalIntelligenceSchema>
