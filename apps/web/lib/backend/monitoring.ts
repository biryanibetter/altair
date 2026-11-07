// ALTAIR Backend Monitoring - With Demo Mode Support
import 'server-only'
import { createMonitoringHandler, type MonitoringStore, type MonitoringAction } from '@altair/backend'
import { createSupabaseServerClient } from '../supabase/server'
import { getAuthenticatedUser, isDemoRequest } from '../supabase/auth'

export async function authenticatedMonitoringStore(): Promise<MonitoringStore | null> {
  // In demo mode, return null - frontend will use local demo data
  if (isDemoRequest()) {
    return null
  }
  
  const client = await createSupabaseServerClient()
  const user = await getAuthenticatedUser(client)
  if (!user) return null
  
  return {
    async config() { 
      const { data, error } = await client.from('monitoring_settings').select('config').eq('owner_id', user.id).maybeSingle()
      if (error) throw Error('monitoring_storage_unavailable')
      return data?.config ?? { staleShipmentHours: 48, costIncreasePercent: 20, routeDelayHours: 24, rules: { disrupted_route: { enabled: true, severity: 'high' }, severe_environment: { enabled: true, severity: 'high' }, stale_shipment: { enabled: true, severity: 'medium' }, increased_cost: { enabled: true, severity: 'medium' }, route_delay: { enabled: true, severity: 'medium' }, potential_stockout: { enabled: true, severity: 'high' } }, shipments: [], inventories: [], trafficMappings: [], updatedAt: new Date().toISOString() }
    },
    async configure(config) { 
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { data, error } = await client.from('monitoring_settings').upsert({ owner_id: user.id, config }, { onConflict: 'owner_id' }).select('config').single()
      if (error) throw Error('monitoring_storage_unavailable')
      return config
    },
    async snapshot() { 
      const { data, error } = await client.rpc('monitoring_snapshot')
      if (error) throw Error('monitoring_storage_unavailable')
      return data 
    },
    async reconcile(revision, evaluation) { 
      const { data, error } = await client.rpc('reconcile_monitoring', { expected_revision: revision, evaluated_at: evaluation.evaluatedAt, candidates: evaluation.candidates, evaluated_keys: evaluation.evaluatedKeys })
      if (error) throw Error('monitoring_storage_unavailable')
      if (!data || !Number.isInteger(data.changed)) throw Error('monitoring_storage_invalid')
      return { changed: data.changed as number }
    },
    async alerts(q) {
      let query = client.from('alerts').select('*').eq('owner_id', user.id).order('id').limit(q.limit + 1)
      if (q.cursor) query = query.gt('id', q.cursor)
      if (q.state) query = query.eq('state', q.state)
      const { data, error } = await query
      if (error) throw Error('monitoring_storage_unavailable')
      return (data ?? []).map((await import('@altair/backend')).alertFromRow)
    },
    async transition(id, state) {
      const { data, error } = await client.rpc('transition_alert', { alert_id: id, next_state: state })
      if (error) throw Error('monitoring_storage_unavailable')
      return data ? (await import('@altair/backend')).alertFromRow(data) : null
    },
  }
}
export const monitoringHandler = (action: MonitoringAction) => createMonitoringHandler(action, authenticatedMonitoringStore);