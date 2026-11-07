import { expect, it, vi } from 'vitest'
import { createAssistantHandler, AssistantAdmissionError } from '../src/assistant/http'
const id = '10000000-0000-4000-8000-000000000001'
const post = (body: unknown) => new Request('http://localhost/api/v1/assistant/chat', { method: 'POST', body: JSON.stringify(body) })
it('authenticates before parsing input, rejects oversized/invalid bodies and does not accept caller ownership', async () => {
  expect((await createAssistantHandler(async () => null)(post({}))).status).toBe(401)
  const begin = vi.fn()
  const auth = async () => ({ store: { begin, finish: vi.fn() }, provider: { complete: vi.fn() }, dispatch: vi.fn() })
  for (const body of [{ message: 'x', ownerId: id }, { message: 'x'.repeat(18000) }, {}]) expect((await createAssistantHandler(auth)(post(body))).status).toBe(400)
  expect(begin).not.toHaveBeenCalled()
})
it('persists safe degraded outcomes when provider is disabled and returns private record IDs/no-store', async () => {
  const finish = vi.fn(async () => {})
  const handler = createAssistantHandler(async () => ({ store: { begin: async () => ({ conversationId: id, turnId: id, history: [] }), finish }, provider: { complete: async () => { throw Error('secret-key') } }, dispatch: vi.fn() }))
  const response = await handler(post({ message: 'Help' }))
  expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.json()).toMatchObject({ status: 'degraded', conversationId: id, turnId: id, evidence: [] })
  expect(finish).toHaveBeenCalledOnce()
})
it('returns sanitized quota/access/storage failures without calling a provider', async () => {
  for (const [code, status] of [['rate_limited', 429], ['not_found', 404], ['storage_unavailable', 503]] as const) {
    const provider = { complete: vi.fn() }
    const handler = createAssistantHandler(async () => ({ provider, dispatch: vi.fn(), store: { begin: async () => { throw new AssistantAdmissionError(code) }, finish: vi.fn() } }))
    const res = await handler(post({ message: 'Help' })); expect(res.status).toBe(status); expect(provider.complete).not.toHaveBeenCalled()
    if (status === 429) expect(res.headers.get('retry-after')).toBe('60')
  }
})
it('honors the request-wide model deadline while still persisting a degraded result', async () => {
  const provider = { complete: vi.fn() }, finish = vi.fn(async () => {})
  const controller = new AbortController()
  const handler = createAssistantHandler(async () => ({ signal: controller.signal, provider, dispatch: vi.fn(), store: { begin: async () => { controller.abort(); return { conversationId: id, turnId: id, history: [] } }, finish } }))
  const response = await handler(post({ message: 'help' }))
  expect((await response.json()).errors).toEqual([{ code: 'request_timeout' }])
  expect(provider.complete).not.toHaveBeenCalled(); expect(finish).toHaveBeenCalledOnce()
})
it('persists collected evidence when cancellation occurs during a later tool', async () => {
  const controller = new AbortController(), finish = vi.fn(async () => {})
  let round = 0
  const handler = createAssistantHandler(async () => ({ signal: controller.signal, store: { begin: async () => ({ conversationId: id, turnId: id, history: [] }), finish }, provider: { complete: async () => ({ calls: [{ id: `c${round}`, name: ++round === 1 ? 'inspect_inventory' : 'inspect_shipment', arguments: round === 1 ? '{}' : JSON.stringify({ id }) }] }) }, dispatch: async (name, _args, signal) => {
    if (name === 'inspect_inventory') return Response.json({ version: 'supply-1.0.0', data: [{ id, productId: id, warehouseId: id, quantity: '42', reservedQuantity: '0', unit: 'kg', historyStart: null }], nextCursor: null })
    queueMicrotask(() => controller.abort())
    return new Promise<Response>((_resolve, reject) => signal?.addEventListener('abort', () => reject(Error('cancelled')), { once: true }))
  } }))
  const response = await handler(post({ message: 'Inspect my records' }))
  expect(response.status).toBe(200)
  expect((await response.json()).evidence).toHaveLength(1)
  expect(finish).toHaveBeenCalledWith(id, expect.objectContaining({ status: 'degraded', evidence: expect.arrayContaining([expect.objectContaining({ tool: 'inspect_inventory' })]) }))
})
