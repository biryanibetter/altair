import { expect, it } from 'vitest'
import { assistantRequestSchema, routeRequestSchema, scenarioInputSchema, simulationOutputSchema } from '@altair/shared/contracts'
import { chat } from '../src/assistant/orchestrator'
import { executeTool, type ToolDispatch } from '../src/assistant/tools'
import { createSupplyHandler, type SupplyStore } from '../src/supply/http'
import { createIntelligenceHandler, type IntelligenceStore } from '../src/intelligence/http'
import { createRouteHandler } from '../src/routing/http'
import { intelligenceFromRows, scenarioFromRow } from '../src/intelligence/rows'
import { supplyFromRows, suppliersFromRows } from '../src/supply/rows'
import { testDatabase } from './database'
import { qatarRoutingDemo } from '../src/routing/demo'

const a = '20000000-0000-4000-8000-000000000001', b = '20000000-0000-4000-8000-000000000002'
it('retains exact trade source references alongside dependency calculations', async () => {
  const time = '2026-11-07T00:00:00.000Z'
  const observation = { id: a, job: 'qatar-imports', provider: 'qatar-open-data', recordKey: 'synthetic-trade', sourceId: b, sourceUrl: 'https://example.org/official-trade', license: 'synthetic', nature: 'historical', observedAt: time, fetchedAt: time, expiresAt: '2027-01-01T00:00:00.000Z', sourceUpdatedAt: null, data: { kind: 'trade', period: '2024', reporter: 'Qatar', partner: 'TestOrigin', hsCode: '10', classification: 'HS2022', description: null, flow: 'import', value: '100', currency: 'QAR', weightKg: null } }
  const store = { intelligence: async () => ({ network: { version: 1, nodes: [], edges: [] }, signals: [] }), trade: async () => [observation] } as unknown as SupplyStore
  const response = await createSupplyHandler('dependency', async () => store)(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ reporter: 'Qatar', hsCode: '10', classification: 'HS2022', currency: 'QAR' }) }))
  const output = await response.json()
  expect(output.periods[0]?.hhi).toBe(1)
  expect(output.sourceObservations[0]).toMatchObject({ id: a, sourceId: b, sourceUrl: observation.sourceUrl, nature: 'historical', observedAt: time })
})
it('connects a hypothetical Qatar equipment route, crisis, stock impact, supplier and approved AI explanation', async () => {
  const { pg } = await testDatabase()
  try {
    const demo = qatarRoutingDemo()
    // Small hypothetical graph keeps the complete evidence in the assistant's strict budget.
    demo.network.nodes = demo.network.nodes.slice(0, 2); demo.network.edges = demo.network.edges.slice(0, 1)
    const route = routeRequestSchema.parse({ ...demo.request, originId: demo.network.nodes[0]!.id, destinationId: demo.network.nodes[1]!.id })
    await pg.exec(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
      INSERT INTO auth.users(id) VALUES ('${a}'),('${b}');
       INSERT INTO products(id,name) VALUES ('${a}','HYPOTHETICAL essential equipment');
       INSERT INTO warehouses(id,owner_id,name) VALUES ('${a}','${a}','HYPOTHETICAL stock');
       INSERT INTO inventory(id,owner_id,warehouse_id,product_id,quantity,unit) VALUES ('${a}','${a}','${a}','${a}',100,'kg');`)
    for (const n of demo.network.nodes) await pg.query('insert into locations(id,name,kind,country_code) values ($1,$2,$3,$4)', [n.id,n.name,n.kind,n.countryCode])
    for (const e of demo.network.edges) await pg.query('insert into transport_connections(id,origin_id,destination_id,mode,routing_metadata) values ($1,$2,$3,$4,$5)', [e.id,e.originId,e.destinationId,e.mode,JSON.stringify(e.metadata)])
    await pg.query('insert into suppliers(id,name,location_id,verification_status,verified_at,expires_at) values ($1,$2,$3,$4,$5,$6)', [a,'HYPOTHETICAL Qatar supplier',demo.network.nodes[1]!.id,'verified','2026-10-01','2027-01-01'])
    await pg.query('insert into supplier_evidence(id,supplier_id,source_url,description,observed_at,expires_at,status) values ($1,$2,$3,$4,$5,$6,$7)', [a,a,'https://example.org/hypothetical-supplier','Demonstration only; stock availability unverified','2026-10-01','2027-01-01','confirmed'])
    await pg.query('insert into supplier_products(supplier_id,product_id,evidence_id) values ($1,$2,$3)', [a,a,a])
    await pg.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${a}',false)`)
    const value = async (sql: string, params: unknown[] = []) => (await pg.query<{ value: unknown }>(sql, params)).rows[0]!.value
    const supply = {
      snapshot: async (id: string) => { const raw = await value('select supply_inventory_snapshot($1) as value', [id]); return raw ? supplyFromRows(raw) : null },
      suppliers: async () => suppliersFromRows(await value('select supply_supplier_snapshot() as value')),
    } as SupplyStore
    const intelligence = async () => intelligenceFromRows(await value('select intelligence_snapshot() as value'), new Date().toISOString())
    const simulations = {
      create: async (input, version) => scenarioFromRow(await value('select create_simulation($1,$2) as value', [JSON.stringify(input),version])),
      get: async id => { const raw = await value('select to_jsonb(s) as value from scenarios s where id=$1 union all select null where not exists(select 1 from scenarios where id=$1)', [id]); return raw ? scenarioFromRow(raw) : null },
      save: async (id, output) => scenarioFromRow(await value('select finish_simulation($1,$2) as value', [id,JSON.stringify(output)])),
      intelligence,
    } as IntelligenceStore
    const dispatch: ToolDispatch = async (name, input) => {
      const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify(input) })
      if (name === 'compare_routes') { const c = await intelligence(); return createRouteHandler(async () => ({ network: async () => c.network, risks: async () => c.signals }))(req) }
      if (name === 'forecast_inventory') return createSupplyHandler('forecast', async () => supply)(req)
      if (name === 'search_suppliers') return createSupplyHandler('suppliers', async () => supply)(req)
      if (name === 'create_simulation') return createIntelligenceHandler('create', async () => simulations)(req)
      if (name === 'compare_simulation') return createIntelligenceHandler('compare', async () => simulations)(new Request('http://localhost'), String(input.id))
      return createIntelligenceHandler('execute', async () => simulations)(new Request('http://localhost', { method: 'POST' }), String(input.id))
    }
    let round = 0
    const call = (name: string, args: unknown) => ({ id: `c${round}-${name}`, name, arguments: JSON.stringify(args) })
    const scenarioInput = scenarioInputSchema.parse({ name: 'HYPOTHETICAL equipment disruption', routeRequest: route, hypothetical: true, assumptions: ['Demonstration only; no verified service or stock'], demand: [{ productId: a, unit: 'kg', quantity: '90' }], modifications: [{ kind: 'connection', edgeId: demo.network.edges[0]!.id, closed: true }, { kind: 'inventory_reduction', inventoryId: a, quantity: '20' }] })
    const result = await chat(assistantRequestSchema.parse({ message: 'HYPOTHETICAL Qatar equipment: compare routes, forecast 10 kg/day with 5-day lead time, find a supplier and simulate a disruption.', allowSimulationCreation: true, approvedToolInputs: [{ tool: 'compare_routes', arguments: route }, { tool: 'forecast_inventory', arguments: { inventoryId: a, dailyDemand: 10, leadTimeDays: 5 } }, { tool: 'create_simulation', arguments: scenarioInput }] }), { complete: async ({ messages }) => {
      round++
      if (round === 1) return { calls: [call('compare_routes', route), call('forecast_inventory', { inventoryId: a, dailyDemand: 10, leadTimeDays: 5 }), call('search_suppliers', { productId: a, countryCodes: ['QA'] })] }
      if (round === 2) return { calls: [call('create_simulation', scenarioInput)] }
      if (round === 3) { const created = JSON.parse(messages.filter(m => m.role === 'tool').at(-1)!.content!); return { calls: [call('run_simulation', { id: created.data.id })] } }
      return { answer: { task: 'simulation', findings: [{ evidenceId: 'e1', pointer: '/engineVersion' },{ evidenceId: 'e2', pointer: '/availableStock' },{ evidenceId: 'e3', pointer: '/data/0/availability' },{ evidenceId: 'e5', pointer: '/engineVersion' }], recommendations: [{ action: 'review_scenario', evidenceIds: ['e5'] }] } }
    } }, dispatch)
    expect(result.status, JSON.stringify(result.errors)).toBe('ok')
    expect(result.evidence).toHaveLength(5); expect(result.findings[1]?.value).toBe('100.000000')
    expect(result.findings[2]?.value).toBe('unverified')
    expect(result.recommendations[0]?.action).toBe('review_scenario')
    expect(result.evidence[0]?.kind).toBe('hypothetical'); expect(result.evidence[4]?.kind).toBe('hypothetical')
    const scenarioId = (result.evidence[3]!.data as { id: string }).id
    const comparisonResponse = await dispatch('compare_simulation', { id: scenarioId })
    expect(comparisonResponse.status).toBe(200)
    const comparison = simulationOutputSchema.parse(await comparisonResponse.json())
    expect(comparison.baseline.routes.alternatives).toHaveLength(1)
    expect(comparison.simulated.routes.alternatives).toHaveLength(0)
    expect(Number(comparison.baseline.supply[0]?.shortage)).toBe(0)
    expect(Number(comparison.simulated.supply[0]?.shortage)).toBe(10)
    expect((await pg.query<{ quantity: string }>('select quantity::text from inventory')).rows[0]!.quantity).toBe('100.000')
    await pg.exec(`SELECT set_config('request.jwt.claim.sub','${b}',false)`)
    expect((await executeTool('forecast_inventory', { inventoryId: a }, dispatch, false))).toMatchObject({ ok: false, code: 'not_found' })
    expect((await executeTool('run_simulation', { id: scenarioId }, dispatch, false))).toMatchObject({ ok: false, code: 'not_found' })
    // Even absent a provider, domain endpoints remain operational for the owner.
    await pg.exec(`SELECT set_config('request.jwt.claim.sub','${a}',false)`)
    expect((await dispatch('compare_routes', route)).status).toBe(200)
    expect((await dispatch('forecast_inventory', { inventoryId: a })).status).toBe(200)
    expect((await dispatch('run_simulation', { id: scenarioId })).status).toBe(200)
  } finally { await pg.close() }
}, 30000)
