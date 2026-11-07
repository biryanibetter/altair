import { z } from 'zod'
import { ProviderError } from '../transport'
import { tradeDecimal } from '../decimal'
import { key, observation, type Env, type ProviderJob } from './types'

const rowSchema = z.object({ period: z.string().regex(/^\d{4}$/), reporterCode: z.number().int().nonnegative(), partnerCode: z.number().int().nonnegative(), cmdCode: z.string().regex(/^(?:\d{2,6}|TOTAL)$/), cmdDesc: z.string().nullable(), flowCode: z.enum(['M', 'X', 'RX']), primaryValue: tradeDecimal, netWgt: tradeDecimal.nullable(), classificationCode: z.string().optional(), isNetWgtEstimated: z.boolean().optional() })
export function comtradeJob(env: Env): ProviderJob {
  const ttlMs = 86400000
  const base = 'https://comtradeapi.un.org'
  return {
    id: 'comtrade', ttlMs,
    request: () => {
      const subscription = env.COMTRADE_MODE === 'subscription'
      if (subscription && !env.COMTRADE_API_KEY) throw new ProviderError('missing_credentials')
      const p = z.object({ period: z.string().regex(/^20\d{2}$/), reporterCode: z.string().regex(/^\d{1,3}$/), cmdCode: z.string().regex(/^(?:\d{2,6}|TOTAL)$/) }).parse({ period: env.COMTRADE_PERIOD ?? '2024', reporterCode: env.COMTRADE_REPORTER ?? '634', cmdCode: env.COMTRADE_HS_CODE ?? '10' })
      const params = new URLSearchParams({ ...p, flowCode: 'M', partnerCode: '0', partner2Code: '0', customsCode: 'C00', motCode: '0', maxRecords: '100' })
      return { url: `${base}/${subscription ? 'data/v1/get' : 'public/v1/preview'}/C/A/HS?${params}`, headers: subscription ? { 'Ocp-Apim-Subscription-Key': env.COMTRADE_API_KEY! } : undefined }
    },
    normalize: (payload, now) => {
      const page = z.object({ data: z.array(rowSchema).max(100), error: z.string().optional() }).parse(payload)
      if (page.error) throw new ProviderError('provider_rejected')
      return { observations: page.data.map(r => observation('comtrade', 'un-comtrade', 'https://comtradeplus.un.org', r.isNetWgtEstimated ? 'estimated' : 'historical', `${r.period}-01-01T00:00:00.000Z`, now, ttlMs, key(r.period, r.reporterCode, r.partnerCode, r.cmdCode, r.flowCode, r.classificationCode), { kind: 'trade', period: r.period, reporter: String(r.reporterCode), partner: String(r.partnerCode), hsCode: r.cmdCode, classification: r.classificationCode ?? 'HS (provider edition)', description: r.cmdDesc, flow: r.flowCode === 'M' ? 'import' : r.flowCode === 'X' ? 'export' : 're-export', value: String(r.primaryValue), currency: 'USD', weightKg: r.netWgt === null ? null : String(r.netWgt) })), nextCursor: 0, coverage: `${env.COMTRADE_MODE === 'subscription' ? 'subscription' : 'public-preview'}; configured annual reporter/commodity; max-100; ${page.data.length === 100 ? 'potentially-truncated' : 'bounded-query'}` }
    },
  }
}
