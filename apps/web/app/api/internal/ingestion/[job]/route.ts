import 'server-only'
import { createIngestionHandler, createJobs, ingest } from '@altair/backend'
import { createIngestionStore } from '@altair/db'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60
export async function POST(request: Request, context: { params: Promise<{ job: string }> }) {
  return createIngestionHandler({ secret: process.env.INGESTION_SECRET, jobs: createJobs(process.env), run: job => ingest(job, createIngestionStore()) })(request, (await context.params).job)
}
