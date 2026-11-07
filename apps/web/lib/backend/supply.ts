// ALTAIR Backend Supply - With Demo Mode Support
import 'server-only'
import { createSupplyHandler, type SupplyStore, type SupplyAction } from '@altair/backend'
import { createSupabaseServerClient } from '../supabase/server'
import { getAuthenticatedUser, isDemoRequest } from '../supabase/auth'

export async function authenticatedSupplyStore(): Promise<SupplyStore | null> {
  // In demo mode, return null - frontend will use local demo data
  if (await isDemoRequest()) {
    return null
  }
  
  const client = await createSupabaseServerClient()
  const user = await getAuthenticatedUser(client)
  if (!user) return null
  
  return {
    async list(q) { return [] },
    async write(action, input, id) { return null },
    async snapshot(id) { return null },
    async scenario(id) { return null },
    async suppliers() { return [] },
    async trade(filters) { return [] },
    async intelligence() { return { network: { version: 1, nodes: [], edges: [] }, signals: [], coverage: { unmappedObservations: 0, legacySignals: 0, rules: [] } } },
  }
}
export const supplyHandler = (action: SupplyAction) => createSupplyHandler(action, authenticatedSupplyStore)