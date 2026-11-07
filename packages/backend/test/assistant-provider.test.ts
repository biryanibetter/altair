import { expect, it, vi } from 'vitest'
import { OpenRouterProvider, LlmError } from '../src/assistant/provider'
const env = { ALTAIR_LLM_PROVIDER: 'openrouter', ALTAIR_LLM_BASE_URL: 'https://openrouter.ai/api/v1', ALTAIR_LLM_MODEL: 'openrouter/free', OPENROUTER_API_KEY: 'local-test-key' }
const input = { messages: [{ role: 'user' as const, content: 'Inspect stock' }], tools: [], maxTokens: 100, signal: AbortSignal.timeout(1000) }
it('uses only server credentials, free routing and structured tool calling', async () => {
  const fetch = vi.fn(async () => Response.json({ choices: [{ finish_reason: 'tool_calls', message: { content: null, tool_calls: [{ id: 'x', type: 'function', function: { name: 'inspect_inventory', arguments: '{}' } }] } }] }))
  const provider = new OpenRouterProvider(env, { fetch })
  expect(await provider.complete(input)).toEqual({ calls: [{ id: 'x', name: 'inspect_inventory', arguments: '{}' }] })
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
  expect(JSON.parse(init.body as string)).toMatchObject({ model: 'openrouter/free', max_tokens: 100, provider: { require_parameters: true, max_price: { prompt: 0, completion: 0 } } })
  expect(init.redirect).toBe('error')
})
it('honors long Retry-After without retrying inside the budget or exposing response bodies', async () => {
  const fetch = vi.fn(async () => new Response('secret upstream body', { status: 429, headers: { 'Retry-After': '120' } }))
  await expect(new OpenRouterProvider(env, { fetch }).complete(input)).rejects.toMatchObject({ code: 'provider_rate_limited', retryAfterSeconds: 120 })
  expect(fetch).toHaveBeenCalledTimes(1)
})
it('bounds transient retries and rejects malformed, truncated and credential responses', async () => {
  const fetch = vi.fn(async () => new Response('secret', { status: 503 }))
  await expect(new OpenRouterProvider(env, { fetch, sleep: async () => {} }).complete(input)).rejects.toBeInstanceOf(LlmError)
  expect(fetch).toHaveBeenCalledTimes(2)
  for (const body of [{}, { choices: [{ finish_reason: 'length', message: { content: '{}' } }] }]) {
    await expect(new OpenRouterProvider(env, { fetch: async () => Response.json(body) }).complete(input)).rejects.toMatchObject({ code: 'invalid_model_output' })
  }
  await expect(new OpenRouterProvider({ ...env, OPENROUTER_API_KEY: '' }).complete(input)).rejects.toMatchObject({ code: 'llm_disabled' })
})
it('does not retry authentication failures or send an unsupported/paid model or base URL', async () => {
  const fetch = vi.fn(async () => new Response('secret', { status: 401 }))
  await expect(new OpenRouterProvider(env, { fetch }).complete(input)).rejects.toMatchObject({ code: 'provider_rejected' })
  expect(fetch).toHaveBeenCalledTimes(1)
  for (const configuration of [{ ...env, ALTAIR_LLM_MODEL: 'paid/model' }, { ...env, ALTAIR_LLM_BASE_URL: 'https://attacker.example' }]) {
    await expect(new OpenRouterProvider(configuration, { fetch }).complete(input)).rejects.toMatchObject({ code: 'llm_configuration_invalid' })
  }
  expect(fetch).toHaveBeenCalledTimes(1)
})
it('sanitizes timeouts and rejects oversized responses within bounded attempts', async () => {
  const fetch = vi.fn(async () => { throw new DOMException('secret', 'TimeoutError') })
  await expect(new OpenRouterProvider(env, { fetch, sleep: async () => {} }).complete(input)).rejects.toMatchObject({ code: 'provider_timeout' })
  expect(fetch).toHaveBeenCalledTimes(2)
  await expect(new OpenRouterProvider(env, { fetch: async () => new Response('x'.repeat(66000)) }).complete(input)).rejects.toMatchObject({ code: 'invalid_model_output' })
})
