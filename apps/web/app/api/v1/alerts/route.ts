import { monitoringHandler } from '../../../../lib/backend/monitoring'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET(request: Request) { return monitoringHandler('alerts')(request) }
