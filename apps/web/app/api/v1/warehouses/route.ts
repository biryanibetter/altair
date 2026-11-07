import { catalogHandler } from '../../../../lib/backend/integration'
export const runtime = 'nodejs'
export const GET = (request: Request) => catalogHandler('warehouses')(request)
export const POST = (request: Request) => catalogHandler('warehouses')(request, 'create')
