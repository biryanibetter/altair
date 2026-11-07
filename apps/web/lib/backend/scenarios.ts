import 'server-only'
import { createIntelligenceHandler, intelligenceFromRows, scenarioFromRow, InputError, type IntelligenceStore } from '@altair/backend'
import { createSupabaseServerClient } from '../supabase/server'
import { getAuthenticatedUser } from '../supabase/auth'

export async function authenticatedIntelligenceStore(context?: { client: Awaited<ReturnType<typeof createSupabaseServerClient>>; user: { id: string } }): Promise<IntelligenceStore | null> {
  const client = context?.client ?? await createSupabaseServerClient(), user = context?.user ?? await getAuthenticatedUser(client)
  if (!user) return null
  return {
    async create(input, version) {
      const { data, error } = await client.rpc('create_simulation', { input, version })
      if (error) {
        if (error.code === 'P0001' && error.message === 'invalid_scenario_targets') throw new InputError('invalid_request')
        throw Error('snapshot_unavailable')
      }
      return scenarioFromRow(data)
    },
    async get(id) {
      const { data, error } = await client.from('scenarios').select('*').eq('owner_id', user.id).eq('id', id).not('simulation_input', 'is', null).maybeSingle()
      if (error) throw Error('scenario_unavailable')
      return data ? scenarioFromRow(data) : null
    },
    async save(id, output) {
      const { data, error } = await client.rpc('finish_simulation', { scenario_id: id, output })
      if (error) throw Error('execution_unavailable')
      return data ? scenarioFromRow(data) : null
    },
    async list(limit, cursor) {
      const { data, error } = await client.rpc('list_simulations', { page_limit: limit, after_id: cursor ?? null })
      if (error) throw Error('scenarios_unavailable')
      return (data ?? []).map((r: { id: string; name: string; created_at: string; engine_version: string; executed: boolean }) => ({ id: r.id, name: r.name, createdAt: new Date(r.created_at).toISOString(), engineVersion: r.engine_version, executed: r.executed }))
    },
    async intelligence() {
      const { data, error } = await client.rpc('intelligence_snapshot')
      if (error) throw Error('intelligence_unavailable')
      return intelligenceFromRows(data, new Date().toISOString())
    },
  }
}
export const scenarioHandler = (action: Parameters<typeof createIntelligenceHandler>[0]) => createIntelligenceHandler(action, authenticatedIntelligenceStore)
