import { assistantChatHandler } from '../../../../../lib/backend/assistant'
export const runtime = 'nodejs'
export const maxDuration = 60
export async function POST(request: Request) { return assistantChatHandler(request) }
