import { LlmError } from './provider'

// Every production network operation also receives the signal. This wrapper
// bounds orchestration awaits even if an injected adapter ignores cancellation.
export async function bounded<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work
  if (signal.aborted) { void work.catch(() => {}); throw new LlmError('request_timeout') }
  let onAbort: () => void = () => {}
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      onAbort = () => reject(new LlmError('request_timeout'))
      signal.addEventListener('abort', onAbort, { once: true })
      if (signal.aborted) onAbort()
    })])
  } finally { signal.removeEventListener('abort', onAbort) }
}
