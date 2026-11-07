import { expect, it } from 'vitest'
import { testDatabase } from './database'
import { runMonitoring } from '../src/monitoring/runner'
import { monitoringConfigSchema, forecastRequestSchema } from '@altair/shared/contracts'

const a = '20000000-0000-4000-8000-000000000001', b = '20000000-0000-4000-8000-000000000002'
it('runs scheduled evaluations under each owner RLS, bounds work, suppresses repeats and isolates failures', async () => {
  const { pg, database } = await testDatabase()
  try {
    await pg.exec(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
      INSERT INTO auth.users(id) VALUES ('${a}'),('${b}');
      INSERT INTO shipments(id,owner_id,status,updated_at) VALUES ('${a}','${a}','in_transit',now()-interval '2 days'),('${b}','${b}','in_transit',now()-interval '3 days');`)
    for (const owner of [a, b]) await pg.query('insert into monitoring_settings(owner_id,config) values ($1,$2)', [owner, JSON.stringify(monitoringConfigSchema.parse({}))])
    const result = await runMonitoring(database)
    expect(result).toMatchObject({ evaluated: 2, failed: 0, changed: 2 })
    const rows = (await pg.query<{ owner_id: string; target_id: string; notification_count: number }>('select owner_id,target_id,notification_count from alerts order by owner_id')).rows
    expect(rows).toEqual([{ owner_id: a, target_id: a, notification_count: 1 }, { owner_id: b, target_id: b, notification_count: 1 }])
    expect(await runMonitoring(database)).toMatchObject({ evaluated: 0, failed: 0, changed: 0 })
    await pg.exec("update monitoring_settings set last_attempt_at=null; update monitoring_settings set config='{\"unknown\":true}'::jsonb where owner_id='" + a + "'")
    const failed = await runMonitoring(database)
    expect(failed).toMatchObject({ evaluated: 1, failed: 1, changed: 0 })
    expect((await pg.query('select * from alerts')).rows).toHaveLength(2)
    expect(JSON.stringify(failed)).not.toContain(a)
  } finally { await pg.close() }
}, 30000)
it('reads real owned stock snapshots through the existing forecast engine without changing stock', async () => {
  const { pg, database } = await testDatabase()
  try {
    await pg.exec(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
      INSERT INTO auth.users(id) VALUES ('${a}'); INSERT INTO products(id,name) VALUES ('${a}','Fixture rice');
      INSERT INTO warehouses(id,owner_id,name) VALUES ('${a}','${a}','Fixture stock');
      INSERT INTO inventory(id,owner_id,warehouse_id,product_id,quantity,unit) VALUES ('${a}','${a}','${a}','${a}',100,'kg');`)
    const config = monitoringConfigSchema.parse({ inventories: [forecastRequestSchema.parse({ inventoryId: a, dailyDemand: 10, horizonDays: 14, leadTimeDays: 2 })] })
    await pg.query('insert into monitoring_settings(owner_id,config) values ($1,$2)', [a, JSON.stringify(config)])
    expect(await runMonitoring(database)).toMatchObject({ evaluated: 1, failed: 0, changed: 1 })
    expect((await pg.query<{ rule: string; target_id: string }>('select rule,target_id from alerts')).rows[0]).toMatchObject({ rule: 'potential_stockout', target_id: a })
    expect((await pg.query<{ quantity: string }>('select quantity::text from inventory')).rows[0]?.quantity).toBe('100.000')
  } finally { await pg.close() }
}, 30000)
