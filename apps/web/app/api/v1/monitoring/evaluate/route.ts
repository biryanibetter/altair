import { monitoringHandler } from '../../../../../lib/backend/monitoring'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60
export async function POST(request: Request) { return monitoringHandler('evaluate')(request) }
