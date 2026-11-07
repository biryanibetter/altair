// ALTAIR Backend Assistant - With Demo Mode Support
import 'server-only'
import { assistantReservationSchema, assistantHistorySchema } from '@altair/shared/contracts'
import { createAssistantHandler, AssistantAdmissionError, OpenRouterProvider, createSupplyHandler, createIntelligenceHandler, createRouteHandler, intelligenceFromRows, assistantShipmentSchema, type ToolDispatch, type IntelligenceStore, type SupplyStore, type AssistantStore, type LlmProvider } from '@altair/backend'
import { createSupabaseServerClient } from '../supabase/server'
import { getAuthenticatedUser, isDemoRequest } from '../supabase/auth'
import { authenticatedSupplyStore } from './supply'
import { authenticatedIntelligenceStore } from './scenarios'

const makeRequest = (input: unknown, query = false) => new Request(`http://altair.internal/tool${query ? `?${new URLSearchParams(Object.entries(input as Record<string, unknown>).map(([k,v]) => [k,String(v)]))}` : ''}`, query ? {} : { method: 'POST', body: JSON.stringify(input) })

export const assistantChatHandler = createAssistantHandler(async () => {
  // In demo mode, provide basic demo responses
  if (await isDemoRequest()) {
    return {
      provider: new OpenRouterProvider(process.env),
      signal: AbortSignal.timeout(45000),
      dispatch: async (name: string, input: unknown, toolSignal?: AbortSignal) => {
        toolSignal?.throwIfAborted()
        // Return mock responses for demo mode
        return Response.json({ data: [], message: 'Demo mode: tool not implemented' })
      },
      store: {
        async begin(conversationId: string | undefined, message: string) {
          return { conversationId: 'demo-conversation', turnId: 'demo-turn', history: [] }
        },
        async finish(turnId: string, result: unknown) {},
      },
    }
  }
  
  const signal = AbortSignal.timeout(45000)
  const storageDeadline = AbortSignal.timeout(55000)
  const storageClient = await createSupabaseServerClient((url, init) => globalThis.fetch(url, { ...init, signal: AbortSignal.any([...(init?.signal ? [init.signal] : []), storageDeadline, AbortSignal.timeout(5000)]) })), user = await getAuthenticatedUser(storageClient)
  if (!user) return null
  const client = await createSupabaseServerClient((url, init) => globalThis.fetch(url, { ...init, signal: AbortSignal.any([...(init?.signal ? [init.signal] : []), signal, AbortSignal.timeout(5000)]) }))
  
  const supply = (action: Parameters<typeof createSupplyHandler>[0]) => createSupplyHandler(action, authenticatedSupplyStore)
  const scenario = (action: Parameters<typeof createIntelligenceHandler>[0]) => createIntelligenceHandler(action, authenticatedIntelligenceStore)
  
  const dispatch: ToolDispatch = async (name: string, input: unknown, toolSignal?: AbortSignal) => {
    toolSignal?.throwIfAborted()
    if (name === 'compare_routes') {
      let context: ReturnType<typeof intelligenceFromRows> | null = null
      return createRouteHandler(async () => ({ network: async () => {
        const { data, error } = await client.rpc('intelligence_snapshot')
        if (error) throw Error('network_unavailable')
        context = intelligenceFromRows(data, new Date().toISOString()); return context.network
      }, risks: async () => context?.signals ?? [] }))(makeRequest(input))
    }
    if (name === 'disruption_intelligence') return scenario('risks')(makeRequest(input, true))
    if (name === 'inspect_inventory') return supply('list')(makeRequest(input, true))
    if (name === 'forecast_inventory') return supply('forecast')(makeRequest(input))
    if (name === 'search_suppliers') return supply('suppliers')(makeRequest(input))
    if (name === 'import_dependencies') return supply('dependency')(makeRequest(input))
    if (name === 'create_simulation') return scenario('create')(makeRequest(input))
    if (name === 'run_simulation') return scenario('execute')(new Request('http://altair.internal/tool', { method: 'POST' }), String((input as { id: string }).id))
    if (name === 'compare_simulation') return scenario('compare')(new Request('http://altair.internal/tool'), String((input as { id: string }).id))
    
    const { data, error } = await client.from('shipments').select('id,tracking_number,product_id,supplier_id,origin_id,destination_id,status,estimated_arrival,updated_at,verified_until').eq('owner_id', user.id).eq('id', String((input as { id: string }).id)).maybeSingle()
    if (error) return Response.json({ error: 'service_unavailable' }, { status: 503 })
    if (!data) return Response.json({ error: 'not_found' }, { status: 404 })
    return Response.json(assistantShipmentSchema.parse({ id: data.id, trackingNumber: data.tracking_number, productId: data.product_id, supplierId: data.supplier_id, originId: data.origin_id, destinationId: data.destination_id, status: data.status, estimatedArrival: data.estimated_arrival ? new Date(data.estimated_arrival).toISOString() : null, updatedAt: new Date(data.updated_at).toISOString(), verifiedUntil: data.verified_until ? new Date(data.verified_until).toISOString() : null }))
  }
  
  return { 
    provider: new OpenRouterProvider(process.env), 
    signal, 
    dispatch, 
    store: {
      async begin(conversationId: string | undefined, message: string) {
        const { data, error } = await storageClient.rpc('begin_assistant_turn', { conversation_id: conversationId ?? null, user_message: message })
        if (error) throw new AssistantAdmissionError(error.message === 'assistant_rate_limited' ? 'rate_limited' : error.message === 'assistant_conversation_limit' ? 'conversation_limit' : 'storage_unavailable')
        if (data?.error === 'not_found') throw new AssistantAdmissionError('not_found')
        const reservation = assistantReservationSchema.parse(data)
        const { data: rows, error: historyError } = await storageClient.from('assistant_turns').select('message').eq('owner_id', user.id).eq('conversation_id', reservation.conversationId).neq('id', reservation.turnId).order('created_at', { ascending: false }).limit(4)
        if (historyError) throw new AssistantAdmissionError('storage_unavailable')
        return { ...reservation, history: assistantHistorySchema.parse(rows ?? []).reverse().map(r => r.message) }
      },
      async finish(turnId: string, result: unknown) {
        const { data, error } = await storageClient.rpc('finish_assistant_turn', { turn_id: turnId, result })
        if (error || !data) throw new AssistantAdmissionError('storage_unavailable')
      },
    } 
  }
})