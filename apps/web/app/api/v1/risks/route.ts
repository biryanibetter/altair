import { scenarioHandler } from '../../../../lib/backend/scenarios'
export const runtime = 'nodejs'
export const maxDuration = 60
const handler = scenarioHandler('risks')
export async function GET(request: Request) { return handler(request) }
