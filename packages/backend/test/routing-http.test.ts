import { describe, expect, it, vi } from 'vitest'
import { createRouteHandler, readJsonBody } from '../src/routing/http'
import { networkFromRows } from '../src/routing/rows'
import { createRoutingAdapters, decodePolyline } from '../src/routing/providers'
import { qatarRoutingDemo } from '../src/routing/demo'
import { testDatabase } from './database'
import { graph, request, now, id } from './routing-fixtures'

const post = (body: unknown) => new Request('http://localhost/api/v1/routes/compare', { method: 'POST', body: JSON.stringify(body) })
describe('routing boundaries', () => {
  it('decodes HERE flexible polylines into longitude-first geometry and rejects unsupported encodings', () => {
    // HERE Flexible Polyline v1 reference example, not invented route geometry.
    const line = decodePolyline('BFoz5xJ67i1B1B7PzIhaxL7Y')
    expect(line.coordinates[0]).toEqual([8.69821, 50.10228])
    expect(line.coordinates[1]).toEqual([8.69567, 50.10201])
    expect(() => decodePolyline('BVo')).toThrow('unsupported_dimension')
    expect(() => decodePolyline('BFoz5xJ')).toThrow('invalid_polyline')
  })
  it('offers optional bounded provider geometry without replacing logistics time/cost evidence', async () => {
    const demo = qatarRoutingDemo()
    const response = await createRouteHandler(async () => ({ network: async () => demo.network, enrich: async () => [{ edgeId: demo.network.edges[0].id, status: 'unconfigured', reason: 'provider_credentials_missing' }] }), () => demo.evaluatedAt)(post({ ...demo.request, preferences: { ...demo.request.preferences, enrichGeometry: true } }))
    expect(response.status).toBe(200)
    const result = await response.json()
    expect(result.providerEstimates[0].status).toBe('unconfigured')
    expect(result.alternatives.find((r: { edgeIds: string[] }) => r.edgeIds.length === 2).cost.total.amount).toBe('600.00')
  })
  it('authenticates before storage, validates bounded input and sanitizes failures', async () => {
    expect((await createRouteHandler(async () => null)(post(request()))).status).toBe(401)
    const handler = createRouteHandler(async () => ({ network: async () => graph() }), () => now)
    expect((await handler(post({ ...request(), ownerId: id(7) }))).status).toBe(400)
    expect((await handler(post(request({ originId: id(99) })))).status).toBe(400)
    const response = await handler(post(request()))
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store')
    expect((await response.json()).alternatives).toHaveLength(3)
    const failed = await createRouteHandler(async () => { throw Error('SECRET') })(post(request()))
    expect(failed.status).toBe(503); expect(await failed.text()).not.toContain('SECRET')
    await expect(readJsonBody(post('x'.repeat(70000)))).rejects.toThrow('invalid_body')
    expect((await handler(new Request('http://localhost', { method: 'POST', body: '{' }))).status).toBe(400)
  })
  it('projects legacy connections as unknown without inferring geographic edges', () => {
    const g = networkFromRows({ nodes: [{ id: id(1), name: 'A', kind: 'port', country_code: 'QA', longitude: null, latitude: null }, { id: id(2), name: 'B', kind: 'port', country_code: 'QA', longitude: 51, latitude: 25 }], edges: [{ id: id(3), origin_id: id(1), destination_id: id(2), mode: 'sea', routing_metadata: null }] })
    expect(g.edges).toHaveLength(1); expect(g.edges[0].metadata).toBeNull()
  })
  it('handles unconfigured, empty, invalid and failed providers without invented estimates', async () => {
    const fetch = vi.fn(async () => Response.json({ routes: [] }))
    const blank = createRoutingAdapters({}, { fetch }, () => now)
    expect((await blank.road([51, 25], [52, 26])).status).toBe('unconfigured'); expect(fetch).not.toHaveBeenCalled()
    const configured = createRoutingAdapters({ HERE_API_KEY: 'SECRET', SEAROUTES_API_KEY: 'SECRET' }, { fetch }, () => now)
    expect((await configured.road([51, 25], [52, 26])).status).toBe('unavailable')
    expect((await configured.sea([51, 25], [52, 26])).status).toBe('unavailable')
    const denied = createRoutingAdapters({ HERE_API_KEY: 'SECRET' }, { fetch: async () => new Response('SECRET', { status: 401 }) }, () => now)
    expect(JSON.stringify(await denied.road([51, 25], [52, 26]))).not.toContain('SECRET')
  })
  it('normalizes road seconds/metres and sea milliseconds/metres with provenance, without quotations', async () => {
    const a = createRoutingAdapters({ HERE_API_KEY: 'SECRET', SEAROUTES_API_KEY: 'SECRET' }, { fetch: async url => String(url).includes('hereapi') ? Response.json({ routes: [{ sections: [{ summary: { duration: 3600, length: 50000 } }] }] }) : Response.json({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { duration: 7200000, distance: 100000 }, geometry: { type: 'LineString', coordinates: [[51, 25], [52, 26]] } }] }) }, () => now)
    const road = await a.road([51, 25], [52, 26]); const sea = await a.sea([51, 25], [52, 26])
    expect(road.status === 'available' && road.estimate.durationHours).toBe(1)
    expect(sea.status === 'available' && sea.estimate.durationHours).toBe(2)
    expect(sea.status === 'available' && sea.estimate.distanceKm).toBe(100)
    expect(JSON.stringify(sea)).not.toContain('SECRET')
  })
  it('migrates catalogs and exposes only authenticated invoker network snapshots', async () => {
    const { pg } = await testDatabase()
    try {
      await pg.exec(`insert into locations(id,name,kind,country_code,longitude,latitude) values ('${id(1)}','Qatar terminal','terminal','QA',51,25);`)
      await expect(pg.exec(`insert into locations(name,kind,country_code,longitude,latitude) values ('Invalid','port','QA',181,25)`)).rejects.toThrow()
      await pg.exec('set role authenticated')
      const r = await pg.query<{ value: { nodes: unknown[] } }>('select routing_network_snapshot() as value')
      expect(r.rows[0].value.nodes).toHaveLength(1)
      await expect(pg.exec(`update locations set longitude=52`)).rejects.toThrow()
      await pg.exec('reset role; set role anon')
      await expect(pg.exec('select routing_network_snapshot()')).rejects.toThrow()
    } finally { await pg.close() }
  }, 30000)
})
