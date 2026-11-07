import { z } from 'zod'
import { assistantAnswerSchema } from '@altair/shared/contracts'

export type ModelMessage = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null; tool_call_id?: string; tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[] }
export type CompletionInput = { messages: ModelMessage[]; tools: unknown[]; maxTokens: number; signal: AbortSignal }
export interface LlmProvider { complete(input: CompletionInput): Promise<unknown> }
export class LlmError extends Error { constructor(public code: string, public retryAfterSeconds?: number) { super(code) } }
type Environment = Record<string, string | undefined>
const wire = z.object({ choices: z.array(z.object({ finish_reason: z.enum(['stop', 'tool_calls']), message: z.object({ content: z.string().max(16000).nullable().optional(), tool_calls: z.array(z.object({ id: z.string().min(1).max(100), type: z.literal('function'), function: z.object({ name: z.string().max(80), arguments: z.string().max(16000) }) })).max(6).optional() }) })).length(1) })
export class OpenRouterProvider implements LlmProvider {
  constructor(private env: Environment, private options: { fetch?: typeof globalThis.fetch; sleep?: (ms: number) => Promise<void> } = {}) {}
  async complete(input: CompletionInput): Promise<unknown> {
    const model = this.env.ALTAIR_LLM_MODEL ?? 'openrouter/free'
    if (this.env.ALTAIR_LLM_PROVIDER !== 'openrouter' || !this.env.OPENROUTER_API_KEY?.trim()) throw new LlmError('llm_disabled')
    if ((this.env.ALTAIR_LLM_BASE_URL ?? 'https://openrouter.ai/api/v1') !== 'https://openrouter.ai/api/v1' || !(model === 'openrouter/free' || /^[a-z0-9_.-]+\/[a-z0-9_.:-]+:free$/i.test(model))) throw new LlmError('llm_configuration_invalid')
    const body = JSON.stringify({ model, messages: input.messages, tools: input.tools, tool_choice: 'auto', parallel_tool_calls: false, max_tokens: input.maxTokens, stream: false, provider: { require_parameters: true, max_price: { prompt: 0, completion: 0 } } })
    const request = this.options.fetch ?? globalThis.fetch
    for (let attempt = 0; attempt < 2; attempt++) {
      let failure: LlmError
      try {
        const response = await request('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${this.env.OPENROUTER_API_KEY.trim()}`, 'Content-Type': 'application/json', 'X-OpenRouter-Title': 'ALTAIR' }, body, redirect: 'error', cache: 'no-store', signal: AbortSignal.any([input.signal, AbortSignal.timeout(12000)]) })
        if (!response.ok) {
          const retry = response.headers.get('retry-after')
          const seconds = retry ? (/^\d+$/.test(retry) ? Number(retry) : Math.ceil((Date.parse(retry) - Date.now()) / 1000)) : 60
          await response.body?.cancel()
          throw new LlmError(response.status === 429 ? 'provider_rate_limited' : response.status >= 500 ? 'provider_unavailable' : 'provider_rejected', response.status === 429 ? Math.max(1, Number.isFinite(seconds) ? seconds : 60) : undefined)
        }
        const reader = response.body?.getReader(); if (!reader) throw new LlmError('invalid_model_output')
        let length = 0; const chunks: Uint8Array[] = []
        try { while (true) { const part = await reader.read(); if (part.done) break; length += part.value.byteLength; if (length > 65536) throw new LlmError('invalid_model_output'); chunks.push(part.value) } }
        finally { await reader.cancel().catch(() => {}) }
        let value: z.output<typeof wire>
        try { value = wire.parse(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch { throw new LlmError('invalid_model_output') }
        const message = value.choices[0]!.message
        if (message.tool_calls?.length) return { calls: message.tool_calls.map(c => ({ id: c.id, name: c.function.name, arguments: c.function.arguments })) }
        try { return { answer: assistantAnswerSchema.parse(JSON.parse(message.content ?? '')) } } catch { throw new LlmError('invalid_model_output') }
      } catch (e) { failure = e instanceof LlmError ? e : new LlmError(input.signal.aborted || e instanceof Error && ['AbortError','TimeoutError'].includes(e.name) ? 'provider_timeout' : 'provider_unavailable') }
      // Do not truncate Retry-After to fit a serverless budget. Caller returns it to the user.
      if (attempt === 1 || input.signal.aborted || !['provider_unavailable', 'provider_timeout'].includes(failure.code)) throw failure
      await (this.options.sleep ?? (ms => new Promise(r => setTimeout(r, ms))))(250 * 2 ** attempt + Math.floor(Math.random() * 100))
    }
    throw new LlmError('provider_unavailable')
  }
}
