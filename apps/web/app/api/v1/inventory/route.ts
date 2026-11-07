import { supplyHandler } from '../../../../lib/backend/supply'
export const runtime = 'nodejs'
export const maxDuration = 60
const list = supplyHandler('list'), create = supplyHandler('create')
export async function GET(request: Request) { return list(request) }
export async function POST(request: Request) { return create(request) }
