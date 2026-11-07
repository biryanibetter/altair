import 'server-only'
import { createRouteHandler, createRoutingAdapters, intelligenceFromRows } from '@altair/backend'
import { createSupabaseServerClient } from '../supabase/server'
import { getAuthenticatedUser } from '../supabase/auth'

const adapters = createRoutingAdapters({ HERE_API_KEY: process.env.HERE_API_KEY, SEAROUTES_API_KEY: process.env.SEAROUTES_API_KEY }, { budgetMs: 10000 })

export const routeCompareHandler = createRouteHandler(async () => {
  const client = await createSupabaseServerClient()
  if (!await getAuthenticatedUser(client)) return null
  let context: ReturnType<typeof intelligenceFromRows> | null = null
  return { async network() {
    const { data, error } = await client.rpc('intelligence_snapshot')
    if (error) throw Error('network_unavailable')
    context = intelligenceFromRows(data, new Date().toISOString())
    return context.network
  }, async risks() { return context?.signals ?? [] }, async enrich(network, result) {
    const ids = [...new Set(result.alternatives.flatMap(r => r.edgeIds))].slice(0, 2)
    return Promise.all(ids.map(async edgeId => {
      const edge = network.edges.find(e => e.id === edgeId)!
      const from = network.nodes.find(n => n.id === edge.originId)?.coordinates, to = network.nodes.find(n => n.id === edge.destinationId)?.coordinates
      if (process.env.ROUTING_ENRICHMENT_ENABLED !== 'true') return { edgeId, status: 'unconfigured' as const, reason: 'provider_calls_disabled' }
      if (!from || !to || edge.mode === 'air') return { edgeId, status: 'unavailable' as const, reason: 'coordinates_or_provider_unavailable' }
      return { edgeId, ...await (edge.mode === 'land' ? adapters.road(from, to) : adapters.sea(from, to)) }
    }))
  } }
})
