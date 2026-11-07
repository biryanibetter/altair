import { z } from 'zod'
import { ProviderError } from '../transport'
import { key, observation, type ProviderJob } from './types'

const publicUrl = z.url().refine(value => {
  const url = new URL(value)
  return url.protocol === 'https:' && !url.username && !url.password && url.hostname.includes('.') && !/^(?:localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[)/i.test(url.hostname) && !/\.(?:local|internal|localhost)$/i.test(url.hostname)
}, 'public_https_webcam_url_required')
const manifestSchema = z.array(z.object({ id: z.string().min(1).max(200), url: publicUrl, license: z.string().min(1).max(1000), authorization: z.enum(['licensed_public', 'explicitly_authorized']), purpose: z.literal('public_webcam'), authorizationReference: publicUrl }).strict()).max(50)

// Metadata-only boundary for an already authorized collector. It does not fetch,
// scan, authenticate to, proxy or store camera images, CCTV, or arbitrary URLs.
export function createCameraJob(manifest: unknown, receive?: () => Promise<unknown>): ProviderJob {
  const feeds = () => {
    if (!receive) throw new ProviderError('integration_disabled')
    const list = manifestSchema.parse(manifest)
    if (!list.length || new Set(list.map(f => f.id)).size !== list.length) throw new ProviderError('integration_disabled')
    return list
  }
  return { id: 'webcams', ttlMs: 300000,
    request() { return { url: `https://altair.invalid/authorized-webcam-metadata?scope=${key(feeds())}` } },
    collect: async () => { feeds(); return receive!() },
    normalize(payload, now) {
      const approved = feeds()
      const records = z.array(z.object({ providerId: z.string(), observedAt: z.iso.datetime(), available: z.boolean() }).strict()).max(50).parse(payload)
      const observations = records.map(r => {
        const feed = approved.find(f => f.id === r.providerId)
        if (!feed) throw new ProviderError('camera_not_authorized')
        if (Date.parse(r.observedAt) > now.getTime() + 30000) throw new ProviderError('malformed_response')
        const o = observation('webcams', 'authorized-webcam', feed.authorizationReference, 'live', r.observedAt, now, 300000, key(feed.id, r.observedAt), { kind: 'webcam', providerId: feed.id, feedUrl: feed.url, available: r.available, freshUntil: new Date(Date.parse(r.observedAt) + 300000).toISOString(), evidenceOnly: true })
        o.license = feed.license
        return o
      })
      return { observations, nextCursor: 0, coverage: 'reviewed public webcam metadata only; optional; no imagery access or cargo verification' }
    },
  }
}
