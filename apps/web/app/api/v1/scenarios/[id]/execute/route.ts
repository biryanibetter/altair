import { scenarioHandler } from '../../../../../../lib/backend/scenarios'
export const runtime = 'nodejs'
export const maxDuration = 60
const handler = scenarioHandler('execute')
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handler(request, (await context.params).id)
}
