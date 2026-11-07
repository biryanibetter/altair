import { afterEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('../supabase/server', () => ({ createSupabaseServerClient: vi.fn() }))
import { createSupabaseServerClient } from '../supabase/server'
import { POST } from '../../app/api/v1/assistant/chat/route'
afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers() })
it('actual assistant Next handler rejects unverified identities', async () => {
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as never)
  expect((await POST(new Request('http://localhost/api/v1/assistant/chat', { method: 'POST', body: '{}' }))).status).toBe(401)
  expect(vi.mocked(createSupabaseServerClient).mock.calls[0]?.[0]).toBeTypeOf('function')
})
const id = '10000000-0000-4000-8000-000000000001'
function query(data: unknown) {
  const q = { select: vi.fn(), eq: vi.fn(), neq: vi.fn(), order: vi.fn(), limit: vi.fn(async () => ({ data, error: null })) }
  for (const key of ['select','eq','neq','order'] as const) q[key].mockReturnValue(q)
  return q
}
it('actual authenticated handler dispatches owned inventory, validates mocked model output and privately saves the answer', async () => {
  vi.stubEnv('ALTAIR_LLM_PROVIDER','openrouter'); vi.stubEnv('ALTAIR_LLM_MODEL','openrouter/free'); vi.stubEnv('OPENROUTER_API_KEY','synthetic-test-key')
  const history = query([]), records = query([{ id, product_id: id, warehouse_id: id, quantity: '42', reserved_quantity: '0', unit: 'kg', history_start: null }])
  const rpc = vi.fn(async (name: string) => ({ data: name === 'begin_assistant_turn' ? { conversationId: id, turnId: id } : { id }, error: null }))
  const storage = { auth: { getUser: async () => ({ data: { user: { id } }, error: null }) }, rpc, from: vi.fn(() => history) }
  const tools = { from: vi.fn(() => records) }
  vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(storage as never).mockResolvedValueOnce(tools as never)
  let round = 0
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ choices: [{ finish_reason: ++round === 1 ? 'tool_calls' : 'stop', message: round === 1 ? { content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'inspect_inventory', arguments: '{}' } }] } : { content: JSON.stringify({ task: 'inventory', findings: [{ evidenceId: 'e1', pointer: '/data/0/quantity' }], recommendations: [{ action: 'verify_records', evidenceIds: ['e1'] }] }) } }] })))
  const res = await POST(new Request('http://localhost/api/v1/assistant/chat', { method: 'POST', body: JSON.stringify({ message: 'Inspect my stock' }) }))
  expect(res.status).toBe(200)
  expect((await res.json()).findings[0]).toMatchObject({ value: '42', kind: 'fact' })
  expect(records.eq).toHaveBeenCalledWith('owner_id', id); expect(history.eq).toHaveBeenCalledWith('owner_id', id)
  expect(rpc).toHaveBeenCalledWith('finish_assistant_turn', expect.objectContaining({ turn_id: id, result: expect.objectContaining({ status: 'ok' }) }))
  expect(tools.from).toHaveBeenCalledWith('inventory'); expect(storage.from).toHaveBeenCalledWith('assistant_turns')
})
it('separates the aborted tool transport from the reserved persistence transport', async () => {
  vi.useFakeTimers(); vi.stubEnv('OPENROUTER_API_KEY','')
  vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => { const c = new AbortController(); setTimeout(() => c.abort(new DOMException('deadline', 'TimeoutError')), ms); return c.signal })
  const history = query([]), rpc = vi.fn(async (name: string) => ({ data: name === 'begin_assistant_turn' ? { conversationId: id, turnId: id } : { id }, error: null }))
  const storage = { auth: { getUser: async () => ({ data: { user: { id } }, error: null }) }, rpc, from: () => history }
  vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(storage as never).mockResolvedValueOnce({} as never)
  await POST(new Request('http://localhost/api/v1/assistant/chat', { method: 'POST', body: JSON.stringify({ message: 'help' }) }))
  const storageFetch = vi.mocked(createSupabaseServerClient).mock.calls[0]![0]!, toolFetch = vi.mocked(createSupabaseServerClient).mock.calls[1]![0]!
  vi.stubGlobal('fetch', vi.fn(async (_url, init) => { init.signal.throwIfAborted(); return Response.json({}) }))
  await vi.advanceTimersByTimeAsync(45001)
  await expect(toolFetch('https://example.org')).rejects.toThrow()
  expect((await storageFetch('https://example.org')).status).toBe(200)
})
