import { ZodError } from 'zod'
import { routeRequestSchema, routeComparisonSchema, type Network, type RouteComparison, type RiskSignal } from '@altair/shared/contracts'
import { compareRoutes } from './engine'

export class InputError extends Error {}
export const jsonResponse = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } })
export async function readJsonBody(request: Request, limit = 65536, allowEmpty = false): Promise<unknown> {
  const reader = request.body?.getReader(); if (!reader) { if (allowEmpty) return null; throw new InputError('invalid_body') }
  const chunks: Uint8Array[] = []; let size = 0
  try {
    while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength; if (size > limit) throw new InputError('invalid_body'); chunks.push(chunk.value) }
    if (allowEmpty && size === 0) return null
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown } catch { throw new InputError('invalid_body') }
  } finally { await reader.cancel().catch(() => {}) }
}
export type RouteReader = { network(): Promise<Network>; risks?(): Promise<RiskSignal[]>; enrich?(network: Network, result: RouteComparison): Promise<NonNullable<RouteComparison['providerEstimates']>> }
export function createRouteHandler(authorize: () => Promise<RouteReader | null>, clock = () => new Date().toISOString()) {
  return async (request: Request): Promise<Response> => {
    try {
      const reader = await authorize(); if (!reader) return jsonResponse({ error: 'unauthorized' }, 401)
      let input
      try { input = routeRequestSchema.parse(await readJsonBody(request)) } catch (e) { if (e instanceof ZodError || e instanceof InputError) return jsonResponse({ error: 'invalid_request' }, 400); throw e }
      const network = await reader.network()
      if (![input.originId, input.destinationId].every(id => network.nodes.some(n => n.id === id))) return jsonResponse({ error: 'unknown_location' }, 400)
      const result = compareRoutes(network, input, clock(), reader.risks ? await reader.risks() : [])
      if (input.preferences.enrichGeometry && reader.enrich) result.providerEstimates = await reader.enrich(network, result)
      return jsonResponse(routeComparisonSchema.parse(result))
    } catch { return jsonResponse({ error: 'service_unavailable' }, 503) }
  }
}
