import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { api, ApiError, collectPages } from './api'

afterEach(() => vi.unstubAllGlobals())
describe('authenticated API transport', () => {
  it('preserves empty mutation bodies required by scenario execution', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ok: true }))
    vi.stubGlobal('fetch', fetcher)
    await api('/scenarios/id/execute', z.object({ ok: z.boolean() }), { method: 'POST' })
    expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: 'same-origin', method: 'POST' })
    expect(fetcher.mock.calls[0][1].body).toBeUndefined()
  })
  it('rejects unauthorized results without returning private data or retrying a write', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ error: 'unauthorized' }, { status: 401 }))
    vi.stubGlobal('fetch', fetcher)
    await expect(api('/shipments', z.unknown(), { method: 'POST', body: {} })).rejects.toMatchObject({ status: 401 })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('rejects malformed successful responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ quantity: null })))
    await expect(api('/inventory', z.object({ quantity: z.string() }))).rejects.toBeInstanceOf(ApiError)
  })
  it('collects cursor pages without claiming a partial list is complete', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ data: ['a'], nextCursor: 'next' })).mockResolvedValueOnce(Response.json({ data: ['b'], nextCursor: null }))
    vi.stubGlobal('fetch', fetcher)
    expect(await collectPages('/products', z.object({ data: z.array(z.string()), nextCursor: z.string().nullable() }))).toEqual(['a', 'b'])
    expect(fetcher.mock.calls[1][0]).toContain('cursor=next')
  })
  it('rejects off-origin or internal endpoints', async () => {
    await expect(api('//evil.example', z.unknown())).rejects.toThrow()
    await expect(api('/../internal/ingestion', z.unknown())).rejects.toThrow()
  })
})
