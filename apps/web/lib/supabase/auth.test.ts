import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { getAuthenticatedUser } from './auth'
import { getSupabaseConfig } from './server'

const originalUrl = process.env.SUPABASE_URL
const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY
afterEach(() => {
  if (originalUrl === undefined) delete process.env.SUPABASE_URL
  else process.env.SUPABASE_URL = originalUrl
  if (originalKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY
  else process.env.SUPABASE_PUBLISHABLE_KEY = originalKey
})

describe('server auth', () => {
  it('rejects missing configuration without leaking credentials', () => {
    delete process.env.SUPABASE_URL
    expect(() => getSupabaseConfig()).toThrow('Supabase Auth is not configured')
  })

  it('returns null when Supabase cannot verify a signed-in identity', async () => {
    expect(await getAuthenticatedUser({ auth: { getUser: async () => ({ data: { user: null }, error: new Error('invalid') }) } } as never)).toBeNull()
  })

  it('returns only the identity verified by the auth service', async () => {
    const user = { id: crypto.randomUUID() }
    expect(await getAuthenticatedUser({ auth: { getUser: async () => ({ data: { user }, error: null }) } } as never)).toEqual(user)
  })
})
