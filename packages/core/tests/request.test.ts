import { describe, it, expect, vi, afterEach } from 'vitest';
import { requestJson } from '../src/http/request.js';
import { HttpError, NetworkError } from '../src/errors.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(impl: typeof fetch): void {
  globalThis.fetch = impl as typeof fetch;
}

describe('requestJson', () => {
  it('returns parsed JSON on 200', async () => {
    mockFetch(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const res = await requestJson<{ ok: boolean }>('https://example.test', { method: 'GET' });
    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
    expect(res.data).toEqual({ ok: true });
  });

  it('surfaces 4xx with parsed body + ok=false (no throw)', async () => {
    mockFetch(async () => new Response(JSON.stringify({ code: 'X' }), { status: 400 }));
    const res = await requestJson('https://example.test', { method: 'GET' });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
    expect(res.data).toEqual({ code: 'X' });
  });

  it('throws HttpError when body is not JSON', async () => {
    mockFetch(async () => new Response('<html>oops</html>', { status: 200 }));
    await expect(requestJson('https://example.test', { method: 'GET' })).rejects.toBeInstanceOf(HttpError);
  });

  it('retries on network error and eventually throws NetworkError', async () => {
    const calls = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    mockFetch(calls as unknown as typeof fetch);
    await expect(
      requestJson('https://example.test', { method: 'GET', retries: 3, retryDelayMs: 1 }),
    ).rejects.toBeInstanceOf(NetworkError);
    expect(calls).toHaveBeenCalledTimes(3);
  });

  it('returns null data on empty body', async () => {
    mockFetch(async () => new Response(null, { status: 204 }));
    const res = await requestJson('https://example.test', { method: 'DELETE' });
    expect(res.status).toBe(204);
    expect(res.data).toBeNull();
  });
});
