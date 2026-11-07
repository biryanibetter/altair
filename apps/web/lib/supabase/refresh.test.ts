import { afterEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
vi.mock('@supabase/ssr', () => ({ createServerClient: vi.fn() }))
import { createServerClient } from '@supabase/ssr'
import { middleware } from '../../middleware'

afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs() })
it('copies refreshed browser session cookies to the downstream request and response', async () => {
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'synthetic-publishable-key')
  vi.mocked(createServerClient).mockImplementation((_, __, options) => ({ auth: { getUser: async () => {
    options.cookies!.setAll!([{ name: 'sb-test-auth-token', value: 'refreshed', options: { path: '/', httpOnly: true } }], { 'cache-control': 'private, no-store' })
    return { data: { user: { id: 'test' } }, error: null }
  } } }) as never)
  const request = new NextRequest('http://localhost/api/v1/inventory', { headers: { cookie: 'sb-test-auth-token=expired' } })
  const response = await middleware(request)
  expect(request.cookies.get('sb-test-auth-token')?.value).toBe('refreshed')
  expect(response.cookies.get('sb-test-auth-token')?.value).toBe('refreshed')
  expect(response.headers.get('cache-control')).toBe('private, no-store')
})
