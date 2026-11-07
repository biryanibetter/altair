import { createServer } from 'node:http'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createIntelligenceHandler, type IntelligenceStore } from '../src/intelligence/http'
import { scenarioFromRow } from '../src/intelligence/rows'
import { testDatabase } from './database'
import { qatarRoutingDemo } from '../src/routing/demo'
import { id, now, provenance } from './routing-fixtures'

describe('authenticated scenario HTTP workflow with PostgreSQL', () => {
  let db: Awaited<ReturnType<typeof testDatabase>>
  let store: IntelligenceStore
  beforeAll(async () => {
    db = await testDatabase(); const demo = qatarRoutingDemo()
    await db.pg.exec(`create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
      insert into auth.users(id) values ('${id(201)}');`)
    for (const n of demo.network.nodes) await db.pg.query('insert into locations(id,name,kind,country_code) values ($1,$2,$3,$4)', [n.id, n.name, n.kind, n.countryCode])
    for (const e of demo.network.edges) await db.pg.query('insert into transport_connections(id,origin_id,destination_id,mode,routing_metadata) values ($1,$2,$3,$4,$5)', [e.id, e.originId, e.destinationId, e.mode, JSON.stringify(e.metadata)])
    await db.pg.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id(201)}',false)`)
    const value = async (query: string, params: unknown[]) => (await db.pg.query<{ value: unknown }>(query, params)).rows[0]?.value
    store = {
      create: async (input, version) => scenarioFromRow(await value('select create_simulation($1::jsonb,$2) as value', [JSON.stringify(input), version])),
      get: async sid => { const r = await value('select to_jsonb(s) as value from scenarios s where id=$1', [sid]); return r ? scenarioFromRow(r) : null },
      save: async (sid, output) => { const r = await value('select finish_simulation($1,$2::jsonb) as value', [sid, JSON.stringify(output)]); return r ? scenarioFromRow(r) : null },
      list: async (limit, cursor) => (await db.pg.query<{ id: string; name: string; created_at: string; engine_version: string; simulation_output: unknown }>('select id,name,created_at,engine_version,simulation_output from scenarios where ($1::uuid is null or id>$1::uuid) order by id limit $2', [cursor ?? null, limit])).rows.map(r => ({ id: r.id, name: r.name, createdAt: new Date(r.created_at).toISOString(), engineVersion: r.engine_version, executed: r.simulation_output !== null })), intelligence: async () => ({ network: demo.network, signals: [], coverage: { unmappedObservations: 0, legacySignals: 0, rules: [] } }),
    }
  }, 30000)
  afterAll(async () => { await db?.pg.close() })
  it('authenticates every action, rejects invalid parameters and hides other-owner/missing IDs', async () => {
    for (const action of ['create', 'list', 'read', 'execute', 'compare', 'risks'] as const) expect((await createIntelligenceHandler(action, async () => null)(new Request('http://localhost'), id(4))).status).toBe(401)
    const get = createIntelligenceHandler('read', async () => store)
    expect((await get(new Request('http://localhost'), id(99))).status).toBe(404)
    expect((await get(new Request('http://localhost'), 'bad')).status).toBe(400)
    expect((await createIntelligenceHandler('risks', async () => store)(new Request('http://localhost?limit=1&limit=2'))).status).toBe(400)
    expect((await createIntelligenceHandler('create', async () => store)(new Request('http://localhost', { method: 'POST', body: '{}' }))).status).toBe(400)
  })
  it('runs local HYPOTHETICAL Qatar creation → execution → stored comparison over real HTTP', async () => {
    const server = createServer(async (req, res) => {
      const chunks: Buffer[] = []; for await (const c of req) chunks.push(Buffer.from(c))
      const path = new URL(req.url!, 'http://localhost').pathname.split('/').filter(Boolean)
      const action = req.method === 'POST' && path.length === 1 ? 'create' : path.at(-1) === 'execute' ? 'execute' : 'compare'
      const response = await createIntelligenceHandler(action, async () => store)(new Request(`http://localhost${req.url}`, { method: req.method, ...(req.method === 'POST' ? { body: Buffer.concat(chunks) } : {}) }), path[1])
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text())
    })
    server.listen(0, '127.0.0.1'); await once(server, 'listening')
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/scenarios`
    try {
      const demo = qatarRoutingDemo()
      const creation = await fetch(base, { method: 'POST', body: JSON.stringify({ name: demo.label, hypothetical: true, routeRequest: demo.request, assumptions: [demo.label], modifications: [{ kind: 'connection', edgeId: demo.network.edges[0].id, closed: true }, { kind: 'connection', edgeId: demo.network.edges[2].id, costFactor: 2 }] }) })
      expect(creation.status).toBe(201); const created = await creation.json()
      expect((await fetch(`${base}/${created.id}/compare`)).status).toBe(409)
      const [run, concurrent] = await Promise.all([fetch(`${base}/${created.id}/execute`, { method: 'POST' }), fetch(`${base}/${created.id}/execute`, { method: 'POST' })]); expect(run.status).toBe(200); expect(concurrent.status).toBe(200)
      const output = await run.json(); expect(output.simulated.routes.alternatives).toHaveLength(2)
      expect(await concurrent.json()).toEqual(output)
      expect(output.routeChanges.lostRouteIds).toHaveLength(1)
      const comparison = await fetch(`${base}/${created.id}/compare`); expect(comparison.status).toBe(200)
      expect(await comparison.json()).toEqual(output)
      const replay = await fetch(`${base}/${created.id}/execute`, { method: 'POST' }); expect(await replay.json()).toEqual(output)
      const listed = await createIntelligenceHandler('list', async () => store)(new Request('http://localhost?limit=1'))
      expect((await listed.json()).data[0].id).toBe(created.id)
    } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
  })
  it('filters and paginates risk evidence without confirming closures or returning stale data as active', async () => {
    const signals = [1, 2].map(n => ({ id: id(80 + n), category: 'geopolitical' as const, severity: 'critical' as const, observedAt: now, validUntil: n === 1 ? '2026-11-08T00:00:00.000Z' : '2026-11-05T00:00:00.000Z', target: { kind: 'node' as const, id: id(1) }, evidence: 'Hypothetical news evidence', provenance, status: 'potential' as const, rule: 'structured-evidence-v1', nature: 'simulated' as const }))
    signals[1].observedAt = '2026-11-04T00:00:00.000Z'
    const handler = createIntelligenceHandler('risks', async () => ({ ...store, intelligence: async () => ({ network: qatarRoutingDemo().network, signals, coverage: { unmappedObservations: 1, legacySignals: 1, rules: ['test'] } }) }), () => now)
    const active = await handler(new Request('http://localhost?category=geopolitical&limit=1'))
    expect(active.status).toBe(200); expect((await active.json()).data.map((s: { id: string }) => s.id)).toEqual([id(81)])
    const stale = await handler(new Request('http://localhost?freshness=stale'))
    expect((await stale.json()).data.map((s: { id: string }) => s.id)).toEqual([id(82)])
    const all = await handler(new Request('http://localhost?freshness=all&limit=1'))
    expect((await all.json()).meta.nextCursor).toBe(id(81))
  })
})
