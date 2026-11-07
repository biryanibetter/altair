import { expect, it } from 'vitest'
import { testDatabase } from './database'
const a = '20000000-0000-4000-8000-000000000001', b = '20000000-0000-4000-8000-000000000002'
it('stores private conversations with two-owner isolation and atomic bounded admission', async () => {
  const { pg } = await testDatabase()
  try {
    await pg.exec(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
      INSERT INTO auth.users(id) VALUES ('${a}'),('${b}');
      SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${a}',false);`)
    const begin = async (cid: string | null = null) => (await pg.query<{ value: { conversationId: string; turnId: string; error?: string } }>('select begin_assistant_turn($1,$2) as value', [cid, 'synthetic question'])).rows[0]!.value
    const first = await begin()
    expect(first.conversationId).toBeTruthy(); expect(first.turnId).toBeTruthy()
    await pg.query('select finish_assistant_turn($1,$2)', [first.turnId, JSON.stringify({ status: 'degraded', evidence: [] })])
    await expect(pg.query('select finish_assistant_turn($1,$2)', [first.turnId, '{}'])).rejects.toThrow('assistant_turn_completed')
    expect((await pg.query('select * from assistant_turns')).rows).toHaveLength(1)
    await expect(pg.query('insert into assistant_turns(owner_id,conversation_id,message) values ($1,$2,$3)', [a, first.conversationId, 'bypass quota'])).rejects.toThrow()
    for (let i = 0; i < 5; i++) await begin(first.conversationId)
    await expect(begin(first.conversationId)).rejects.toThrow('assistant_rate_limited')
    await pg.exec(`SELECT set_config('request.jwt.claim.sub','${b}',false)`)
    expect((await pg.query('select * from assistant_turns')).rows).toHaveLength(0)
    expect((await pg.query('select * from assistant_conversations')).rows).toHaveLength(0)
    expect(await begin(first.conversationId)).toEqual({ error: 'not_found' })
    expect((await pg.query<{ value: unknown }>('select finish_assistant_turn($1,$2) as value', [first.turnId, '{}'])).rows[0]!.value).toBeNull()
    expect((await begin()).conversationId).not.toBe(first.conversationId)
    await pg.exec('SET ROLE anon')
    await expect(pg.query('select * from assistant_turns')).rejects.toThrow()
    await expect(pg.query("select begin_assistant_turn(null,'x')")).rejects.toThrow()
  } finally { await pg.close() }
}, 30000)
