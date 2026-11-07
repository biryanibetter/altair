import { createHash } from 'node:crypto'
import { z } from 'zod'
import { coordinatesSchema, geometrySchema, boundedNumber, type Provenance } from '@altair/shared/contracts'
import { fetchJson, type TransportOptions } from '../transport'

type Coordinate = z.infer<typeof coordinatesSchema>
type Estimate = { distanceKm: number; durationHours: number; geometry: z.infer<typeof geometrySchema> | null; provenance: Provenance; parametersHash: string; assumptions: string[] }
export type RoutingEnrichment = { status: 'available'; estimate: Estimate } | { status: 'unconfigured' | 'unavailable'; reason: string }
const sectionSchema = z.object({ summary: z.object({ duration: boundedNumber, length: boundedNumber }), polyline: z.string().max(100000).optional() })
const roadSchema = z.object({ routes: z.array(z.object({ sections: z.array(sectionSchema).min(1).max(100) })).min(1).max(10) })
const seaSchema = z.object({ type: z.literal('FeatureCollection'), features: z.array(z.object({ type: z.literal('Feature'), properties: z.object({ distance: boundedNumber, duration: boundedNumber }), geometry: geometrySchema })).length(1) })

// HERE Flexible Polyline v1, 2D only; unsupported third dimensions are left unavailable.
export function decodePolyline(encoded: string): z.infer<typeof geometrySchema> {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'; let cursor = 0
  function unsigned(): number { let result = 0, shift = 0; while (cursor < encoded.length) { const v = alphabet.indexOf(encoded[cursor++]); if (v < 0 || shift > 45) throw Error('invalid_polyline'); result += (v & 31) * 2 ** shift; if (!(v & 32)) return result; shift += 5 } throw Error('invalid_polyline') }
  if (unsigned() !== 1) throw Error('unsupported_polyline')
  const header = unsigned(), precision = header & 15
  if ((header >> 4) & 7) throw Error('unsupported_dimension')
  let lat = 0, lon = 0; const coordinates: Coordinate[] = []
  const signed = () => { const n = unsigned(); return n % 2 ? -(n + 1) / 2 : n / 2 }
  while (cursor < encoded.length) { lat += signed(); lon += signed(); coordinates.push([lon / 10 ** precision, lat / 10 ** precision]); if (coordinates.length > 20000) throw Error('geometry_too_large') }
  return geometrySchema.parse({ type: 'LineString', coordinates })
}

export function createRoutingAdapters(env: { HERE_API_KEY?: string; SEAROUTES_API_KEY?: string }, transport: TransportOptions = {}, clock = () => new Date().toISOString()) {
  const cache = new Map<string, { expires: number; result: RoutingEnrichment }>()
  async function route(provider: 'here' | 'searoutes', from: Coordinate, to: Coordinate): Promise<RoutingEnrichment> {
    const key = provider === 'here' ? env.HERE_API_KEY : env.SEAROUTES_API_KEY
    if (!key) return { status: 'unconfigured', reason: 'provider_credentials_missing' }
    if (!coordinatesSchema.safeParse(from).success || !coordinatesSchema.safeParse(to).success) return { status: 'unavailable', reason: 'invalid_coordinates' }
    const hash = createHash('sha256').update(JSON.stringify({ provider, from, to, mode: provider === 'here' ? 'truck' : 'sea', version: 1 })).digest('hex')
    const now = clock(), found = cache.get(hash)
    if (found && found.expires > Date.parse(now)) return structuredClone(found.result)
    try {
      let distanceKm: number, durationHours: number, geometry: Estimate['geometry'] = null
      if (provider === 'here') {
        const url = new URL('https://router.hereapi.com/v8/routes')
        url.search = new URLSearchParams({ origin: `${from[1]},${from[0]}`, destination: `${to[1]},${to[0]}`, transportMode: 'truck', return: 'summary,polyline', apiKey: key }).toString()
        const data = roadSchema.parse(await fetchJson(url.toString(), {}, transport)).routes[0]
        distanceKm = data.sections.reduce((s, v) => s + v.summary.length, 0) / 1000
        durationHours = data.sections.reduce((s, v) => s + v.summary.duration, 0) / 3600
        // Avoid joining disconnected section endpoints into invented geometry.
        if (data.sections.length === 1 && data.sections[0].polyline) geometry = decodePolyline(data.sections[0].polyline)
      } else {
        const url = `https://api.searoutes.com/route/v2/sea/${from.join(',')};${to.join(',')}?continuousCoordinates=false`
        const feature = seaSchema.parse(await fetchJson(url, { 'x-api-key': key }, transport)).features[0]
        distanceKm = feature.properties.distance / 1000; durationHours = feature.properties.duration / 3600000; geometry = feature.geometry
      }
      const expires = Date.parse(now) + 3600000
      const result: RoutingEnrichment = { status: 'available', estimate: { distanceKm, durationHours, geometry, parametersHash: hash, provenance: { source: provider === 'here' ? 'HERE Routing v8' : 'Searoutes shortest sea route v2', sourceUrl: provider === 'here' ? 'https://docs.here.com/routing' : 'https://developer.searoutes.com/reference/getsearoute', observedAt: now, expiresAt: new Date(expires).toISOString(), confidence: 0.7, nature: 'estimated' }, assumptions: ['Navigational estimate only, not a freight service, quotation, schedule, delivery commitment or capacity confirmation.', 'Default truck/vessel parameters; shipment-specific restrictions require separately validated connection evidence.'] } }
      if (cache.size >= 100) cache.delete(cache.keys().next().value!)
      cache.set(hash, { expires, result }); return structuredClone(result)
    } catch { return { status: 'unavailable', reason: 'provider_estimate_unavailable' } }
  }
  return { road: (from: Coordinate, to: Coordinate) => route('here', from, to), sea: (from: Coordinate, to: Coordinate) => route('searoutes', from, to) }
}
