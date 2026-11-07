import { checkDatabaseConnection } from '@altair/db'

// Supabase PostgREST is the web app's actual data plane; direct SQL is used by ingestion.
// Probe REST first so a placeholder DATABASE_URL does not report a healthy project as down.
export async function checkStorageConnection(): Promise<void> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (url && key) {
    const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/data_sources?select=id`, {
      method: 'HEAD',
      headers: { apikey: key, authorization: `Bearer ${key}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (response.ok) return
  }
  await checkDatabaseConnection()
}
