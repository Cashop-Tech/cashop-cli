import { describe, it, expect, afterEach, vi } from 'vitest';
import { apiRequest } from '../../src/core/client.js';
import { ApiError, AuthenticationError } from '../../src/core/errors.js';

const ENV = 'stable' as const;
const API_BASE = 'https://api.castable.hk';
const SSO_BASE = 'https://login.castable.hk';
const TOKEN = 'test-token-abc';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

type FetchArgs = { url: string; init: RequestInit };

function captureFetch(response: Response): { calls: FetchArgs[] } {
  const calls: FetchArgs[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url);
    calls.push({ url, init });
    return response.clone();
  }) as typeof fetch;
  return { calls };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('apiRequest — envelope unwrap', () => {
  it('returns the unwrapped data payload when success=true', async () => {
    captureFetch(jsonResponse({ success: true, code: 200, message: 'ok', data: { id: 1, name: 'Alice' } }));
    const out = await apiRequest<{ id: number; name: string }>({
      env: ENV, token: TOKEN, method: 'GET', url: '/user/1',
    });
    expect(out).toEqual({ id: 1, name: 'Alice' });
  });

  it('throws ApiError when envelope success=false with generic business code', async () => {
    captureFetch(jsonResponse({ success: false, code: 10001, message: 'Not found', data: null }));
    await expect(
      apiRequest({ env: ENV, token: TOKEN, method: 'GET', url: '/items' }),
    ).rejects.toThrow(ApiError);
  });

  it('ApiError carries the server-provided message and code', async () => {
    captureFetch(jsonResponse({ success: false, code: 10001, message: 'Not found', data: null }));
    await expect(
      apiRequest({ env: ENV, token: TOKEN, method: 'GET', url: '/items' }),
    ).rejects.toThrow('API Error [10001]: Not found');
  });

  it('maps envelope code 4003 to AuthenticationError', async () => {
    captureFetch(jsonResponse({ success: false, code: 4003, message: 'Token invalid', data: null }));
    await expect(
      apiRequest({ env: ENV, token: TOKEN, method: 'GET', url: '/secure' }),
    ).rejects.toThrow(AuthenticationError);
  });

  it('maps envelope code 403 to AuthenticationError', async () => {
    captureFetch(jsonResponse({ success: false, code: 403, message: 'Forbidden', data: null }));
    await expect(
      apiRequest({ env: ENV, token: TOKEN, method: 'GET', url: '/secure' }),
    ).rejects.toThrow(AuthenticationError);
  });
});

describe('apiRequest — HTTP-level errors', () => {
  it('maps HTTP 401 to AuthenticationError', async () => {
    captureFetch(jsonResponse({ message: 'Unauthorized' }, 401));
    await expect(
      apiRequest({ env: ENV, token: TOKEN, method: 'GET', url: '/secure' }),
    ).rejects.toThrow(AuthenticationError);
  });

  it('maps HTTP 403 to AuthenticationError', async () => {
    captureFetch(jsonResponse({ message: 'Forbidden' }, 403));
    await expect(
      apiRequest({ env: ENV, token: TOKEN, method: 'GET', url: '/secure' }),
    ).rejects.toThrow(AuthenticationError);
  });

  it('maps HTTP 5xx to ApiError', async () => {
    captureFetch(jsonResponse({ message: 'Internal Server Error', code: 500 }, 500));
    await expect(
      apiRequest({ env: ENV, token: TOKEN, method: 'GET', url: '/broken' }),
    ).rejects.toThrow(ApiError);
  });
});

describe('apiRequest — request wiring', () => {
  it('injects X-AUTHENTICATION on api calls', async () => {
    const { calls } = captureFetch(jsonResponse({ success: true, code: 200, message: 'ok', data: 'pong' }));
    await apiRequest<string>({ env: ENV, token: TOKEN, method: 'GET', url: '/ping' });
    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    const headers = headersToObject(call.init.headers);
    expect(headers['x-authentication']).toBe(TOKEN);
    expect(call.url).toBe(`${API_BASE}/ping`);
  });

  it('uses the sso base URL when baseUrlType=sso', async () => {
    const { calls } = captureFetch(jsonResponse({ success: true, code: 200, message: 'ok', data: { sessionId: 's1' } }));
    await apiRequest({ env: ENV, token: TOKEN, method: 'POST', url: '/login', baseUrlType: 'sso', data: {} });
    expect(calls[0]!.url).toBe(`${SSO_BASE}/login`);
  });

  it('appends query params to the URL', async () => {
    const { calls } = captureFetch(jsonResponse({ success: true, code: 200, message: 'ok', data: [] }));
    await apiRequest({
      env: ENV, token: TOKEN, method: 'GET', url: '/search',
      params: { q: 'shoe', page: 1 },
    });
    expect(calls[0]!.url).toBe(`${API_BASE}/search?q=shoe&page=1`);
  });

  it('sends a JSON-serialised POST body', async () => {
    const { calls } = captureFetch(jsonResponse({ success: true, code: 200, message: 'created', data: { id: 99 } }));
    const body = { name: 'New Item' };
    await apiRequest({ env: ENV, token: TOKEN, method: 'POST', url: '/items', data: body });
    expect(calls[0]!.init.method).toBe('POST');
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual(body);
  });

  it('skips undefined/null query params', async () => {
    const { calls } = captureFetch(jsonResponse({ success: true, code: 200, message: 'ok', data: null }));
    await apiRequest({
      env: ENV, token: TOKEN, method: 'GET', url: '/x',
      params: { a: 1, b: undefined, c: null },
    });
    expect(calls[0]!.url).toBe(`${API_BASE}/x?a=1`);
  });
});

function headersToObject(h: HeadersInit | undefined): Record<string, string> {
  if (!h) return {};
  const out: Record<string, string> = {};
  if (h instanceof Headers) {
    h.forEach((v, k) => { out[k.toLowerCase()] = v; });
    return out;
  }
  if (Array.isArray(h)) {
    for (const [k, v] of h) out[k.toLowerCase()] = v;
    return out;
  }
  for (const [k, v] of Object.entries(h)) out[k.toLowerCase()] = v;
  return out;
}
