import { shipmentHandler } from '../../../../lib/backend/integration'
export const runtime = 'nodejs'
export const GET = (request: Request) => shipmentHandler('list')(request)
export const POST = (request: Request) => shipmentHandler('create')(request)
