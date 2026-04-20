import { HttpError, NetworkError } from '../errors.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface RequestJsonOpts {
  method: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

export interface RequestJsonResult<T> {
  status: number;
  ok: boolean;
  data: T | null;
  rawText: string;
}

/**
 * Low-level transport primitive shared by both CLIs.
 *
 * Responsibilities:
 *  - fetch with timeout + retries on network/abort errors
 *  - JSON body serialize/parse
 *  - surface HTTP status + raw text
 *
 * Non-responsibilities (left to callers):
 *  - authentication headers, token refresh
 *  - business-envelope parsing (e.g. cashop gateway `{code,success,data}`)
 *  - business error code mapping
 */
export async function requestJson<T = unknown>(
  url: string,
  opts: RequestJsonOpts,
): Promise<RequestJsonResult<T>> {
  const retries = opts.retries ?? 3;
  const baseDelay = opts.retryDelayMs ?? 200;
  const timeoutMs = opts.timeoutMs ?? 30_000;

  let attempt = 0;
  let lastErr: unknown;
  while (attempt < retries) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: opts.method,
        headers: {
          'content-type': 'application/json',
          ...(opts.headers ?? {}),
        },
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: ctrl.signal,
      });
      const rawText = await res.text();
      let data: T | null = null;
      if (rawText) {
        try { data = JSON.parse(rawText) as T; }
        catch { throw new HttpError(res.status, rawText); }
      }
      return { status: res.status, ok: res.ok, data, rawText };
    } catch (e) {
      if (e instanceof TypeError || (e instanceof Error && e.name === 'AbortError')) {
        lastErr = e;
        attempt++;
        if (attempt < retries) await sleep(baseDelay * Math.pow(3, attempt - 1));
        continue;
      }
      throw e;
    } finally {
      clearTimeout(to);
    }
  }
  throw new NetworkError(`Network failed after ${retries} retries: ${String(lastErr)}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
