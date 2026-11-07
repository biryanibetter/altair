import { scenarioHandler } from '../../../../lib/backend/scenarios'
export const runtime = 'nodejs'
export const maxDuration = 60
const create = scenarioHandler('create')
const list = scenarioHandler('list')
export async function POST(request: Request) { return create(request) }
export async function GET(request: Request) { return list(request) }
