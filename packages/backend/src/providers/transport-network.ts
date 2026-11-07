import { z } from 'zod'
import { ProviderError } from '../transport'
import { key, observation, type Env, type ProviderJob } from './types'

const coordinate = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
export function transportBox(env: Env) {
  const box = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90), z.number().min(-180).max(180), z.number().min(-90).max(90)]).parse(env.TRANSPORT_BBOX?.split(',').map(Number))
  if (box[0] >= box[2] || box[1] >= box[3]) throw new ProviderError('invalid_configuration')
  return box
}
export function enabled(value: string | undefined) { if (value !== 'true') throw new ProviderError('integration_disabled') }
function eventTime(seconds: number, now: Date) {
  if (seconds * 1000 > now.getTime() + 30000) throw new ProviderError('malformed_response')
  return new Date(seconds * 1000).toISOString()
}
export function openskyJob(env: Env): ProviderJob {
  const ttl = 120000
  return { id: 'opensky', ttlMs: ttl,
    request() {
      enabled(env.OPENSKY_ENABLED)
      const [west, south, east, north] = transportBox(env)
      const url = new URL('https://opensky-network.org/api/states/all')
      for (const [k, v] of Object.entries({ lamin: south, lomin: west, lamax: north, lomax: east })) url.searchParams.set(k, String(v))
      // Anonymous current-state access is supported. An externally maintained OAuth token is optional.
      return { url: url.href, headers: env.OPENSKY_ACCESS_TOKEN ? { Authorization: `Bearer ${env.OPENSKY_ACCESS_TOKEN}` } : undefined }
    },
    normalize(payload, now) {
      const p = z.object({ time: z.number().int().positive(), states: z.array(z.array(z.unknown()).min(17)).max(5000).nullable() }).parse(payload)
      eventTime(p.time, now)
      const observations = (p.states ?? []).flatMap(row => {
        const providerId = z.string().regex(/^[a-f0-9]{6}$/).parse(row[0])
        if (row[3] === null || row[5] === null || row[6] === null) return []
        const observedAt = eventTime(z.number().int().positive().parse(row[3]), now)
        const longitude = z.number().min(-180).max(180).parse(row[5]), latitude = z.number().min(-90).max(90).parse(row[6])
        return [observation('opensky', 'opensky', 'https://opensky-network.org/api/states/all', 'live', observedAt, now, ttl, key(providerId, observedAt), { kind: 'aircraft', providerId, longitude, latitude, freshUntil: new Date(Date.parse(observedAt) + ttl).toISOString(), evidenceOnly: true })]
      })
      return { observations, nextCursor: 0, coverage: 'configured-bounding-box; aircraft positions only; not cargo location' }
    },
  }
}

export function hereTrafficJob(kind: 'flow' | 'incidents', env: Env): ProviderJob {
  const id = kind === 'flow' ? 'here-flow' : 'here-incidents', ttl = 300000
  const sourceUrl = `https://data.traffic.hereapi.com/v7/${kind}`
  const location = z.object({ shape: z.object({ links: z.array(z.object({ points: z.array(coordinate).min(1).max(20000) })).min(1).max(1000) }) })
  return { id, ttlMs: ttl,
    request() {
      enabled(env.HERE_TRAFFIC_ENABLED)
      if (!env.HERE_API_KEY) throw new ProviderError('missing_credentials')
      const url = new URL(sourceUrl)
      url.searchParams.set('in', `bbox:${transportBox(env).join(',')}`)
      url.searchParams.set('locationReferencing', 'shape')
      url.searchParams.set('apiKey', env.HERE_API_KEY)
      return { url: url.href }
    },
    normalize(payload, now) {
      const p = z.object({ sourceUpdated: z.iso.datetime({ offset: true }), results: z.array(z.object({ location, currentFlow: z.unknown().optional(), incidentDetails: z.unknown().optional() })).max(2000) }).parse(payload)
      const observedAt = new Date(p.sourceUpdated).toISOString()
      if (Date.parse(observedAt) > now.getTime() + 30000) throw new ProviderError('malformed_response')
      const observations = p.results.map(r => {
        const point = r.location.shape.links[0]!.points[0]!
        const flow = kind === 'flow' ? z.object({ speed: z.number().min(0).optional(), jamFactor: z.number().min(0).max(10), confidence: z.number().min(0).max(1).optional(), traversability: z.enum(['open', 'closed', 'reversible', 'unknown']).optional() }).parse(r.currentFlow) : null
        const incident = kind === 'incidents' ? z.object({ id: z.string().min(1).max(1000), originalId: z.string().min(1).max(1000).optional(), roadClosed: z.boolean().optional(), startTime: z.iso.datetime({ offset: true }).optional(), endTime: z.iso.datetime({ offset: true }).optional() }).parse(r.incidentDetails) : null
        const providerId = incident?.originalId ?? incident?.id ?? key(r.location.shape)
        return observation(id, 'here', sourceUrl, incident || (flow?.confidence ?? 0) > 0.7 ? 'live' : 'estimated', observedAt, now, ttl, key(providerId, observedAt), { kind: 'traffic', providerId, latitude: point.lat, longitude: point.lng, status: incident ? incident.roadClosed ? 'closed' : 'incident' : flow?.traversability === 'closed' || flow?.jamFactor === 10 ? 'closed' : flow!.jamFactor >= 8 ? 'congested' : 'open', speedMps: flow?.speed ?? null, jamFactor: flow?.jamFactor ?? null, validFrom: incident?.startTime ? new Date(incident.startTime).toISOString() : null, validUntil: incident?.endTime ? new Date(incident.endTime).toISOString() : null, freshUntil: new Date(Date.parse(observedAt) + ttl).toISOString(), evidenceOnly: true })
      })
      return { observations, nextCursor: 0, coverage: 'configured-bounding-box; HERE road evidence; explicit route mapping required' }
    },
  }
}
