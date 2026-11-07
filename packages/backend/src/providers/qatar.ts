import { z } from 'zod'
import { ProviderError } from '../transport'
import { tradeDecimal } from '../decimal'
import { key, observation, type Env, type ProviderJob } from './types'

const num = z.number().finite().nonnegative()
const importsRow = z.object({ lsn_year: z.union([z.string().regex(/^\d{4}$/), z.iso.datetime({ offset: true })]).transform(s => s.slice(0, 4)), lshhr_month: z.number().int().min(1).max(12), hs8: z.string().regex(/^\d{8}$/), details: z.string().min(1), country_of_origin: z.string().min(1).nullable(), value_qr: tradeDecimal, weight_kg: tradeDecimal.nullable() })
const dependenciesRow = z.object({ year: z.string().regex(/^\d{4}$/), quarter: z.string().regex(/^Q[1-4]$/), country: z.string().min(1), percentage: num.max(100) })
export function qatarJob(id: 'qatar-imports' | 'qatar-dependencies', env: Env): ProviderJob {
  const dataset = id === 'qatar-imports' ? 'qatar-imports-2019-2024-copy' : 'total-imports-by-main-country-of-origin-q4-2023'
  const base = `https://www.data.gov.qa/api/explore/v2.1/catalog/datasets/${dataset}/records`
  const ttlMs = 86400000
  return {
    id, ttlMs,
    request: cursor => {
      if (cursor >= 10000) throw new ProviderError('query_partition_required')
      const p = new URLSearchParams({ limit: '100', offset: String(cursor) })
      if (id === 'qatar-imports') {
        const year = z.string().regex(/^20\d{2}$/).parse(env.QATAR_TRADE_YEAR ?? '2024')
        const prefix = z.string().regex(/^\d{2,8}$/).parse(env.QATAR_HS_PREFIX ?? '10')
        // Group upstream to a natural monthly grain; do not let duplicate customs rows overwrite each other.
        p.set('select', 'lsn_year,lshhr_month,hs8,details,country_of_origin,sum(value_qr) as value_qr,sum(weight_kg) as weight_kg')
        p.set('group_by', 'lsn_year,lshhr_month,hs8,details,country_of_origin')
        p.set('where', `lsn_year = date'${year}-01-01' and startswith(hs8, "${prefix}")`)
        p.set('order_by', 'lsn_year,lshhr_month,hs8,country_of_origin,details')
      } else p.set('order_by', 'year,quarter,country')
      return { url: `${base}?${p}` }
    },
    normalize: (payload, now, cursor = 0) => {
      const page = z.object({ total_count: z.number().int().nonnegative(), results: z.array(z.unknown()).max(100) }).parse(payload)
      if (page.total_count > cursor && !page.results.length) throw new Error('incomplete_page')
      const next = cursor + page.results.length
      // Explore offsets have a 10,000-record ceiling: never claim an unbounded complete import history.
      // ODS grouped responses report the page count, not the number of all groups.
      const hasMore = id === 'qatar-imports' ? page.results.length === 100 : next < page.total_count
      const nextCursor = hasMore ? next : 0
      const coverage = `${dataset}; year=${env.QATAR_TRADE_YEAR ?? '2024'}; hs-prefix=${env.QATAR_HS_PREFIX ?? '10'}; page-offset=${cursor}; returned=${page.results.length}; ${hasMore ? 'partial' : 'query-complete'}${next >= 10000 && hasMore ? '; narrower-query-required' : ''}`
      const observations = page.results.flatMap(row => {
        if (id === 'qatar-dependencies') {
          const r = dependenciesRow.parse(row)
          const period = `${r.year}-${r.quarter}`
          return [observation(id, 'qatar-open-data', base, 'historical', `${r.year}-${String((Number(r.quarter[1]) - 1) * 3 + 1).padStart(2, '0')}-01T00:00:00.000Z`, now, ttlMs, key(dataset, period, r.country), { kind: 'dependency', period, reporter: 'Qatar', partner: r.country, sharePercent: r.percentage, coverage: 'published-main-countries' })]
        }
        const r = importsRow.parse(row)
        const period = `${r.lsn_year}-${String(r.lshhr_month).padStart(2, '0')}`
        const at = `${period}-01T00:00:00.000Z`
        return [
          observation(id, 'qatar-open-data', base, 'historical', at, now, ttlMs, key(dataset, period, r.hs8, r.country_of_origin, r.details), { kind: 'trade', period, reporter: 'Qatar', partner: r.country_of_origin, hsCode: r.hs8, classification: 'Qatar HS8 (edition unspecified)', description: r.details, flow: 'import', value: String(r.value_qr), currency: 'QAR', weightKg: r.weight_kg === null ? null : String(r.weight_kg) }),
          observation(id, 'qatar-open-data', base, 'historical', at, now, ttlMs, key(dataset, 'classification', r.hs8, r.details), { kind: 'classification', hsCode: r.hs8, description: r.details, classification: 'Qatar HS8 (edition unspecified)' }),
        ]
      })
      return { observations, nextCursor, coverage }
    },
  }
}
