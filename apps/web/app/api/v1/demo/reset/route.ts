// ALTAIR Demo Reset API
// Resets demo state

import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(): Promise<Response> {
  const store = await cookies()
  store.delete('altair-demo-state')
  store.delete('altair-demo-config')
  
  return Response.json({ success: true, message: 'Demo state reset' })
}