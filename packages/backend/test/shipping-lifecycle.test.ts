import { expect, it } from 'vitest'
import { testDatabase } from './database'
const owner = '40000000-0000-4000-8000-000000000001', other = '40000000-0000-4000-8000-000000000002', shipment = '40000000-0000-4000-8000-000000000003'
it('atomically records attributed milestones and request responses with immutable owner-isolated audit', async () => {
  const { pg } = await testDatabase()
  try {
    await pg.exec(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth TO authenticated; INSERT INTO auth.users(id) VALUES ('${owner}'),('${other}'); INSERT INTO shipments(id,owner_id,status) VALUES ('${shipment}','${owner}','planned'); SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${owner}',false);`)
    const call = async (input: unknown) => (await pg.query<{ value: { id: string } }>('select shipping_event($1,$2) as value', [shipment, JSON.stringify(input)])).rows[0]!.value
    const event = await call({ kind: 'milestone', title: 'Departed', note: 'Owner recorded', source: 'owner', status: 'in_transit', occurredAt: '2026-11-07T08:00:00Z', idempotencyKey: 'first' })
    expect(event.id).toBeTruthy()
    expect((await pg.query<{ status: string }>('select status from shipments')).rows[0]!.status).toBe('in_transit')
    expect((await call({ kind: 'milestone', title: 'Departed', note: 'Owner recorded', source: 'owner', status: 'in_transit', occurredAt: '2026-11-07T08:00:00Z', idempotencyKey: 'first' })).id).toBe(event.id)
    const request = await call({ kind: 'reroute_request', title: 'Land alternative', note: 'Please review', source: 'owner', idempotencyKey: 'request' })
    expect((await pg.query<{ status: string }>('select status from shipments')).rows[0]!.status).toBe('in_transit')
    await call({ kind: 'partner_response', title: 'Partner declined', note: 'Forwarder email reference 42', source: 'owner', requestId: request.id, decision: 'rejected', idempotencyKey: 'response' })
    await expect(call({ kind: 'partner_response', title: 'Duplicate', note: 'Duplicate', source: 'owner', requestId: request.id, decision: 'confirmed', idempotencyKey: 'response2' })).rejects.toThrow()
    await expect(pg.exec('delete from shipment_events')).rejects.toThrow()
    await pg.exec(`SELECT set_config('request.jwt.claim.sub','${other}',false)`)
    expect((await pg.query('select * from shipment_events')).rows).toHaveLength(0)
    expect(await call({ kind: 'note', title: 'No access', note: 'No access', source: 'owner', idempotencyKey: 'other' })).toBeNull()
  } finally { await pg.close() }
}, 30000)
