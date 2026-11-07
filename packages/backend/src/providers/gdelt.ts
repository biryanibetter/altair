import { z } from 'zod'
import { observation, key, type Env, type ProviderJob } from './types'

export function gdeltJob(env: Env): ProviderJob {
  const ttlMs = 900000
  const base = 'https://api.gdeltproject.org/api/v2/doc/doc'
  return {
    id: 'gdelt', ttlMs,
    request: () => ({ url: `${base}?${new URLSearchParams({ query: z.string().min(3).max(300).parse(env.GDELT_QUERY ?? 'Qatar (shipping OR port OR trade)'), mode: 'artlist', format: 'json', maxrecords: '100', timespan: '1d', sort: 'DateDesc' })}` }),
    normalize: (payload, now) => {
      const page = z.object({ articles: z.array(z.object({ url: z.url(), title: z.string().min(1), seendate: z.string().regex(/^\d{8}T\d{6}Z$/), domain: z.string().min(1), language: z.string().min(1), sourcecountry: z.string().nullable().optional() })).max(100) }).parse(payload)
      return { observations: page.articles.map(r => {
        const s = r.seendate
        const at = new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`).toISOString()
        if (!['https:', 'http:'].includes(new URL(r.url).protocol)) throw new Error('unsupported_article_url')
        return observation('gdelt', 'gdelt', base, 'live', at, now, ttlMs, key(r.url), { kind: 'news', title: r.title, url: r.url, domain: r.domain, language: r.language, sourceCountry: r.sourcecountry ?? null, evidenceOnly: true })
      }), nextCursor: 0, coverage: 'matching article metadata; rolling one-day window; max-100; not exhaustive; not verified disruptions' }
    },
  }
}
