import { freshnessFor, freshnessResponseSchema, providerStatusSchema, readQuerySchema, readResponseSchema, statusResponseSchema, type Observation } from '@altair/shared/contracts'
import type { z } from 'zod'

export interface ObservationQuery { kinds: string[]; job?: string; limit: number; cursor?: string }
export interface Reader { observations(query: ObservationQuery): Promise<unknown[]>; status(): Promise<unknown[]> }
export type Resource = 'trade' | 'weather' | 'status' | 'freshness' | 'transport'
export class QueryError extends Error {}

export async function readResource(resource: Resource, params: URLSearchParams, reader: Reader) {
  if (resource === 'status' || resource === 'freshness') {
    if (params.size) throw new QueryError()
    const statuses = (await reader.status()).map(row => providerStatusSchema.parse(row))
    if (resource === 'status') return statusResponseSchema.parse({ data: statuses })
    return freshnessResponseSchema.parse({ data: statuses.map(s => {
      const effectiveExpiry = s.evidenceFreshUntil && s.expiresAt ? new Date(Math.min(Date.parse(s.evidenceFreshUntil), Date.parse(s.expiresAt))).toISOString() : s.expiresAt
      return { job: s.job, lastSuccessAt: s.lastSuccessAt, expiresAt: effectiveExpiry, nature: s.nature, status: s.nature === 'unavailable' ? 'unavailable' : freshnessFor(effectiveExpiry) }
    }) })
  }
  for (const k of params.keys()) if (params.getAll(k).length > 1) throw new QueryError()
  const parsed = readQuerySchema.safeParse(Object.fromEntries(params))
  if (!parsed.success) throw new QueryError()
  const query: z.infer<typeof readQuerySchema> = parsed.data
  const allowedJobs = resource === 'trade' ? ['qatar-imports', 'qatar-dependencies', 'comtrade'] : resource === 'transport' ? ['opensky', 'here-flow', 'here-incidents', 'aisstream'] : ['weather', 'marine']
  if (query.job && !allowedJobs.includes(query.job)) throw new QueryError()
  const rows = await reader.observations({ ...query, limit: query.limit + 1, kinds: resource === 'trade' ? ['trade', 'dependency', 'classification'] : resource === 'transport' ? ['aircraft', 'vessel', 'traffic'] : ['weather', 'marine'] })
  const data = rows.slice(0, query.limit) as Observation[]
  return readResponseSchema.parse({ data, meta: { availability: data.length ? 'available' : 'unavailable', nextCursor: rows.length > query.limit ? data.at(-1)?.id ?? null : null } })
}

// Explicit mapping between PostgreSQL/PostgREST names and the public API contract.
export function observationFromRow(row: Record<string, unknown>): unknown {
  const iso = (v: unknown) => v === null ? null : new Date(String(v)).toISOString()
  return { id: row.id, job: row.job, provider: row.provider, recordKey: row.record_key, sourceId: row.source_id, sourceUrl: row.source_url, license: row.license, nature: row.nature, observedAt: iso(row.observed_at), fetchedAt: iso(row.fetched_at), expiresAt: iso(row.expires_at), sourceUpdatedAt: iso(row.source_updated_at), data: row.data }
}
