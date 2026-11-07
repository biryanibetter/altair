import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { testDatabase } from './database'
import { id, graph, now, request } from './routing-fixtures'
import { snapshotFromRows, scenarioFromRow } from '../src/intelligence/rows'
import { simulateScenario, TWIN_ENGINE_VERSION } from '../src/intelligence/scenarios'
import { scenarioInputSchema } from '@altair/shared/contracts'

describe('PostgreSQL private immutable scenario snapshots', () => {
  let db: Awaited<ReturnType<typeof testDatabase>>
  const userA = id(201), userB = id(202)
  let scenarioId: string
  const input = scenarioInputSchema.parse({ name: 'HYPOTHETICAL Qatar connection closure', routeRequest: request(), horizonHours: 24, hypothetical: true, modifications: [{ kind: 'connection', edgeId: id(13), closed: true }] })
  beforeAll(async () => {
    db = await testDatabase()
    await db.pg.exec(`create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
      insert into auth.users(id) values ('${userA}'),('${userB}');`)
    for (const n of graph().nodes) await db.pg.query('insert into locations(id,name,kind,country_code) values ($1,$2,$3,$4)', [n.id, n.name, n.kind, n.countryCode])
    for (const e of graph().edges) await db.pg.query('insert into transport_connections(id,origin_id,destination_id,mode,routing_metadata) values ($1,$2,$3,$4,$5)', [e.id, e.originId, e.destinationId, e.mode, JSON.stringify(e.metadata)])
    await db.pg.exec(`insert into products(id,name) values ('${id(51)}','Hypothetical grain');
      insert into warehouses(id,owner_id,name) values ('${id(52)}','${userA}','A'),('${id(53)}','${userB}','B');
      insert into inventory(id,owner_id,warehouse_id,product_id,quantity,unit) values ('${id(50)}','${userA}','${id(52)}','${id(51)}',100,'kg'),('${id(54)}','${userB}','${id(53)}','${id(51)}',999,'kg');
      set role authenticated; select set_config('request.jwt.claim.sub','${userA}',false);`)
  }, 30000)
  afterAll(async () => { await db?.pg.close() })
  it('captures a consistent owner-only baseline and enforces immutable inputs/snapshots', async () => {
    const invalid = { ...input, modifications: [{ kind: 'connection', edgeId: id(999), closed: true }] }
    await expect(db.pg.query('select create_simulation($1::jsonb,$2)', [JSON.stringify(invalid), TWIN_ENGINE_VERSION])).rejects.toThrow('invalid_scenario_targets')
    expect((await db.pg.query('select * from scenarios')).rows).toHaveLength(0)
    const before = await db.pg.query('select * from inventory order by id')
    const r = await db.pg.query<{ value: Record<string, unknown> }>('select create_simulation($1::jsonb,$2) as value', [JSON.stringify(input), TWIN_ENGINE_VERSION])
    scenarioId = String(r.rows[0].value.id)
    const record = scenarioFromRow(r.rows[0].value)
    expect(record.snapshot.inventory).toHaveLength(1); expect(record.snapshot.inventory[0].quantity).toBe('100.000')
    expect(record.snapshot.evaluatedAt).not.toBe(now)
    await expect(db.pg.query('update scenarios set baseline_snapshot=$1 where id=$2', ['{}', scenarioId])).rejects.toThrow()
    await expect(db.pg.query('update scenarios set simulation_input=$1 where id=$2', ['{}', scenarioId])).rejects.toThrow()
    const result = simulateScenario(record.snapshot, record.input, record.engineVersion)
    await db.pg.query('select finish_simulation($1,$2::jsonb)', [scenarioId, JSON.stringify(result)])
    const same = await db.pg.query<{ value: Record<string, unknown> }>('select to_jsonb(s) as value from scenarios s where id=$1', [scenarioId])
    const persisted = scenarioFromRow(same.rows[0].value)
    expect(persisted.output).toEqual(result)
    const summaries = await db.pg.query<{ id: string; executed: boolean }>('select * from list_simulations(1,null)')
    expect(summaries.rows[0].id).toBe(scenarioId); expect(summaries.rows[0].executed).toBe(true)
    expect(Object.keys(summaries.rows[0])).not.toContain('simulation_output')
    expect(await db.pg.query('select * from inventory order by id')).toEqual(before)
    await db.pg.query('select finish_simulation($1,$2::jsonb)', [scenarioId, JSON.stringify(result)])
    await expect(db.pg.query('select finish_simulation($1,$2::jsonb)', [scenarioId, '{}'])).rejects.toThrow()
    await db.pg.exec('reset role; update transport_connections set routing_metadata=null; set role authenticated;')
    expect(simulateScenario(persisted.snapshot, persisted.input, persisted.engineVersion)).toEqual(result)
  })
  it('masks other owners and denies direct snapshot changes, cross-owner references and anon', async () => {
    await db.pg.exec(`select set_config('request.jwt.claim.sub','${userB}',false)`)
    expect((await db.pg.query('select * from scenarios where id=$1', [scenarioId])).rows).toHaveLength(0)
    expect((await db.pg.query('select finish_simulation($1,$2::jsonb) as value', [scenarioId, '{}'])).rows[0]).toEqual({ value: null })
    await expect(db.pg.query('insert into scenarios(owner_id,name,simulation_input,engine_version) values ($1,$2,$3,$4)', [userA, 'forged', JSON.stringify(input), TWIN_ENGINE_VERSION])).rejects.toThrow()
    const own = await db.pg.query<{ value: Record<string, unknown> }>('select create_simulation($1::jsonb,$2) as value', [JSON.stringify(input), TWIN_ENGINE_VERSION])
    expect(snapshotFromRows(own.rows[0].value.baseline_snapshot).inventory[0].quantity).toBe('999.000')
    await db.pg.exec('reset role; set role anon')
    await expect(db.pg.exec('select * from scenarios')).rejects.toThrow()
    await expect(db.pg.query('select create_simulation($1::jsonb,$2)', [JSON.stringify(input), TWIN_ENGINE_VERSION])).rejects.toThrow()
  })
})
