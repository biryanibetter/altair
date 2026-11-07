import { z } from 'zod'

export const approvedToolInputSchema = z.object({ tool: z.enum(['compare_routes','forecast_inventory','create_simulation','import_dependencies']), arguments: z.record(z.string(), z.unknown()) }).strict()
export const assistantRequestSchema = z.object({ message: z.string().trim().min(1).max(8000), conversationId: z.uuid().optional(), allowSimulationCreation: z.boolean().default(false), approvedToolInputs: z.array(approvedToolInputSchema).max(6).default([]) }).strict()
export const assistantReservationSchema = z.object({ conversationId: z.uuid(), turnId: z.uuid() })
export const assistantHistorySchema = z.array(z.object({ message: z.string().max(8000) })).max(4)
export const assistantTaskSchema = z.enum(['routing', 'disruption', 'inventory', 'forecasting', 'suppliers', 'simulation', 'imports', 'clarification'])
export const assistantActionSchema = z.enum(['verify_records', 'compare_alternatives', 'review_replenishment', 'verify_supplier', 'review_scenario', 'request_evidence'])
const selection = z.object({ evidenceId: z.string().regex(/^e[1-6]$/), pointer: z.string().min(1).max(400).regex(/^\//) }).strict()
export const assistantAnswerSchema = z.object({ task: assistantTaskSchema, findings: z.array(selection).max(12), recommendations: z.array(z.object({ action: assistantActionSchema, evidenceIds: z.array(z.string().regex(/^e[1-6]$/)).min(1).max(6) }).strict()).max(5) }).strict()
export const assistantModelTurnSchema = z.union([
  z.object({ calls: z.array(z.object({ id: z.string().min(1).max(100), name: z.string().min(1).max(80), arguments: z.string().max(16000) }).strict()).min(1).max(6) }).strict(),
  z.object({ answer: assistantAnswerSchema }).strict(),
])
const kind = z.enum(['fact', 'estimate', 'prediction', 'hypothetical'])
export const assistantEvidenceSchema = z.object({ id: z.string(), tool: z.string(), kind, retrievedAt: z.iso.datetime(), parameters: z.record(z.string(), z.unknown()), parameterAuthority: z.enum(['user_approved','record_lookup_or_defaults']), references: z.array(z.object({ path: z.string(), id: z.string() })), sources: z.array(z.object({ path: z.string(), metadata: z.record(z.string(), z.unknown()) })), data: z.unknown() })
export const assistantResponseSchema = z.object({
  version: z.literal('assistant-1.0.0'), status: z.enum(['ok', 'degraded']), task: assistantTaskSchema,
  conversationId: z.uuid().optional(), turnId: z.uuid().optional(), evaluatedAt: z.iso.datetime(), explanation: z.string(),
  findings: z.array(selection.extend({ kind, value: z.union([z.string(), z.number(), z.boolean()]), explanation: z.string() })),
  recommendations: z.array(z.object({ action: assistantActionSchema, evidenceIds: z.array(z.string()), text: z.string() })),
  evidence: z.array(assistantEvidenceSchema).max(6), errors: z.array(z.object({ tool: z.string().optional(), code: z.string(), retryAfterSeconds: z.number().nonnegative().optional() })), limitations: z.array(z.string()),
  pendingToolRequests: z.array(approvedToolInputSchema).max(6),
})
export type AssistantRequest = z.output<typeof assistantRequestSchema>
export type AssistantResponse = z.output<typeof assistantResponseSchema>
export type AssistantEvidence = z.output<typeof assistantEvidenceSchema>
