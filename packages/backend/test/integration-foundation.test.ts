import { expect, it } from 'vitest'
import { createCatalogHandler, createShipmentHandler, type IntegrationStore } from '../src/integration/http'
import { monitoringConfigSchema, scenarioInputSchema, shipmentWriteSchema } from '@altair/shared/contracts'
import { testDatabase } from './database'
import { qatarRoutingDemo } from '../src/routing/demo'
import { createRouteHandler } from '../src/routing/http'
import { createIntelligenceHandler, type IntelligenceStore } from '../src/intelligence/http'
import { intelligenceFromRows, scenarioFromRow } from '../src/intelligence/rows'
import { createSupplyHandler, type SupplyStore } from '../src/supply/http'
import { suppliersFromRows, supplyFromRows } from '../src/supply/rows'
import { monitoringFromRows } from '../src/monitoring/rows'
import { evaluateMonitoring } from '../src/monitoring/evaluate'

const owner = '20000000-0000-4000-8000-000000000001'
const other = '20000000-0000-4000-8000-000000000002'
const item = '20000000-0000-4000-8000-000000000003'
const stock = '20000000-0000-4000-8000-000000000004'
const get = (path: string) => new Request(`http://localhost/api/v1/${path}`)
const post = (path: string, body: unknown) => new Request(`http://localhost/api/v1/${path}`, { method: 'POST', body: JSON.stringify(body) })

it('rejects anonymous and caller-owned fields without querying catalog or private data', async () => {
  expect((await createCatalogHandler('products', async () => null)(get('products'))).status).toBe(401)
  expect((await createShipmentHandler('create', async () => null)(post('shipments', {}))).status).toBe(401)
  expect(shipmentWriteSchema.safeParse({ productId: item, originId: item, destinationId: stock, quantity: '5', unit: 'kg', ownerId: owner }).success).toBe(false)
  const store = { list: async () => [] } as unknown as IntegrationStore
  expect((await createCatalogHandler('locations', async () => store)(get('locations?limit=2&limit=3'))).status).toBe(400)
  expect((await createCatalogHandler('products', async () => store)(get('products?countryCode=QA'))).status).toBe(400)
})

