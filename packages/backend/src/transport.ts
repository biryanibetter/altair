import { decimalToken } from './decimal'

const exactFields = new Set(['value_qr', 'weight_kg', 'primaryValue', 'netWgt'])
export class ProviderError extends Error {
  constructor(public readonly code: string, public readonly retryAfterMs = 60000) { super(code) }
}
export interface TransportOptions {
  fetch?: typeof globalThis.fetch
  sleep?: (ms: number) => Promise<void>
  budgetMs?: number
}

// Never include URLs, headers or response bodies in errors: upstreams may echo credentials.
export async function fetchJson(url: string, headers: Record<string, string> = {}, options: TransportOptions = {}): Promise<unknown> {
  const request = options.fetch ?? globalThis.fetch
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)))
  const deadline = Date.now() + (options.budgetMs ?? 25000)
  for (let attempt = 0; attempt < 3; attempt++) {
    let failure: ProviderError
    try {
      const remaining = deadline - Date.now()
      if (remaining < 100) throw new ProviderError('provider_timeout')
      const response = await request(url, { headers: { Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(Math.min(8000, remaining)), cache: 'no-store', redirect: 'error' })
      if (response.status === 401 || response.status === 403) throw new ProviderError('provider_auth')
      if (!response.ok) {
        const retry = response.headers.get('retry-after') ?? response.headers.get('x-rate-limit-retry-after-seconds')
        const wait = retry ? (/^\d+$/.test(retry) ? Number(retry) * 1000 : Math.max(0, Date.parse(retry) - Date.now())) : response.status === 429 ? 60000 : 1000 * 2 ** attempt
        throw new ProviderError(response.status === 429 ? 'rate_limited' : response.status >= 500 ? 'provider_unavailable' : 'provider_rejected', Number.isFinite(wait) ? wait : 60000)
      }
      const reader = response.body?.getReader()
      if (!reader) throw new ProviderError('malformed_response')
      const chunks: Uint8Array[] = []
      let length = 0
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          length += value.byteLength
          if (length > 2_000_000) throw new ProviderError('response_too_large')
          chunks.push(value)
        }
      } finally { await reader.cancel().catch(() => {}) }
      try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8'), (key: string, value: unknown, context?: { source?: string }) => {
          if (exactFields.has(key) && typeof value === 'number') {
            if (!context?.source) throw new Error('numeric_token_unavailable')
            return decimalToken(context.source)
          }
          return value
        }) as unknown
      }
      catch { throw new ProviderError('malformed_response') }
    } catch (error) {
      failure = error instanceof ProviderError ? error : new ProviderError(error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name) ? 'provider_timeout' : 'provider_unavailable', 1000 * 2 ** attempt)
    }
    if (!['rate_limited', 'provider_unavailable', 'provider_timeout'].includes(failure.code) || attempt === 2) throw failure
    // Respect the full provider delay. Long rate limits are persisted by the caller.
    const wait = failure.retryAfterMs + Math.floor(Math.random() * 100)
    if (Date.now() + wait + 1000 >= deadline) throw failure
    await sleep(wait)
  }
  throw new ProviderError('provider_unavailable')
}
