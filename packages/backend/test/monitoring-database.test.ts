import { expect, it } from 'vitest'
import { testDatabase } from './database'
import { monitoringConfigSchema } from '@altair/shared/contracts'
import { monitoringFromRows } from '../src/monitoring/rows'

const a = '20000000-0000-4000-8000-000000000001', b = '20000000-0000-4000-8000-000000000002'
it('isolates monitoring and serializes deduplication, acknowledgment, resolution, reopening and old evaluations', async () => {
  const { pg } = await testDatabase()
  try {
    await pg.exec(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
      INSERT INTO auth.users(id) VALUES ('${a}'),('${b}');
      INSERT INTO shipments(id,owner_id,status) VALUES ('${a}','${a}','in_transit'),('${b}','${b}','in_transit');
      SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${a}',false);`)
    await pg.query('insert into monitoring_settings(owner_id,config) values ($1,$2)', [a, JSON.stringify(monitoringConfigSchema.parse({}))])
    const snap = (await pg.query<{ value: { revision: string; evaluatedAt: string } }>('select monitoring_snapshot() as value')).rows[0]!.value
    await expect(pg.query('update monitoring_settings set config=$1 where owner_id=$2', [JSON.stringify(monitoringConfigSchema.parse({ shipments: [{ shipmentId: a, edgeIds: ['10000000-0000-4000-8000-000000000099'] }] })), a])).rejects.toThrow('monitoring_route_mapping_unavailable')
    const candidate = { dedupKey: `stale_shipment:shipment:${a}`, rule: 'stale_shipment', targetKind: 'shipment', targetId: a, severity: 'high', title: 'Stale fixture shipment', action: 'Contact carrier', evidence: ['fixture owner update'] }
    let tick = Date.parse(snap.evaluatedAt)
    const reconcile = (candidates: unknown[], keys: string[], at = new Date(++tick).toISOString(), revision = snap.revision) => pg.query('select reconcile_monitoring($1,$2,$3,$4) as value', [revision, at, JSON.stringify(candidates), JSON.stringify(keys)])
    await reconcile([candidate, candidate], [candidate.dedupKey])
    let alerts = (await pg.query<Record<string, unknown>>('select * from alerts')).rows
    expect(alerts).toHaveLength(1); expect(alerts[0]?.notification_count).toBe(1)
    const alertId = alerts[0]!.id
    await pg.query("select transition_alert($1,'acknowledged')", [alertId])
    const acknowledged = (await pg.query<Record<string, unknown>>('select * from alerts')).rows[0]!
    await reconcile([candidate], [candidate.dedupKey])
    alerts = (await pg.query<Record<string, unknown>>('select * from alerts')).rows
    expect(alerts[0]?.state).toBe('acknowledged')
    expect(alerts[0]?.notification_count).toBe(1)
    expect(alerts[0]?.updated_at).toEqual(acknowledged.updated_at)
    await reconcile([], []) // provider failure/unknown is NOT a cleared condition
    expect((await pg.query<{ state: string }>('select state from alerts')).rows[0]?.state).toBe('acknowledged')
    await reconcile([], [candidate.dedupKey])
    expect((await pg.query<{ state: string }>('select state from alerts')).rows[0]?.state).toBe('resolved')
    await reconcile([candidate], [candidate.dedupKey])
    alerts = (await pg.query<Record<string, unknown>>('select * from alerts')).rows
    expect(alerts[0]?.state).toBe('open'); expect(alerts[0]?.occurrence).toBe(2); expect(alerts[0]?.notification_count).toBe(2)
    await reconcile([{ ...candidate, severity: 'medium', evidence: ['updated fixture evidence'] }], [candidate.dedupKey])
    expect((await pg.query<{ notification_count: number }>('select notification_count from alerts')).rows[0]?.notification_count).toBe(2)
    await pg.query("select transition_alert($1,'acknowledged')", [alertId])
    await reconcile([{ ...candidate, severity: 'critical' }], [candidate.dedupKey])
    expect((await pg.query<{ state: string; notification_count: number }>('select state,notification_count from alerts')).rows[0]).toMatchObject({ state: 'open', notification_count: 3 })
    await expect(reconcile([], [candidate.dedupKey], snap.evaluatedAt)).rejects.toThrow('monitoring_evaluation_superseded')
    await pg.query('update monitoring_settings set config=$1 where owner_id=$2', [JSON.stringify(monitoringConfigSchema.parse({ staleShipmentHours: 48 })), a])
    await expect(reconcile([], [candidate.dedupKey])).rejects.toThrow('monitoring_configuration_changed')
    await pg.exec(`SELECT set_config('request.jwt.claim.sub','${b}',false)`)
    expect((await pg.query('select * from alerts')).rows).toHaveLength(0)
    expect((await pg.query('select * from monitoring_settings')).rows).toHaveLength(0)
    await expect(pg.query('insert into monitoring_settings(owner_id,config) values ($1,$2)', [b, JSON.stringify(monitoringConfigSchema.parse({ shipments: [{ shipmentId: a, edgeIds: ['10000000-0000-4000-8000-000000000001'] }] }))])).rejects.toThrow()
    expect((await pg.query<{ value: unknown }>('select transition_alert($1,$2) as value', [alertId, 'resolved'])).rows[0]?.value).toBeNull()
    await expect(pg.query('insert into alerts(owner_id,title,target_kind,target_id,rule,dedup_key) values ($1,$2,$3,$4,$5,$6)', [b, 'cross owner', 'shipment', a, 'stale_shipment', `stale_shipment:shipment:${a}`])).rejects.toThrow()
    await pg.exec('SET ROLE anon')
    await expect(pg.query('select monitoring_snapshot()')).rejects.toThrow()
    await expect(pg.query('select * from alerts')).rejects.toThrow()
  } finally { await pg.close() }
}, 30000)
it('selects latest relevant road evidence before bounding the monitoring snapshot', async () => {
  const { pg } = await testDatabase()
  try {
    await pg.exec(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
      INSERT INTO auth.users(id) VALUES ('${a}');
      INSERT INTO locations(id,name,kind,country_code) VALUES ('${a}','A','hub','QA'),('${b}','B','hub','QA');
      INSERT INTO transport_connections(id,origin_id,destination_id,mode) VALUES ('${a}','${a}','${b}','land');
      INSERT INTO provider_observations(job,provider,record_key,source_id,source_url,license,kind,nature,observed_at,fetched_at,expires_at,data)
      SELECT 'here-flow','here','history-'||n,'00000000-0000-4000-8000-000000000006','https://example.org','fixture','traffic','live',now()-n*interval '1 second',now(),now()+interval '1 hour',
       jsonb_build_object('kind','traffic','providerId','road1','latitude',25,'longitude',51,'status','open','speedMps',10,'jamFactor',0,'validUntil',null,'freshUntil',to_char((now()+interval '5 minutes') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'evidenceOnly',true)
      FROM generate_series(1,6000) n;`)
    const config = monitoringConfigSchema.parse({ trafficMappings: [{ providerId: 'road1', edgeIds: [a] }] })
    await pg.query('insert into monitoring_settings(owner_id,config) values ($1,$2)', [a, JSON.stringify(config)])
    await pg.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${a}',false)`)
    const raw = (await pg.query<{ value: unknown }>('select monitoring_snapshot() as value')).rows[0]!.value
    const snapshot = monitoringFromRows(raw)
    expect(snapshot.context.observations).toHaveLength(1)
    expect(snapshot.context.observations[0]?.recordKey).toBe('history-1')
  } finally { await pg.close() }
}, 30000)
