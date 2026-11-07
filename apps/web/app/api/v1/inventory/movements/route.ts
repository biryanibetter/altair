import { supplyHandler } from '../../../../../lib/backend/supply'
export const runtime = 'nodejs'
export const maxDuration = 60
const handler = supplyHandler('movement')
export async function POST(request: Request) { return handler(request) }
