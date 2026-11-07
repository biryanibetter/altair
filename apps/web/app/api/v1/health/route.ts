import { checkDatabaseConnection } from '@altair/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(): Promise<Response> {
  const headers = { 'Cache-Control': 'no-store' }
  try {
    await checkDatabaseConnection()
    return Response.json({ status: 'ok', database: 'connected' }, { headers })
  } catch {
    return Response.json({ status: 'unavailable', database: 'disconnected' }, { status: 503, headers })
  }
}
