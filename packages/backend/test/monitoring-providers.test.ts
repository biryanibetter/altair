import { expect, it } from 'vitest'
import { createJobs } from '../src/providers'
import { ingest } from '../src/ingestion'
import { testDatabase } from './database'
import { fetchJson } from '../src/transport'

const now = new Date('2026-11-07T12:00:00.000Z')
const env = { OPENSKY_ENABLED: 'true', TRANSPORT_BBOX: '50,24,52,27', HERE_TRAFFIC_ENABLED: 'true', HERE_API_KEY: 'fixture-secret' }
it('keeps network integrations opt-in and AIS disabled on serverless runtimes', () => {
  const jobs = createJobs({})
  expect(() => jobs.opensky.request(0)).toThrow('integration_disabled')
  expect(() => createJobs({ AISSTREAM_ENABLED: 'true', AISSTREAM_API_KEY: 'secret', AISSTREAM_RUNTIME: 'worker', VERCEL: '1', TRANSPORT_BBOX: env.TRANSPORT_BBOX }).aisstream.request(0)).toThrow('runtime_unsupported')
})
it('retains OpenSky position event time and never refreshes an old position into live cargo evidence', () => {
  const job = createJobs(env).opensky
  const payload = { time: now.getTime() / 1000, states: [['abc123', 'TEST   ', 'Qatar', now.getTime() / 1000 - 600, now.getTime() / 1000, 51, 25, 1000, false, 200, 10, 0, null, 1100, null, false, 0]] }
  const a = job.normalize(payload, now), b = job.normalize(payload, new Date(now.getTime() + 1000))
  expect(a.observations).toHaveLength(1)
  expect(a.observations[0]?.observedAt).toBe('2026-11-07T11:50:00.000Z')
  expect(a.observations[0]?.data).toMatchObject({ kind: 'aircraft', providerId: 'abc123', evidenceOnly: true })
  expect(a.observations[0]?.recordKey).toBe(b.observations[0]?.recordKey)
  expect(a.observations[0]?.data).toMatchObject({ freshUntil: '2026-11-07T11:52:00.000Z' })
  payload.states[0]![5] = null as never
  expect(job.normalize(payload, now).observations).toHaveLength(0)
})
it('normalizes HERE flow and incidents using stable provider IDs without leaking query credentials', () => {
  const jobs = createJobs(env)
  expect(new URL(jobs['here-flow'].request(0).url).hostname).toBe('data.traffic.hereapi.com')
  const flow = jobs['here-flow'].normalize({ sourceUpdated: now.toISOString(), results: [{ location: { description: 'Test road', length: 100, shape: { links: [{ points: [{ lat: 25, lng: 51 }, { lat: 25.1, lng: 51.1 }] }] } }, currentFlow: { speed: 2, freeFlow: 20, jamFactor: 9, traversability: 'open' } }] }, now)
  expect(flow.observations[0]?.data).toMatchObject({ kind: 'traffic', status: 'congested', speedMps: 2, evidenceOnly: true })
  expect(flow.observations[0]?.nature).toBe('estimated') // unknown confidence is not proven live speed
  expect(flow.observations[0]?.sourceUrl).not.toContain('fixture-secret')
  const incidents = jobs['here-incidents'].normalize({ sourceUpdated: now.toISOString(), results: [{ location: { description: 'Test road', shape: { links: [{ points: [{ lat: 25, lng: 51 }] }] } }, incidentDetails: { id: 'incident-1', criticality: 'critical', type: 'accident', roadClosed: true, startTime: '2026-11-07T11:00:00Z', endTime: '2026-11-07T13:00:00Z' } }] }, now)
  expect(incidents.observations[0]?.data).toMatchObject({ kind: 'traffic', providerId: 'incident-1', status: 'closed' })
  expect(() => jobs['here-flow'].normalize({ sourceUpdated: now.toISOString(), results: [{ currentFlow: { jamFactor: 100 } }] }, now)).toThrow()
})
it('persists deduplicated network events and preserves good observations during provider outages', async () => {
  const { pg, store } = await testDatabase()
  try {
    const job = createJobs(env).opensky
    const t = Math.floor(Date.now() / 1000)
    const body = { time: t, states: [['abc123', null, 'Qatar', t, t, 51, 25, null, false, null, null, null, null, null, null, false, 0]] }
    expect((await ingest(job, store, { fetch: async () => Response.json(body) })).status).toBe('success')
    await pg.exec("update ingestion_state set expires_at=now()-interval '1 second' where job='opensky'")
    expect((await ingest(job, store, { fetch: async () => Response.json(body) })).status).toBe('success')
    expect((await pg.query('select * from provider_observations')).rows).toHaveLength(1)
    await pg.exec("update ingestion_state set expires_at=now()-interval '1 second' where job='opensky'")
    const failed = await ingest(job, store, { fetch: async () => new Response('private upstream details', { status: 503 }), sleep: async () => {} })
    expect(failed.status).toBe('failed'); expect(failed.errorCode).toBe('provider_unavailable')
    expect((await pg.query('select * from provider_observations')).rows).toHaveLength(1)
  } finally { await pg.close() }
}, 30000)
it('honors OpenSky quota cooldown headers instead of retrying inside a long provider outage', async () => {
  await expect(fetchJson('https://opensky-network.org/api/states/all', {}, { fetch: async () => new Response('', { status: 429, headers: { 'X-Rate-Limit-Retry-After-Seconds': '3600' } }) })).rejects.toMatchObject({ code: 'rate_limited', retryAfterMs: 3600000 })
})