it('selects a hypothetical Qatar equipment catalog, creates and isolates a shipment under two identities', async () => {
  const { pg } = await testDatabase()
  try {
    const demo = qatarRoutingDemo()
    await pg.exec(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
      INSERT INTO auth.users(id) VALUES ('${owner}'),('${other}');`)
    for (const node of demo.network.nodes) await pg.query('INSERT INTO locations(id,name,kind,country_code,longitude,latitude) VALUES ($1,$2,$3,$4,$5,$6)', [node.id,node.name,node.kind,node.countryCode,node.coordinates?.[0],node.coordinates?.[1]])
    for (const edge of demo.network.edges) await pg.query('INSERT INTO transport_connections(id,origin_id,destination_id,mode,routing_metadata) VALUES ($1,$2,$3,$4,$5)', [edge.id,edge.originId,edge.destinationId,edge.mode,JSON.stringify(edge.metadata)])
    await pg.query('INSERT INTO products(id,name,hs_code) VALUES ($1,$2,$3)', [item,'HYPOTHETICAL essential equipment','90189000'])
    await pg.query('INSERT INTO suppliers(id,name,location_id,verification_status) VALUES ($1,$2,$3,$4)', [item,'HYPOTHETICAL Qatar equipment supplier',demo.network.nodes[1]!.id,'unverified'])
    await pg.query('INSERT INTO supplier_evidence(id,supplier_id,source_url,description,observed_at,expires_at,status) VALUES ($1,$2,$3,$4,$5,$6,$7)', [item,item,'https://example.org/hypothetical','Hypothetical catalog match; no actual stock','2026-10-01','2027-01-01','inferred'])
    await pg.query('INSERT INTO supplier_products(supplier_id,product_id,evidence_id) VALUES ($1,$2,$3)', [item,item,item])
    await pg.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${owner}',false)`)
    const store = {
      async list(resource: string, limit: number, cursor?: string, countryCode?: string) {
        const table = { products: 'products', locations: 'locations', warehouses: 'warehouses', shipments: 'shipments' }[resource]
        if (!table) throw Error('invalid table')
        const rows = await pg.query(`SELECT * FROM ${table} WHERE ($1::uuid IS NULL OR id>$1::uuid) ${resource === 'locations' && countryCode ? 'AND country_code=$3' : ''} ORDER BY id LIMIT $2`, resource === 'locations' && countryCode ? [cursor ?? null,limit,countryCode] : [cursor ?? null,limit])
        return rows.rows
      },
      async getShipment(id: string) { return (await pg.query('SELECT * FROM shipments WHERE id=$1', [id])).rows[0] ?? null },
      async createWarehouse(input: Record<string, unknown>) { return (await pg.query('INSERT INTO warehouses(owner_id,name,location_id) VALUES (auth.uid(),$1,$2) RETURNING *', [input.name,input.locationId])).rows[0] },
      async createShipment(input: Record<string, unknown>) { return (await pg.query('INSERT INTO shipments(owner_id,product_id,origin_id,destination_id,supplier_id,quantity,unit,route_request) VALUES (auth.uid(),$1,$2,$3,$4,$5,$6,$7) RETURNING *', [input.productId,input.originId,input.destinationId,input.supplierId,input.quantity,input.unit,JSON.stringify(input.routeRequest)])).rows[0] },
    } as IntegrationStore
    const authorize = async () => store
    const products = await createCatalogHandler('products', authorize)(get('products'))
    expect((await products.json()).data[0].name).toContain('HYPOTHETICAL')
    const locations = await createCatalogHandler('locations', authorize)(get('locations?countryCode=QA'))
    expect((await locations.json()).data).toHaveLength(2)
    const warehouse = await createCatalogHandler('warehouses', authorize)(post('warehouses', { name: 'HYPOTHETICAL Qatar warehouse', locationId: demo.network.nodes[1]!.id }), 'create')
    expect(warehouse.status).toBe(201)
    const warehouseId = (await warehouse.json()).id as string
    await pg.query('INSERT INTO inventory(owner_id,id,product_id,warehouse_id,quantity,unit) VALUES (auth.uid(),$1,$2,$3,$4,$5)', [stock,item,warehouseId,'100','kg'])
    const input = { productId: item, originId: demo.network.nodes[0]!.id, destinationId: demo.network.nodes[1]!.id, supplierId: item, quantity: '40', unit: 'kg', routeRequest: { originId: demo.network.nodes[0]!.id, destinationId: demo.network.nodes[1]!.id, preferences: { allowHypothetical: true } } }
    const created = await createShipmentHandler('create', authorize)(post('shipments', input))
    expect(created.status).toBe(201)
    const shipment = await created.json()
    expect(shipment.productId).toBe(item)
    expect((await createShipmentHandler('read', authorize)(get(`shipments/${shipment.id}`), shipment.id)).status).toBe(200)
    const value = async (sql: string, params: unknown[] = []) => (await pg.query<{ value: unknown }>(sql, params)).rows[0]?.value
    const intelligence = async () => intelligenceFromRows(await value('select intelligence_snapshot() as value'), new Date().toISOString())
    const comparison = await createRouteHandler(async () => ({ network: async () => (await intelligence()).network }))(post('routes/compare', input.routeRequest))
    expect(comparison.status).toBe(200)
    expect((await comparison.json()).alternatives.length).toBeGreaterThan(0)
    const simulations = {
      create: async (scenario, version) => scenarioFromRow(await value('select create_simulation($1,$2) as value', [JSON.stringify(scenario),version])),
      get: async id => { const row = await value('select to_jsonb(s) as value from scenarios s where id=$1', [id]); return row ? scenarioFromRow(row) : null },
      save: async (id, output) => scenarioFromRow(await value('select finish_simulation($1,$2) as value', [id,JSON.stringify(output)])),
    } as IntelligenceStore
    const scenario = scenarioInputSchema.parse({ name: 'HYPOTHETICAL equipment disruption', routeRequest: input.routeRequest, hypothetical: true, demand: [{ productId: item, unit: 'kg', quantity: '95' }], modifications: [{ kind: 'connection', edgeId: demo.network.edges[0]!.id, closed: true }, { kind: 'inventory_reduction', inventoryId: stock, quantity: '20' }] })
    const createdScenario = await createIntelligenceHandler('create', async () => simulations)(post('scenarios', scenario))
    expect(createdScenario.status).toBe(201)
    const scenarioId = (await createdScenario.json()).id as string
    expect((await createIntelligenceHandler('execute', async () => simulations)(new Request('http://localhost/api/v1/scenarios/execute', { method: 'POST' }), scenarioId)).status).toBe(200)
    const replay = await createIntelligenceHandler('compare', async () => simulations)(get('scenarios/compare'), scenarioId)
    expect(replay.status).toBe(200)
    const changes = await replay.json()
    expect(changes.simulated.routes.alternatives.length).toBeLessThan(changes.baseline.routes.alternatives.length)
    expect(Number(changes.simulated.supply[0].shortage)).toBeGreaterThan(Number(changes.baseline.supply[0].shortage))
    const supply = {
      snapshot: async id => { const row = await value('select supply_inventory_snapshot($1) as value', [id]); return row ? supplyFromRows(row) : null },
      suppliers: async () => suppliersFromRows(await value('select supply_supplier_snapshot() as value')),
    } as SupplyStore
    const forecast = await createSupplyHandler('forecast', async () => supply)(post('forecasts', { inventoryId: stock, dailyDemand: 10, leadTimeDays: 5 }))
    expect(forecast.status).toBe(200)
    expect((await forecast.json()).availableStock).toBe('100.000000')
    const suppliers = await createSupplyHandler('suppliers', async () => supply)(post('suppliers/search', { productId: item, countryCodes: ['QA'] }))
    expect(suppliers.status).toBe(200)
    expect((await suppliers.json()).data[0]).toMatchObject({ id: item, availability: 'unverified' })
    const config = monitoringConfigSchema.parse({ inventories: [{ inventoryId: stock, dailyDemand: 10, leadTimeDays: 5 }] })
    await pg.query('insert into monitoring_settings(owner_id,config) values (auth.uid(),$1)', [JSON.stringify(config)])
    const snapshot = monitoringFromRows(await value('select monitoring_snapshot() as value'))
    const evaluation = evaluateMonitoring(snapshot.context, snapshot.config)
    expect(evaluation.candidates.some(c => c.rule === 'potential_stockout')).toBe(true)
    await value('select reconcile_monitoring($1,$2,$3,$4) as value', [snapshot.revision,evaluation.evaluatedAt,JSON.stringify(evaluation.candidates),JSON.stringify(evaluation.evaluatedKeys)])
    expect((await pg.query('select * from alerts')).rows).toHaveLength(1)
    await pg.exec(`SELECT set_config('request.jwt.claim.sub','${other}',false)`)
    expect((await createShipmentHandler('read', authorize)(get(`shipments/${shipment.id}`), shipment.id)).status).toBe(404)
    const listing = await createShipmentHandler('list', authorize)(get('shipments'))
    expect((await listing.json()).data).toEqual([])
    const warehouses = await createCatalogHandler('warehouses', authorize)(get('warehouses'))
    expect((await warehouses.json()).data).toEqual([])
    expect((await createIntelligenceHandler('compare', async () => simulations)(get('scenarios/compare'), scenarioId)).status).toBe(404)
    expect((await createSupplyHandler('forecast', async () => supply)(post('forecasts', { inventoryId: stock, dailyDemand: 10 }))).status).toBe(404)
    expect((await pg.query('select * from alerts')).rows).toHaveLength(0)
    await pg.exec(`SELECT set_config('request.jwt.claim.sub','${owner}',false)`)
    expect((await createShipmentHandler('read', authorize)(get(`shipments/${shipment.id}`), shipment.id)).status).toBe(200)
  } finally { await pg.close() }
}, 30000)
