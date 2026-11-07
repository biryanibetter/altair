import { supplyHandler } from '../../../../../../lib/backend/supply'
export const runtime = 'nodejs'
export const maxDuration = 60
const handler = supplyHandler('replenishment')
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) { return handler(request, (await context.params).id) }
