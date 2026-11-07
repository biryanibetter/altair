import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { testDatabase } from './database'
import { createJobs } from '../src/providers'
import { ingest } from '../src/ingestion'
import { createReadHandler } from '../src/http'
import { postgresReader } from './read-database'
import { readFileSync } from 'node:fs'

// Explicit synthetic fixture; no fallback to this fixture in production.
const payload = { latitude: 25.3, longitude: 51.5, hourly_units: { temperature_2m: '°C', wind_speed_10m: 'km/h', precipitation: 'mm' }, hourly: { time: ['2026-11-06T12:00'], temperature_2m: [30], wind_speed_10m: [12], precipitation: [null] } }
describe('PostgreSQL ingestion', () => {
  let db: Awaited<ReturnType<typeof testDatabase>>
  beforeAll(async () => { db = await testDatabase() }, 30000)
  afterAll(async () => { await db?.pg.close() })
  it('stores validated evidence and source attribution; caches duplicate execution', async () => {
    const job = createJobs({}).weather
    const result = await ingest(job, db.store, { fetch: async () => Response.json(payload) })
    expect(result.status).toBe('success')
    expect(result.count).toBe(2)
    const rows = await db.pg.query<{ nature: string; license: string }>('select * from provider_observations')
    expect(rows.rows).toHaveLength(2)
    expect(rows.rows[0].nature).toBe('estimated')
    expect(rows.rows[0].license).toContain('CC BY')
    expect((await ingest(job, db.store, { fetch: async () => { throw new Error('must not fetch cache') } })).status).toBe('cached')
  })
  it('upserts duplicate keys rather than accumulating copies', async () => {
    await db.database.execute(sql`update ingestion_state set expires_at = now() - interval '1 second' where job='weather'`)
    expect((await ingest(createJobs({}).weather, db.store, { fetch: async () => Response.json(payload) })).status).toBe('success')
    expect((await db.pg.query<{ count: number }>('select count(*)::int as count from provider_observations')).rows[0].count).toBe(2)
  })
  it('preserves last success and old records on malformed provider response', async () => {
    await db.database.execute(sql`update ingestion_state set expires_at = now() - interval '1 second' where job='weather'`)
    const before = (await db.store.status()).find(s => s.job === 'weather')!
    const r = await ingest(createJobs({}).weather, db.store, { fetch: async () => Response.json({ malformed: true }) })
    expect(r.status).toBe('failed')
    const after = (await db.store.status()).find(s => s.job === 'weather')!
    expect(after.lastSuccessAt).toBe(before.lastSuccessAt)
    expect(after.errorCode).toBe('malformed_response')
  })
  it('records missing credentials without breaking another provider', async () => {
    const r = await ingest(createJobs({ COMTRADE_MODE: 'subscription' }).comtrade, db.store)
    expect(r.status).toBe('unconfigured')
    expect((await db.store.status()).find(s => s.job === 'comtrade')).toMatchObject({ errorCode: 'missing_credentials', lastSuccessAt: null })
    expect((await db.store.claim('marine')).status).toBe('claimed')
  })
  it('rejects overlapping runs and fences expired leases', async () => {
    const first = await db.store.claim('gdelt')
    expect(first.status).toBe('claimed')
    expect((await db.store.claim('gdelt')).status).toBe('busy')
    await db.database.execute(sql`update ingestion_state set lease_until=now()-interval '1 second' where job='gdelt'`)
    const second = await db.store.claim('gdelt')
    expect(second.status).toBe('claimed')
    if (first.status !== 'claimed' || second.status !== 'claimed') throw new Error('claim failed')
    await expect(db.store.complete('gdelt', first.runId, { observations: [], nextCursor: 0, coverage: 'test' }, 1000)).rejects.toThrow('lease_lost')
    await db.store.complete('gdelt', second.runId, { observations: [], nextCursor: 0, coverage: 'test-empty-window' }, 1000)
    const history = await db.pg.query<{ status: string }>(`select status from ingestion_runs where id='${first.runId}'`)
    expect(history.rows[0].status).toBe('interrupted')
  })
  it('persists Retry-After and defers subsequent invocations', async () => {
    await db.database.execute(sql`update ingestion_state set lease_until=now()-interval '1 second' where job='marine'`)
    const r = await ingest(createJobs({}).marine, db.store, { fetch: async () => new Response('private error', { status: 429, headers: { 'Retry-After': '120' } }) })
    expect(r).toMatchObject({ status: 'failed', errorCode: 'rate_limited' })
    expect((await ingest(createJobs({}).marine, db.store)).status).toBe('deferred')
  })
  it('rolls back a batch and cursor if persistence fails', async () => {
    await db.database.execute(sql`update ingestion_state set next_retry_at=null where job='comtrade'`)
    const c = await db.store.claim('comtrade')
    if (c.status !== 'claimed') throw new Error('claim failed')
    const records = createJobs({}).weather.normalize(payload, new Date()).observations.map(o => ({ ...o, job: 'comtrade' as const, sourceId: 'ffffffff-ffff-4fff-8fff-ffffffffffff' }))
    await expect(db.store.complete('comtrade', c.runId, { observations: records, nextCursor: 100, coverage: 'test' }, 1000)).rejects.toThrow()
    expect((await db.pg.query<{ count: number }>("select count(*)::int as count from provider_observations where job='comtrade'")).rows[0].count).toBe(0)
    expect((await db.store.status()).find(s => s.job === 'comtrade')!.cursor).toBe(0)
  })
  it('enforces authenticated catalog reads and prevents client writes and operational reads', async () => {
    await db.pg.exec('set role anon')
    await expect(db.pg.query('select * from provider_observations')).rejects.toThrow()
    await db.pg.exec('reset role; set role authenticated')
    expect((await db.pg.query('select * from provider_observations')).rows.length).toBeGreaterThan(0)
    await expect(db.pg.query('select * from ingestion_state')).rejects.toThrow()
    await expect(db.pg.query('delete from provider_observations')).rejects.toThrow()
    expect((await db.pg.query('select * from public.ingestion_status()')).rows.length).toBe(11)
    await db.pg.exec('reset role')
  })
  it('retrieves normalized evidence through the API and labels stale synchronization', async () => {
    const reader = postgresReader(db.database)
    const response = await createReadHandler('weather', async () => reader)(new Request('http://localhost/api/v1/weather?limit=1'))
    expect(response.status).toBe(200)
    const first = await response.json()
    expect(first.data).toHaveLength(1)
    expect(first.data[0]).toMatchObject({ provider: 'open-meteo', nature: 'estimated', data: { kind: 'weather' } })
    expect(first.meta.nextCursor).toBeTruthy()
    const second = await createReadHandler('weather', async () => reader)(new Request(`http://localhost/api/v1/weather?limit=1&cursor=${first.meta.nextCursor}`))
    expect((await second.json()).data[0].id).not.toBe(first.data[0].id)
    const freshness = await createReadHandler('freshness', async () => reader)(new Request('http://localhost/api/v1/freshness'))
    expect((await freshness.json()).data.find((s: { job: string }) => s.job === 'weather')).toMatchObject({ status: 'stale', nature: 'estimated' })
  })
  it('invalidates cached state and resets pagination when provider configuration changes', async () => {
    await db.database.execute(sql`update ingestion_state set status='success', expires_at=now()+interval '1 day', cursor=100 where job='weather'`)
    const changed = await db.store.claim('weather', 'different-coordinate-query')
    expect(changed.status).toBe('claimed')
    if (changed.status === 'claimed') expect(changed.cursor).toBe(0)
  })
  it('leaves scheduler activation inert by default even without Cron or Vault installed', async () => {
    await db.pg.exec(readFileSync(new URL('../../db/operations/ingestion-cron.sql', import.meta.url), 'utf8'))
    expect((await db.pg.query<{ count: number }>("select count(*)::int as count from pg_namespace where nspname='cron'")).rows[0].count).toBe(0)
  })
})
