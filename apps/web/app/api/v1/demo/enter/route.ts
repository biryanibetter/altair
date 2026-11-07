// ALTAIR Demo Mode Entry API
// Sets demo mode cookie and redirects

import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(): Promise<Response> {
  const store = await cookies()
  store.set('altair-demo-enabled', 'true', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })

  return Response.json({ success: true, redirect: '/' })
}