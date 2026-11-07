import { z } from 'zod'
import { ProviderError } from '../transport'
import { enabled, transportBox } from './transport-network'
import { key, observation, type Env, type ProviderJob } from './types'

export interface AisSocket extends EventTarget { send(data: string): void; close(): void; binaryType?: string }
// Bounded collector for explicitly authorized Node workers only. No socket survives a call.
export async function collectAisWindow(subscription: unknown, options: { connect?: () => AisSocket; durationMs?: number; sleep?: (ms: number) => Promise<void>; random?: () => number } = {}): Promise<unknown[]> {
  const frames: unknown[] = [], deadline = Date.now() + (options.durationMs ?? 10000)
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)))
  let opened = false, connectedAtEnd = false
  for (let attempt = 0; attempt < 3 && Date.now() < deadline; attempt++) {
    if (attempt) {
      const wait = 1000 * 2 ** (attempt - 1) + Math.floor((options.random ?? Math.random)() * 250)
      if (!options.sleep && Date.now() + wait >= deadline) break
      await sleep(wait)
    }
    await new Promise<void>((resolve, reject) => {
      const socket = (options.connect ?? (() => new WebSocket('wss://stream.aisstream.io/v0/stream')))()
      socket.binaryType = 'arraybuffer'
      let finished = false, bytes = 0, connected = false
      const timer = setTimeout(() => finish(), Math.max(1, deadline - Date.now()))
      const finish = (error?: Error) => {
        if (finished) return
        finished = true; clearTimeout(timer)
        connectedAtEnd = connected
        for (const [name, listener] of listeners) socket.removeEventListener(name, listener)
        socket.close()
        if (error) reject(error); else resolve()
      }
      const listeners: [string, EventListener][] = [
        ['open', () => { opened = connected = true; socket.send(JSON.stringify(subscription)) }],
        ['message', event => {
          try {
            const data: unknown = (event as MessageEvent).data
            const text = typeof data === 'string' ? data : data instanceof ArrayBuffer ? Buffer.from(data).toString('utf8') : null
            if (text === null) throw new ProviderError('malformed_response')
            bytes += Buffer.byteLength(text)
            if (bytes > 2_000_000) throw new ProviderError('response_too_large')
            const payload = JSON.parse(text) as Record<string, unknown>
            if (payload.error || payload.Error) throw new ProviderError('provider_rejected')
            frames.push(payload)
            if (frames.length >= 500) finish()
          } catch (error) { finish(error instanceof ProviderError ? error : new ProviderError('malformed_response')) }
        }],
        ['error', () => { connected = false; finish() }],
        ['close', () => { connected = false; finish() }],
      ]
      for (const [name, listener] of listeners) socket.addEventListener(name, listener)
    })
    if (frames.length >= 500 || connectedAtEnd) break
  }
  if (!opened || (!frames.length && !connectedAtEnd)) throw new ProviderError('provider_unavailable')
  return frames
}

export function aisstreamJob(env: Env): ProviderJob {
  const ttl = 120000
  const subscription = () => {
    enabled(env.AISSTREAM_ENABLED)
    if (env.VERCEL || env.AISSTREAM_RUNTIME !== 'worker') throw new ProviderError('runtime_unsupported')
    if (!env.AISSTREAM_API_KEY) throw new ProviderError('missing_credentials')
    const [west, south, east, north] = transportBox(env)
    return { APIKey: env.AISSTREAM_API_KEY, BoundingBoxes: [[[south, west], [north, east]]], FilterMessageTypes: ['PositionReport'] }
  }
  return { id: 'aisstream', ttlMs: 30000,
    request() { const s = subscription(); return { url: `wss://stream.aisstream.io/v0/stream?scope=${key(s.BoundingBoxes)}` } },
    collect: () => collectAisWindow(subscription()),
    normalize(payload, now) {
      const observations = z.array(z.record(z.string(), z.unknown())).max(500).parse(payload).flatMap(raw => {
        if (raw.MessageType === 'SubscriptionConfirmation') return []
        const p = z.object({ MessageType: z.literal('PositionReport'), MetaData: z.object({ MMSI: z.number().int(), time_utc: z.string().min(1) }), Message: z.object({ PositionReport: z.object({ Valid: z.boolean(), UserID: z.number().int(), Latitude: z.number(), Longitude: z.number() }) }) }).parse(raw)
        const d = p.Message.PositionReport
        if (!d.Valid || Math.abs(d.Latitude) > 90 || Math.abs(d.Longitude) > 180) return []
        const providerId = z.string().regex(/^\d{9}$/).parse(String(d.UserID))
        if (p.MetaData.MMSI !== d.UserID) throw new ProviderError('malformed_response')
        const timestamp = p.MetaData.time_utc.replace(/ \+0000 UTC$/, 'Z').replace(' ', 'T')
        const time = Date.parse(timestamp)
        if (!Number.isFinite(time) || time > now.getTime() + 30000) throw new ProviderError('malformed_response')
        const observedAt = new Date(time).toISOString()
        return [observation('aisstream', 'aisstream', 'https://aisstream.io', 'live', observedAt, now, ttl, key(providerId, observedAt), { kind: 'vessel', providerId, latitude: d.Latitude, longitude: d.Longitude, freshUntil: new Date(time + ttl).toISOString(), evidenceOnly: true })]
      })
      return { observations, nextCursor: 0, coverage: 'bounded AIS worker window; no durable replay; vessel broadcasts are not cargo location' }
    },
  }
}
