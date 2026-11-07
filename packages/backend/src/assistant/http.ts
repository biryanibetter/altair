import { assistantRequestSchema, assistantResponseSchema, type AssistantResponse } from '@altair/shared/contracts'
import { InputError, jsonResponse } from '../routing/http'
import { chat } from './orchestrator'
import type { LlmProvider } from './provider'
import type { ToolDispatch } from './tools'
import { bounded } from './bounded'
import { LlmError } from './provider'

async function readBody(request: Request, signal?: AbortSignal): Promise<unknown> {
  const reader = request.body?.getReader(); if (!reader) throw new InputError('invalid_body')
  const chunks: Uint8Array[] = []; let bytes = 0
  try {
    while (true) { const part = await bounded(reader.read(), signal); if (part.done) break; bytes += part.value.byteLength; if (bytes > 16384) throw new InputError('invalid_body'); chunks.push(part.value) }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown } catch { throw new InputError('invalid_body') }
  } finally { void reader.cancel().catch(() => {}) }
}

export class AssistantAdmissionError extends Error { constructor(public code: 'rate_limited' | 'not_found' | 'storage_unavailable' | 'conversation_limit') { super(code) } }
export interface AssistantStore {
  begin(conversationId: string | undefined, message: string): Promise<{ conversationId: string; turnId: string; history: string[] }>
  finish(turnId: string, result: AssistantResponse): Promise<void>
}
export function createAssistantHandler(authorize: () => Promise<{ store: AssistantStore; provider: LlmProvider; dispatch: ToolDispatch; signal?: AbortSignal } | null>) {
  return async (request: Request) => {
    try {
      const context = await authorize(); if (!context) return jsonResponse({ error: 'unauthorized' }, 401)
      if (new URL(request.url).search) return jsonResponse({ error: 'invalid_request' }, 400)
      const parsed = assistantRequestSchema.safeParse(await readBody(request, context.signal))
      if (!parsed.success) return jsonResponse({ error: 'invalid_request' }, 400)
      const { conversationId, turnId, history } = await context.store.begin(parsed.data.conversationId, parsed.data.message)
      const result = assistantResponseSchema.parse({ ...await chat(parsed.data, context.provider, context.dispatch, history, context.signal), conversationId, turnId })
      await context.store.finish(turnId, result)
      return jsonResponse(result)
    } catch (e) {
      if (e instanceof InputError) return jsonResponse({ error: 'invalid_request' }, 400)
      if (e instanceof LlmError && e.code === 'request_timeout') return jsonResponse({ error: 'request_timeout' }, 408)
      if (e instanceof AssistantAdmissionError) {
        if (e.code === 'rate_limited') return Response.json({ error: 'rate_limited' }, { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } })
        return jsonResponse({ error: e.code }, e.code === 'not_found' ? 404 : e.code === 'conversation_limit' ? 409 : 503)
      }
      return jsonResponse({ error: 'service_unavailable' }, 503)
    }
  }
}
