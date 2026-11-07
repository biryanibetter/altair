import type { IngestionStore } from '@altair/db'
import { ZodError } from 'zod'
import { fetchJson, ProviderError, type TransportOptions } from './transport'
import type { ProviderJob } from './providers'
import { key } from './providers/types'

export interface IngestionResult { job: string; status: 'success' | 'cached' | 'busy' | 'deferred' | 'failed' | 'unconfigured'; count: number; runId?: string; errorCode?: string }
export async function ingest(job: ProviderJob, store: IngestionStore, options: TransportOptions = {}): Promise<IngestionResult> {
  let scope = 'unconfigured'
  try { scope = key(job.request(0).url) } catch { /* Claim and record configuration errors normally. */ }
  const claim = await store.claim(job.id, scope)
  if (claim.status !== 'claimed') return { job: job.id, status: claim.status, count: 0 }
  let stage: 'config' | 'fetch' | 'normalize' | 'store' = 'config'
  try {
    const request = job.request(claim.cursor)
    stage = 'fetch'
    const payload = job.collect ? await job.collect() : await fetchJson(request.url, request.headers, options)
    stage = 'normalize'
    const batch = job.normalize(payload, new Date(), claim.cursor)
    stage = 'store'
    await store.complete(job.id, claim.runId, batch, batch.nextCursor > 0 ? Math.min(job.ttlMs, 60000) : job.ttlMs)
    return { job: job.id, status: 'success', count: new Set(batch.observations.map(o => o.recordKey)).size, runId: claim.runId }
  } catch (error) {
    const code = error instanceof ProviderError ? error.code : stage === 'config' && error instanceof ZodError ? 'invalid_configuration' : stage === 'store' ? 'persistence_failed' : 'malformed_response'
    const unconfigured = ['missing_credentials', 'invalid_configuration', 'query_partition_required', 'integration_disabled', 'runtime_unsupported'].includes(code)
    await store.fail(job.id, claim.runId, code, error instanceof ProviderError ? Math.max(1000, error.retryAfterMs) : 60000, unconfigured)
    return { job: job.id, status: unconfigured ? 'unconfigured' : 'failed', count: 0, runId: claim.runId, errorCode: code }
  }
}
