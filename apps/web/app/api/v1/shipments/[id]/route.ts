import { shipmentHandler } from '../../../../../lib/backend/integration'
export const runtime = 'nodejs'
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return shipmentHandler('read')(request, (await params).id)
}
