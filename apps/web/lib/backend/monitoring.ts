import 'server-only'
import { createMonitoringHandler, monitoringFromRows, alertFromRow, MonitoringConflict, InputError, type MonitoringStore, type MonitoringAction } from '@altair/backend'
import { monitoringConfigSchema } from '@altair/shared/contracts'
import { createSupabaseServerClient } from '../supabase/server'
import { getAuthenticatedUser } from '../supabase/auth'

function failure(error: { message?: string; code?: string }): never {
  if (error.message?.includes('monitoring_configuration_changed') || error.message?.includes('monitoring_evaluation_superseded')) throw new MonitoringConflict()
  if (['23503', '23514', '22P02', 'P0001'].includes(error.code ?? '')) throw new InputError('invalid_monitoring_configuration')
  throw Error('monitoring_storage_unavailable')
}
export async function authenticatedMonitoringStore(): Promise<MonitoringStore | null> {
  const client = await createSupabaseServerClient(), user = await getAuthenticatedUser(client)
  if (!user) return null
  return {
    async config() {
      const { data, error } = await client.from('monitoring_settings').select('config').eq('owner_id', user.id).maybeSingle()
      if (error) failure(error)
      return monitoringConfigSchema.parse(data?.config ?? {})
    },
    async configure(config) {
      const { data, error } = await client.from('monitoring_settings').upsert({ owner_id: user.id, config }, { onConflict: 'owner_id' }).select('config').single()
      if (error) failure(error)
      return monitoringConfigSchema.parse(data.config)
    },
    async snapshot() {
      const { data, error } = await client.rpc('monitoring_snapshot')
      if (error) failure(error)
      return monitoringFromRows(data)
    },
    async reconcile(revision, evaluation) {
      const { data, error } = await client.rpc('reconcile_monitoring', { expected_revision: revision, evaluated_at: evaluation.evaluatedAt, candidates: evaluation.candidates, evaluated_keys: evaluation.evaluatedKeys })
      if (error) failure(error)
      if (!data || !Number.isInteger(data.changed)) throw Error('monitoring_storage_invalid')
      return { changed: data.changed as number }
    },
    async alerts(q) {
      let query = client.from('alerts').select('*').eq('owner_id', user.id).order('id').limit(q.limit + 1)
      if (q.cursor) query = query.gt('id', q.cursor)
      if (q.state) query = query.eq('state', q.state)
      const { data, error } = await query
      if (error) failure(error)
      return (data ?? []).map(alertFromRow)
    },
    async transition(id, state) {
      const { data, error } = await client.rpc('transition_alert', { alert_id: id, next_state: state })
      if (error) failure(error)
      return data ? alertFromRow(data) : null
    },
  }
}
export const monitoringHandler = (action: MonitoringAction) => createMonitoringHandler(action, authenticatedMonitoringStore)
