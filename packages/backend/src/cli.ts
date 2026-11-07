import { config } from 'dotenv'
import { jobSchema } from '@altair/shared/contracts'
import { createIngestionStore, closeDatabase } from '@altair/db'
import { createJobs } from './providers'
import { ingest } from './ingestion'

config({ path: '../../.env.local', quiet: true })
const parsed = jobSchema.safeParse(process.argv[2])
if (!parsed.success) {
  console.error(`Usage: pnpm --filter @altair/backend ingest <${jobSchema.options.join('|')}>`)
  process.exitCode = 1
} else {
  try {
    const result = await ingest(createJobs(process.env)[parsed.data], createIngestionStore())
    console.log(JSON.stringify(result))
    process.exitCode = ['success', 'cached'].includes(result.status) ? 0 : 1
  } catch {
    console.error(JSON.stringify({ error: 'ingestion_unavailable', hint: 'Check DATABASE_URL and apply reviewed migrations to the authorized target.' }))
    process.exitCode = 1
  } finally { await closeDatabase() }
}
// No long-running worker or polling loop.
