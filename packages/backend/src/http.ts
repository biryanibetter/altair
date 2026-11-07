import { timingSafeEqual } from 'node:crypto'
import { jobSchema } from '@altair/shared/contracts'
import { readResource, QueryError, type Reader, type Resource } from './read'
import type { IngestionResult } from './ingestion'
import type { ProviderJob } from './providers'

const headers = { 'Cache-Control': 'no-store' }
const response = (value: unknown, status = 200) => Response.json(value, { status, headers })
export function createReadHandler(resource: Resource, authorize: () => Promise<Reader | null>) {
  return async (request: Request): Promise<Response> => {
    try {
      const reader = await authorize()
      if (!reader) return response({ error: 'unauthorized' }, 401)
      return response(await readResource(resource, new URL(request.url).searchParams, reader))
    } catch (error) {
      return response({ error: error instanceof QueryError ? 'invalid_query' : 'service_unavailable' }, error instanceof QueryError ? 400 : 503)
    }
  }
}

export function createIngestionHandler(options: { secret: string | undefined; jobs: Record<string, ProviderJob>; run: (job: ProviderJob) => Promise<IngestionResult> }) {
  return async (request: Request, jobId: string): Promise<Response> => {
    if (!options.secret || Buffer.byteLength(options.secret) < 32) return response({ error: 'scheduler_unconfigured' }, 503)
    const supplied = request.headers.get('Authorization') ?? ''
    const expected = `Bearer ${options.secret}`
    if (Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return response({ error: 'unauthorized' }, 401)
    if (!jobSchema.safeParse(jobId).success || !options.jobs[jobId]) return response({ error: 'unknown_job' }, 404)
    try {
      const result = await options.run(options.jobs[jobId])
      const status = result.status === 'busy' ? 409 : result.status === 'deferred' ? 429 : ['failed', 'unconfigured'].includes(result.status) ? 503 : 200
      return response(result, status)
    } catch { return response({ error: 'ingestion_unavailable' }, 503) }
  }
}
