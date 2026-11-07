// ALTAIR Backend Read - With Demo Mode Support
import 'server-only'
import { createReadHandler, type Reader, type Resource } from '@altair/backend'
import { createSupabaseServerClient } from '../supabase/server'
import { getAuthenticatedUser, isDemoRequest } from '../supabase/auth'

export async function authenticatedReader(): Promise<Reader | null> {
  // In demo mode, return null - components will use local demo data
  if (isDemoRequest()) {
    return null
  }
  
  const client = await createSupabaseServerClient()
  if (!await getAuthenticatedUser(client)) return null
  return {
    async observations({ kinds, job, limit, cursor }) {
      let query = client.from('provider_observations').select('*').in('kind', kinds).order('id').limit(limit)
      if (job) query = query.eq('job', job)
      if (cursor) query = query.gt('id', cursor)
      const { data, error } = await query
      if (error) throw new Error('read_failed')
      return (data ?? []).map((await import('@altair/backend')).observationFromRow)
    },
    async status() {
      const { data, error } = await client.rpc('ingestion_status')
      if (error) throw new Error('status_failed')
      return data ?? []
    },
  }
}
export const readHandler = (resource: Resource) => createReadHandler(resource, authenticatedReader)