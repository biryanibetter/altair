// Tiny fetch wrapper with timeouts, typed errors and Retry-After-aware backoff.
// Both upstream providers document strict 429 handling, so every call goes
// through here instead of raw fetch().

export class UpstreamError extends Error {
  readonly status: number;
  readonly retryAfterSeconds: number | null;
  readonly body: string;

  constructor(message: string, status: number, retryAfterSeconds: number | null, body: string) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
    this.body = body;
  }
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds);
  const date = Date.parse(value);
  if (Number.isNaN(date)) return null;
  return Math.max(0, Math.round((date - Date.now()) / 1000));
}

export interface FetchOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Number of extra attempts on 429/5xx. Defaults to 1. */
  retries?: number;
  /** Never sleep longer than this between retries (keeps route handlers responsive). */
  maxBackoffMs?: number;
  label?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<{
  data: T;
  status: number;
  latencyMs: number;
}> {
  const {
    headers = {},
    timeoutMs = 9000,
    retries = 1,
    maxBackoffMs = 2500,
    label = "upstream",
  } = options;

  const started = Date.now();
  let attempt = 0;

  for (;;) {
    let response: Response;
    try {
      response = await fetch(url, {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (attempt >= retries) {
        throw new UpstreamError(
          `${label} request failed: ${(error as Error).message}`,
          0,
          null,
          ""
        );
      }
      attempt += 1;
      await sleep(Math.min(500 * 2 ** attempt, maxBackoffMs));
      continue;
    }

    if (response.ok) {
      const data = (await response.json()) as T;
      return { data, status: response.status, latencyMs: Date.now() - started };
    }

    const body = await response.text();
    const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
    const retryable = response.status === 429 || response.status >= 500;

    if (retryable && attempt < retries) {
      attempt += 1;
      const backoff = retryAfter !== null ? retryAfter * 1000 : 500 * 2 ** attempt;
      await sleep(Math.min(backoff, maxBackoffMs));
      continue;
    }

    throw new UpstreamError(
      `${label} responded ${response.status}`,
      response.status,
      retryAfter,
      body.slice(0, 400)
    );
  }
}

export function describeError(error: unknown): string {
  if (error instanceof UpstreamError) {
    if (error.status === 401 || error.status === 403) return "authentication rejected";
    if (error.status === 429) {
      return error.retryAfterSeconds
        ? `rate limited (retry in ${error.retryAfterSeconds}s)`
        : "rate limited";
    }
    if (error.status === 0) return "network unreachable";
    return `HTTP ${error.status}`;
  }
  if (error instanceof Error) return error.message;
  return "unknown error";
}
