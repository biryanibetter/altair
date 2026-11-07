import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('Supabase Auth is not configured')
  try {
    if (new URL(url).protocol !== 'https:') throw new Error()
  } catch {
    throw new Error('Supabase Auth is not configured')
  }
  return { url, key }
}

// Use in route handlers/server actions where cookie writes are allowed; no service key here.
export async function createSupabaseServerClient(fetcher?: typeof globalThis.fetch) {
  const { url, key } = getSupabaseConfig()
  const store = await cookies()
  return createServerClient(url, key, {
    ...(fetcher ? { global: { fetch: fetcher } } : {}),
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        for (const { name, value, options } of values) store.set(name, value, options)
      },
    },
  })
}
