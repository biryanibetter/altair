import { z } from 'zod'

export const jobSchema = z.enum(['qatar-imports', 'qatar-dependencies', 'comtrade', 'weather', 'marine', 'gdelt', 'opensky', 'here-flow', 'here-incidents', 'aisstream', 'webcams'])
export type JobId = z.infer<typeof jobSchema>
export const natureSchema = z.enum(['live', 'historical', 'estimated', 'simulated'])
const decimal = z.string().regex(/^\d+(?:\.\d+)?$/)
const label = z.string().trim().min(1).max(1000)
export const observationDataSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('trade'), period: label, reporter: label, partner: label.nullable(), hsCode: z.string().regex(/^(?:\d{2,8}|TOTAL)$/), classification: label, description: label.nullable(), flow: z.enum(['import', 'export', 're-export']), value: decimal, currency: z.enum(['QAR', 'USD']), weightKg: decimal.nullable() }),
  z.object({ kind: z.literal('classification'), hsCode: z.string().regex(/^\d{2,8}$/), description: label, classification: label }),
  z.object({ kind: z.literal('dependency'), period: label, reporter: label, partner: label, sharePercent: z.number().finite().min(0).max(100), coverage: z.literal('published-main-countries') }),
  z.object({ kind: z.enum(['weather', 'marine']), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), variable: label, unit: label, value: z.number().finite() }),
  z.object({ kind: z.literal('news'), title: label, url: z.url(), domain: label, language: label, sourceCountry: label.nullable(), evidenceOnly: z.literal(true) }),
  z.object({ kind: z.literal('webcam'), providerId: label, feedUrl: z.url(), available: z.boolean(), freshUntil: z.iso.datetime(), evidenceOnly: z.literal(true) }),
  z.object({ kind: z.enum(['vessel', 'aircraft']), providerId: label, latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), freshUntil: z.iso.datetime(), evidenceOnly: z.literal(true) }),
  z.object({ kind: z.literal('traffic'), providerId: label, latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), status: z.enum(['open', 'congested', 'closed', 'incident']), speedMps: z.number().min(0).nullable(), jamFactor: z.number().min(0).max(10).nullable(), validFrom: z.iso.datetime().nullable().default(null), validUntil: z.iso.datetime().nullable(), freshUntil: z.iso.datetime(), evidenceOnly: z.literal(true) }),
])
export const observationSchema = z.object({
  id: z.uuid().optional(), job: jobSchema, provider: z.enum(['qatar-open-data', 'un-comtrade', 'open-meteo', 'gdelt', 'opensky', 'here', 'aisstream', 'authorized-webcam']),
  recordKey: z.string().min(1).max(128), sourceId: z.uuid(), sourceUrl: z.url(), license: label,
  nature: natureSchema, observedAt: z.iso.datetime(), fetchedAt: z.iso.datetime(), expiresAt: z.iso.datetime(),
  sourceUpdatedAt: z.iso.datetime().nullable(), data: observationDataSchema,
})
export type Observation = z.infer<typeof observationSchema>
export const readQuerySchema = z.object({ job: jobSchema.optional(), limit: z.coerce.number().int().min(1).max(100).default(50), cursor: z.uuid().optional() }).strict()
export const readResponseSchema = z.object({ data: z.array(observationSchema), meta: z.object({ availability: z.enum(['available', 'unavailable']), nextCursor: z.uuid().nullable() }) })
export const runStatusSchema = z.enum(['running', 'success', 'failed', 'unconfigured', 'interrupted'])
export const providerStatusSchema = z.object({
  job: jobSchema, status: z.enum(['never', 'running', 'success', 'failed', 'unconfigured']),
  lastAttemptAt: z.iso.datetime().nullable(), lastSuccessAt: z.iso.datetime().nullable(), expiresAt: z.iso.datetime().nullable(),
  errorCode: z.string().nullable(), nextRetryAt: z.iso.datetime().nullable(), cursor: z.number().int().nonnegative(),
  coverage: z.string(),
  evidenceFreshUntil: z.iso.datetime().nullable().optional(),
  nature: z.union([natureSchema, z.literal('unavailable')]),
  recentRuns: z.array(z.object({ id: z.uuid(), status: runStatusSchema, startedAt: z.iso.datetime(), finishedAt: z.iso.datetime().nullable(), count: z.number().int().nonnegative(), errorCode: z.string().nullable() })).max(5),
})
export type ProviderStatus = z.infer<typeof providerStatusSchema>
export const statusResponseSchema = z.object({ data: z.array(providerStatusSchema) })
export const freshnessResponseSchema = z.object({ data: z.array(z.object({ job: jobSchema, lastSuccessAt: z.iso.datetime().nullable(), expiresAt: z.iso.datetime().nullable(), status: z.enum(['fresh', 'stale', 'unavailable']), nature: z.union([natureSchema, z.literal('unavailable')]) })) })
export function freshnessFor(expiresAt: string | null, now = new Date()): 'fresh' | 'stale' | 'unavailable' {
  return expiresAt === null ? 'unavailable' : new Date(expiresAt).getTime() > now.getTime() ? 'fresh' : 'stale'
}
