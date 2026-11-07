import { monitoringHandler } from '../../../../../lib/backend/monitoring'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET(request: Request) { return monitoringHandler('config')(request) }
export async function PUT(request: Request) { return monitoringHandler('configure')(request) }
