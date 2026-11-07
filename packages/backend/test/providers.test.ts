import { describe, expect, it } from 'vitest'
import { createJobs } from '../src/providers'
import { fetchJson, ProviderError } from '../src/transport'

// All payloads in this file are synthetic test fixtures, not real observations.
const at = new Date('2026-11-06T12:00:00Z')
const weather = { latitude: 25.3, longitude: 51.5, hourly_units: { temperature_2m: '°C', wind_speed_10m: 'km/h', precipitation: 'mm' }, hourly: { time: ['2026-11-06T12:00'], temperature_2m: [30], wind_speed_10m: [12], precipitation: [null] } }
describe('provider normalization', () => {
  it('uses an ODS date literal for the date-typed Qatar reporting year', () => {
    const url = new URL(createJobs({})['qatar-imports'].request(0).url)
    expect(url.searchParams.get('where')).toBe("lsn_year = date'2024-01-01' and startswith(hs8, \"10\")")
  })
  it('accepts grouped ODS ISO dates and unavailable country dimensions without inventing a country', () => {
    const row = { lsn_year: '2024-01-01T00:00:00+00:00', lshhr_month: 1, hs8: '10063000', details: 'Synthetic rice', country_of_origin: null, value_qr: 42, weight_kg: null }
    const page = createJobs({})['qatar-imports'].normalize({ total_count: 100, results: Array.from({ length: 100 }, () => row) }, at, 100)
    expect(page.nextCursor).toBe(200) // Grouped total_count is page-sized, not total groups.
    expect(page.observations[0].data).toMatchObject({ period: '2024-01', partner: null })
  })
  it('labels model output estimated and omits unavailable nulls', () => {
    const records = createJobs({}).weather.normalize(weather, at)
    expect(records.observations).toHaveLength(2)
    expect(records.observations[0]).toMatchObject({ nature: 'estimated', observedAt: '2026-11-06T12:00:00.000Z', data: { kind: 'weather', value: 30, unit: '°C' } })
  })
  it('rejects malformed arrays, units and missing provider fields', () => {
    const jobs = createJobs({})
    for (const job of Object.values(jobs)) expect(() => job.normalize({ unexpected: true }, at)).toThrow()
    expect(() => jobs.weather.normalize({ ...weather, hourly: { ...weather.hourly, temperature_2m: [] } }, at)).toThrow()
    expect(() => jobs.weather.normalize({ ...weather, hourly_units: { ...weather.hourly_units, temperature_2m: 'F' } }, at)).toThrow()
  })
  it('normalizes marine forecasts with provider units', () => {
    const result = createJobs({}).marine.normalize({ latitude: 25.3, longitude: 52, hourly_units: { wave_height: 'm', wave_period: 's' }, hourly: { time: ['2026-11-06T12:00'], wave_height: [0.4], wave_period: [3] } }, at)
    expect(result.observations[0]).toMatchObject({ nature: 'estimated', data: { kind: 'marine', variable: 'wave_height' } })
  })
  it('preserves Qatar historical period, QAR, country labels and classification evidence', () => {
    const result = createJobs({})['qatar-imports'].normalize({ total_count: 1, results: [{ lsn_year: '2025', lshhr_month: 1, hs8: '10063000', details: 'Synthetic rice', country_of_origin: 'Synthetic Country', value_qr: 42.5, weight_kg: 2 }] }, at)
    expect(result.observations).toHaveLength(2)
    expect(result.observations[0]).toMatchObject({ nature: 'historical', data: { currency: 'QAR', value: '42.5', hsCode: '10063000' } })
    expect(result.observations[1].data.kind).toBe('classification')
    expect(result.nextCursor).toBe(0)
  })
  it('normalizes only published dependency shares without inventing country totals', () => {
    const r = createJobs({})['qatar-dependencies'].normalize({ total_count: 1, results: [{ year: '2023', quarter: 'Q4', country: 'Synthetic Country', percentage: 12.3 }] }, at)
    expect(r.observations[0].data).toMatchObject({ kind: 'dependency', sharePercent: 12.3, period: '2023-Q4' })
  })
  it('keeps Comtrade USD and numeric country codes distinct', () => {
    const r = createJobs({}).comtrade.normalize({ data: [{ period: '2024', reporterCode: 634, partnerCode: 156, cmdCode: '10', cmdDesc: 'Synthetic cereals', flowCode: 'M', primaryValue: 100, netWgt: null }] }, at)
    expect(r.observations[0].data).toMatchObject({ currency: 'USD', reporter: '634', partner: '156', classification: 'HS (provider edition)' })
  })
  it('supports explicit credential-required Comtrade mode without disabling unrelated jobs', () => {
    const jobs = createJobs({ COMTRADE_MODE: 'subscription' })
    expect(() => jobs.comtrade.request(0)).toThrow(ProviderError)
    expect(jobs.weather.request(0).url).toContain('api.open-meteo.com')
  })
  it('retains news as evidence only, never confirmed disruptions', () => {
    const r = createJobs({}).gdelt.normalize({ articles: [{ url: 'https://example.org/synthetic', title: 'Synthetic fixture', seendate: '20261106T120000Z', domain: 'example.org', language: 'English', sourcecountry: 'Qatar' }] }, at)
    expect(r.observations[0]).toMatchObject({ nature: 'live', data: { kind: 'news', evidenceOnly: true } })
    expect(createJobs({}).gdelt.normalize({ articles: [] }, at).observations).toEqual([])
  })
})
describe('bounded provider HTTP transport', () => {
  it('preserves exact trade numeric tokens, including unsafe integers and exponents', async () => {
    const response = '{"data":[{"period":"2024","reporterCode":634,"partnerCode":0,"cmdCode":"10","cmdDesc":null,"flowCode":"M","primaryValue":9007199254740993.123456789,"netWgt":1e-8}]}'
    const raw = await fetchJson('https://example.org', {}, { fetch: async () => new Response(response) })
    const result = createJobs({}).comtrade.normalize(raw, at)
    expect(result.observations[0].data).toMatchObject({ value: '9007199254740993.123456789', weightKg: '0.00000001' })
    const qatar = await fetchJson('https://example.org', {}, { fetch: async () => new Response('{"value_qr":123456789012345.123456789,"weight_kg":2.5e3}') })
    expect(qatar).toEqual({ value_qr: '123456789012345.123456789', weight_kg: '2500' })
  })
  it('retries timeouts rather than assigning them a minute-long backoff', async () => {
    let calls = 0
    const value = await fetchJson('https://example.org', {}, { fetch: async () => {
      if (++calls === 1) throw new DOMException('synthetic timeout', 'TimeoutError')
      return Response.json({ ok: true })
    }, sleep: async () => {}, budgetMs: 5000 })
    expect(value).toEqual({ ok: true })
    expect(calls).toBe(2)
  })
  it('retries a transient error then returns validated JSON', async () => {
    let calls = 0
    const value = await fetchJson('https://example.org', {}, { fetch: async () => ++calls < 2 ? new Response('', { status: 503 }) : Response.json({ ok: true }), sleep: async () => {}, budgetMs: 5000 })
    expect(value).toEqual({ ok: true })
    expect(calls).toBe(2)
  })
  it('defers long Retry-After instead of waiting in serverless', async () => {
    await expect(fetchJson('https://example.org', {}, { fetch: async () => new Response('secret body', { status: 429, headers: { 'Retry-After': '120' } }), sleep: async () => {}, budgetMs: 5000 })).rejects.toMatchObject({ code: 'rate_limited', retryAfterMs: 120000 })
  })
  it('uses a conservative cooldown for rate limits without Retry-After', async () => {
    await expect(fetchJson('https://example.org', {}, { fetch: async () => new Response('', { status: 429 }), sleep: async () => {}, budgetMs: 5000 })).rejects.toMatchObject({ code: 'rate_limited', retryAfterMs: 60000 })
  })
  it('never exposes provider error bodies or credentials', async () => {
    await expect(fetchJson('https://example.org?key=SECRET', {}, { fetch: async () => new Response('SECRET', { status: 401 }), budgetMs: 5000 })).rejects.toMatchObject({ code: 'provider_auth', message: 'provider_auth' })
  })
  it('rejects non-JSON success and exhausts transient failures', async () => {
    await expect(fetchJson('https://example.org', {}, { fetch: async () => new Response('not JSON'), budgetMs: 5000 })).rejects.toMatchObject({ code: 'malformed_response' })
    await expect(fetchJson('https://example.org', {}, { fetch: async () => { throw new Error('SECRET') }, sleep: async () => {}, budgetMs: 5000 })).rejects.toMatchObject({ code: 'provider_unavailable' })
  })
})
