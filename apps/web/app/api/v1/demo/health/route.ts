// ALTAIR Demo Health Endpoint
// Returns demo mode health status

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(): Promise<Response> {
  const headers = { 'Cache-Control': 'no-store' }
  return Response.json({
    status: 'ok',
    database: 'demo (in-memory)',
    demo: true
  }, { headers })
}