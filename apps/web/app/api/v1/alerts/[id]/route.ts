import { monitoringHandler } from '../../../../../lib/backend/monitoring'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) { return monitoringHandler('transition')(request, (await context.params).id) }
