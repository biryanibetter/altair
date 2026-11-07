import { afterEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('../supabase/server', () => ({ createSupabaseServerClient: vi.fn() }))
import { createSupabaseServerClient } from '../supabase/server'
import { POST as create, GET as list } from '../../app/api/v1/scenarios/route'
import { GET as read } from '../../app/api/v1/scenarios/[id]/route'
import { POST as execute } from '../../app/api/v1/scenarios/[id]/execute/route'
import { GET as compare } from '../../app/api/v1/scenarios/[id]/compare/route'
import { GET as risks } from '../../app/api/v1/risks/route'
import { qatarRoutingDemo } from '../../../../packages/backend/src/routing/demo'
afterEach(() => vi.clearAllMocks())
const id = '00000000-0000-4000-8000-000000000099'
const context = { params: Promise.resolve({ id }) }
it('all scenario and risk Next.js endpoints reject unverified identities', async () => {
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as never)
  for (const handler of [create, list, risks]) expect((await handler(new Request('http://localhost/api/v1/test'))).status).toBe(401)
  for (const handler of [read, execute, compare]) expect((await handler(new Request('http://localhost/api/v1/test'), context)).status).toBe(401)
})
it('actual Next.js handlers complete a hypothetical create, read, execute and compare workflow', async () => {
  const demo = qatarRoutingDemo()
  const network = { nodes: demo.network.nodes.map(n => ({ id: n.id, name: n.name, kind: n.kind, country_code: n.countryCode, longitude: n.coordinates?.[0], latitude: n.coordinates?.[1] })), edges: demo.network.edges.map(e => ({ id: e.id, origin_id: e.originId, destination_id: e.destinationId, mode: e.mode, routing_metadata: e.metadata })) }
  let saved: Record<string, unknown> | null = null
  const client = {
    auth: { getUser: async () => ({ data: { user: { id } }, error: null }) },
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name === 'intelligence_snapshot') return { data: { network, riskEvidence: { signals: [], observations: [] } }, error: null }
      if (name === 'create_simulation') saved = { id, name: demo.label, created_at: demo.evaluatedAt, engine_version: args.version, baseline_hash: 'immutable-test-reference', simulation_input: args.input, simulation_output: null, baseline_snapshot: { version: 1, evaluatedAt: demo.evaluatedAt, network, riskEvidence: { signals: [], observations: [] }, inventory: [], shipments: [], supplierIds: [], references: {} } }
      if (name === 'finish_simulation') saved!.simulation_output = args.output
      return { data: saved, error: null }
    },
    from: () => { const chain = { select: () => chain, eq: () => chain, not: () => chain, maybeSingle: async () => ({ data: saved, error: null }) }; return chain },
  }
  vi.mocked(createSupabaseServerClient).mockResolvedValue(client as never)
  const created = await create(new Request('http://localhost/api/v1/scenarios', { method: 'POST', body: JSON.stringify({ name: demo.label, hypothetical: true, routeRequest: demo.request, modifications: [{ kind: 'connection', edgeId: demo.network.edges[0].id, closed: true }] }) }))
  expect(created.status).toBe(201)
  expect((await read(new Request('http://localhost'), context)).status).toBe(200)
  const run = await execute(new Request('http://localhost', { method: 'POST' }), context); expect(run.status).toBe(200)
  const output = await run.json(); expect(output.routeChanges.lostRouteIds).toHaveLength(1)
  expect(await (await compare(new Request('http://localhost'), context)).json()).toEqual(output)
  expect((await risks(new Request('http://localhost/api/v1/risks'))).status).toBe(200)
})
