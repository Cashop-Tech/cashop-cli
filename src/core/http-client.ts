import {
  HttpError, BusinessError, ReauthRequired, NetworkError, NotFoundError, ForbiddenError, ConflictError,
} from './errors.js';

export interface ProviderLike {
  kind: string;
  getAccessToken(): Promise<string | null>;
  refresh(): Promise<void>;
  clear(): Promise<void>;
}

export interface RequestOpts {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
  provider?: ProviderLike;
  timeoutMs?: number;
  /** default headers injected on every call; command-level `headers` merge on top */
  defaults?: Record<string, string>;
  /** when true, skip cashop envelope parsing and return the parsed JSON body directly.
   *  cashop-ai endpoints under /ai/cashop-ai/rpc/auth/* return bare JSON (no {code,success,data}) */
  raw?: boolean;
}

interface Envelope<T> { code: string; success: boolean; message: string; data: T | null; extAttrs?: unknown; }

// Auth-expired / token-invalid codes — add more as discovered in live testing.
const REAUTH_CODES = new Set<string>(['701001', '702001', '702101', '702102']);

export async function gatewayRequest<T = unknown>(base: string, path: string, opts: RequestOpts): Promise<T> {
  const url = `${base}${path}`;
  const run = async (tok: string | null): Promise<Response> => {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-country': 'JP',
      'x-currency': 'JPY',
      'x-language': 'en',
      ...(opts.defaults ?? {}),
      ...(opts.headers ?? {}),
    };
    if (tok) headers.authorization = tok; // NO "Bearer " prefix — stable gatekeeper expects raw token
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30_000);
    try {
      return await fetch(url, {
        method: opts.method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: ctrl.signal,
      });
    } finally { clearTimeout(to); }
  };

  let attempt = 0;
  let lastErr: unknown;
  while (attempt < 3) {
    try {
      const tok = opts.provider ? await opts.provider.getAccessToken() : null;
      const res = await run(tok);
      if (!res.ok) await throwHttp(res); // 5xx or unusual 4xx not covered by envelope
      if (opts.raw) {
        const text = await res.text();
        if (!text) return undefined as unknown as T;
        try { return JSON.parse(text) as T; }
        catch { throw new HttpError(res.status, text); }
      }
      const env = await parseEnvelope<T>(res);
      if (env.success && env.code === '00000') return env.data as T;
      // Business failure with HTTP 200 envelope
      if (REAUTH_CODES.has(env.code)) {
        if (opts.provider) {
          await opts.provider.refresh().catch(() => {});
          const newTok = await opts.provider.getAccessToken();
          const retry = await run(newTok);
          if (retry.ok) {
            const env2 = await parseEnvelope<T>(retry);
            if (env2.success && env2.code === '00000') return env2.data as T;
            if (REAUTH_CODES.has(env2.code)) throw new ReauthRequired();
            throw new BusinessError(env2.code, env2.message, env2);
          }
          await throwHttp(retry);
        }
        throw new ReauthRequired();
      }
      throw new BusinessError(env.code, env.message, env);
    } catch (e) {
      if (e instanceof TypeError || (e instanceof Error && e.name === 'AbortError')) {
        lastErr = e;
        attempt++;
        if (attempt < 3) await sleep(200 * Math.pow(3, attempt - 1));
        continue;
      }
      throw e;
    }
  }
  throw new NetworkError(`Network failed after retries: ${String(lastErr)}`);
}

async function parseEnvelope<T>(res: Response): Promise<Envelope<T>> {
  const text = await res.text();
  if (!text) throw new HttpError(res.status, 'empty body');
  try { return JSON.parse(text) as Envelope<T>; }
  catch { throw new HttpError(res.status, text); }
}

async function throwHttp(res: Response): Promise<never> {
  let body: unknown = null;
  try { body = await res.json(); } catch { body = await res.text().catch(() => null); }
  if (res.status === 403) throw new ForbiddenError(`Forbidden: ${JSON.stringify(body)}`);
  if (res.status === 404) throw new NotFoundError(`Not found: ${JSON.stringify(body)}`);
  if (res.status === 409) throw new ConflictError(`Conflict: ${JSON.stringify(body)}`);
  throw new HttpError(res.status, body);
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
