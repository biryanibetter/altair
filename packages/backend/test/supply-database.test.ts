import { expect, it } from 'vitest'
import { testDatabase } from './database'
import { supplyFromRows, suppliersFromRows } from '../src/supply/rows'
import { createSupplyHandler, type SupplyStore } from '../src/supply/http'
import { matchSuppliers } from '../src/supply/suppliers'

const a = '20000000-0000-4000-8000-000000000001', b = '20000000-0000-4000-8000-000000000002'
it('enforces inventory ownership, atomic immutable movements, reservation limits and trusted supplier references', async () => {
  const { pg } = await testDatabase()
  try {
    await pg.exec(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
      INSERT INTO auth.users(id) VALUES ('${a}'),('${b}');
      INSERT INTO products(id,name) VALUES ('${a}','rice');
      INSERT INTO warehouses(id,owner_id,name) VALUES ('${a}','${a}','A'),('${b}','${b}','B');
      INSERT INTO inventory(id,owner_id,warehouse_id,product_id,quantity,unit,reserved_quantity) VALUES ('${a}','${a}','${a}','${a}',100,'kg',20);
      SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${a}',false);`)
    await pg.exec(`INSERT INTO inventory_movements(owner_id,inventory_id,kind,quantity,unit,occurred_at,idempotency_key) VALUES ('${a}','${a}','consumption',10,'kg',now(),'one')`)
    expect((await pg.query<{ quantity: string }>('SELECT quantity::text FROM inventory')).rows[0]?.quantity).toBe('90.000')
    await expect(pg.exec(`INSERT INTO inventory_movements(owner_id,inventory_id,kind,quantity,unit,occurred_at,idempotency_key) VALUES ('${a}','${a}','consumption',10,'kg',now(),'one')`)).rejects.toThrow()
    expect((await pg.query<{ quantity: string }>('SELECT quantity::text FROM inventory')).rows[0]?.quantity).toBe('90.000')
    await expect(pg.exec(`UPDATE inventory_movements SET quantity=1`)).rejects.toThrow()
    await expect(pg.exec('DELETE FROM inventory_movements')).rejects.toThrow()
    await expect(pg.exec(`INSERT INTO inventory_movements(owner_id,inventory_id,kind,quantity,unit,occurred_at,idempotency_key) VALUES ('${a}','${a}','consumption',1,'litre',now(),'two')`)).rejects.toThrow()
    await pg.exec(`INSERT INTO planned_orders(owner_id,inventory_id,quantity,reserved_quantity,unit,due_at) VALUES ('${a}','${a}',30,20,'kg',now())`)
    await expect(pg.exec(`INSERT INTO planned_orders(owner_id,inventory_id,quantity,reserved_quantity,unit,due_at) VALUES ('${a}','${a}',10,1,'kg',now())`)).rejects.toThrow()
    await expect(pg.exec(`UPDATE inventory SET reserved_quantity=0`)).rejects.toThrow()
    const store = { snapshot: async (id: string) => {
      const result = await pg.query<{ value: unknown }>('SELECT supply_inventory_snapshot($1) AS value', [id])
      return result.rows[0]?.value ? supplyFromRows(result.rows[0].value) : null
    } } as unknown as SupplyStore
    expect((await store.snapshot(a))?.supply.inventory.quantity).toBe('90.000')
    const handler = createSupplyHandler('forecast', async () => store)
    const response = await handler(new Request('http://localhost/api/v1/forecasts', { method: 'POST', body: JSON.stringify({ inventoryId: a, dailyDemand: 10, leadTimeDays: 5 }) }))
    expect(response.status).toBe(200)
    const forecast = await response.json()
    expect(forecast.availableStock).toBe('70.000000')
    expect(forecast.consumption.method).toBe('explicit_daily_demand')
    await expect(pg.exec(`INSERT INTO supplier_evidence(supplier_id,source_url,description,observed_at,expires_at,status) VALUES ('${a}','https://example.com','x',now(),now(),'confirmed')`)).rejects.toThrow()
    await pg.exec(`SELECT set_config('request.jwt.claim.sub','${b}',false)`)
    expect((await pg.query('SELECT * FROM inventory')).rows).toHaveLength(0)
    expect((await pg.query('SELECT * FROM inventory_movements')).rows).toHaveLength(0)
    expect((await pg.query('SELECT * FROM planned_orders')).rows).toHaveLength(0)
    expect((await handler(new Request('http://localhost/api/v1/forecasts', { method: 'POST', body: JSON.stringify({ inventoryId: a }) }))).status).toBe(404)
    await expect(pg.exec(`INSERT INTO planned_orders(owner_id,inventory_id,quantity,unit,due_at) VALUES ('${b}','${a}',1,'kg',now())`)).rejects.toThrow()
    await pg.exec('SET ROLE anon')
    await expect(pg.query('SELECT * FROM supplier_evidence')).rejects.toThrow()
    await pg.exec('RESET ROLE')
    await pg.exec(`DELETE FROM auth.users WHERE id='${a}'`)
    expect((await pg.query('SELECT * FROM inventory_movements')).rows).toHaveLength(0)
  } finally { await pg.close() }
}, 30000)

it('normalizes trusted supplier evidence through a single invoker snapshot', async () => {
  const { pg } = await testDatabase()
  try {
    await pg.exec(`INSERT INTO products(id,name) VALUES ('${a}','rice');
      INSERT INTO locations(id,name,kind,country_code) VALUES ('${a}','Doha','hub','QA');
      INSERT INTO suppliers(id,name,location_id,verification_status,verified_at,expires_at) VALUES ('${a}','Catalog supplier','${a}','verified','2026-10-01','2027-01-01');
      INSERT INTO supplier_evidence(id,supplier_id,source_url,description,observed_at,expires_at,status) VALUES ('${a}','${a}','https://example.com','Catalog product evidence','2026-10-01','2027-01-01','confirmed');
      INSERT INTO supplier_products(supplier_id,product_id,hs_code,classification,evidence_id) VALUES ('${a}','${a}','100630','HS2022','${a}');
      SET ROLE authenticated;`)
    const snapshot = await pg.query<{ value: unknown }>('SELECT supply_supplier_snapshot() AS value')
    const catalog = suppliersFromRows(snapshot.rows[0]?.value)
    expect(matchSuppliers(catalog, { productId: a, countryCodes: ['QA'] }, '2026-11-07T00:00:00.000Z').data[0]?.matchStatus).toBe('confirmed_catalog_match')
    await expect(pg.exec(`UPDATE suppliers SET verification_status='verified'`)).rejects.toThrow()
  } finally { await pg.close() }
}, 30000)
