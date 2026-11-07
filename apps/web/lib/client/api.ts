import { z } from 'zod'

export class ApiError extends Error {
  constructor(public status: number, message: string, public retryAfter: string | null = null) { super(message) }
}
let demoQueue: Promise<unknown> = Promise.resolve()
async function demoApi(path: string, options: { method?: string; body?: unknown }) {
  const run = demoQueue.catch(() => undefined).then(async () => {
    let state: unknown
    try { state = JSON.parse(localStorage.getItem('altair-recovered-demo-v1') ?? 'null') ?? undefined } catch { /* Start fresh if browser storage is unavailable. */ }
    const response = await fetch('/api/v1/demo/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, ...options, state }) })
    const result = await response.json()
    if (!response.ok) throw new ApiError(response.status, result.error ?? 'Demo action unavailable')
    try { localStorage.setItem('altair-recovered-demo-v1', JSON.stringify(result.state)) } catch { throw new ApiError(507, 'Browser storage is full or unavailable. Demo changes could not be saved.') }
    return result.data
  })
  demoQueue = run
  return run
}
export async function api<T>(path: string, schema: z.ZodType<T>, options: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  if (!/^\/[a-z][a-z0-9/?=&%_.-]*$/i.test(path) || path.includes('..')) throw new ApiError(400, 'Invalid API path')
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1') return schema.parse(await demoApi(path, { method: options.method ?? 'GET', ...(options.body !== undefined ? { body: options.body } : {}) }))
  const response = await fetch(`/api/v1${path}`, {
    method: options.method ?? 'GET', credentials: 'same-origin', cache: 'no-store', signal: options.signal,
    ...(options.body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options.body) } : {}),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const messages: Record<number, string> = { 401: 'Your session has expired. Sign in again.', 403: 'This action is not allowed.', 404: 'Record not found for this account.', 409: 'This record changed. Refresh and review before trying again.', 429: 'Request limit reached. Please wait before retrying.', 503: 'The service could not be reached. Your changes have not been confirmed.' }
    const reason = typeof body?.error === 'string' && /^[a-z0-9_ -]{1,100}$/i.test(body.error) ? ` (${body.error.replaceAll('_', ' ')})` : ''
    if (response.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event('altair:unauthorized'))
    throw new ApiError(response.status, (messages[response.status] ?? 'Please check your inputs and try again.') + reason, response.headers.get('Retry-After'))
  }
  const result: { success: boolean; data?: T } = schema.safeParse(await response.json()) as { success: boolean; data?: T }
  if (!result.success || result.data === undefined) throw new ApiError(502, 'The server returned an unexpected result. Please refresh.')
  return result.data
}
export async function collectPages<T>(path: string, schema: z.ZodType<{ data: T[]; nextCursor: string | null }>, signal?: AbortSignal): Promise<T[]> {
  const records: T[] = [], visited = new Set<string>()
  let cursor: string | null = null
  for (let page = 0; page < 100; page++) {
    const result: { data: T[]; nextCursor: string | null } = await api(`${path}${path.includes('?') ? '&' : '?'}limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, schema, { signal })
    records.push(...result.data)
    if (!result.nextCursor) return records
    if (visited.has(result.nextCursor)) throw new ApiError(502, 'The server repeated a page cursor.')
    visited.add(result.nextCursor); cursor = result.nextCursor
  }
  throw new ApiError(413, 'This list exceeds the display limit. Narrow the filters.')
}
