import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Refresh on requests that may render a signed-in page or call an owner API.
// This is not an authorization gate: each API verifies auth.getUser() itself.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return response // Protected handlers report unavailable configuration.
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values, headersToSet) => {
        for (const { name, value } of values) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of values) response.cookies.set(name, value, options)
        for (const [name, value] of Object.entries(headersToSet)) response.headers.set(name, value)
      },
    },
  })
  try { await client.auth.getUser() } catch { /* The protected handler verifies the session and returns 401/503. */ }
  return response
}

export const config = { matcher: ['/((?!api/internal|api/v1/health|_next/static|_next/image|favicon.ico).*)'] }
