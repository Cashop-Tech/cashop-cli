import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { AuthBundle } from '../../src/core/config.js';

// ---------------------------------------------------------------------------
// Isolate config dir per test
// ---------------------------------------------------------------------------

let tmpDir: string;

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  return {
    ...actual,
    default: { ...actual, homedir: () => tmpDir },
  };
});

const ENV = 'stable' as const;
const API_BASE = 'https://api.castable.hk';
const AUTH_PATH = '/basic/cashop-internal-auth/api/v1/token/refresh';

const originalFetch = globalThis.fetch;

function seed(bundle: AuthBundle): void {
  const dir = path.join(tmpDir, '.cashop-console');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'config.json'),
    JSON.stringify({ env: ENV, auth: { [ENV]: bundle } }, null, 2),
  );
}

function readBundle(): AuthBundle | undefined {
  const file = path.join(tmpDir, '.cashop-console', 'config.json');
  if (!fs.existsSync(file)) return undefined;
  const cfg = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
    auth?: Record<string, AuthBundle>;
  };
  return cfg.auth?.[ENV];
}

function freshBundle(overrides: Partial<AuthBundle> = {}): AuthBundle {
  return {
    accessToken: 'old-at',
    refreshToken: 'old-rt',
    expiresAt: Date.now() + 5 * 60_000,
    username: 'alice',
    savedAt: Date.now(),
    ...overrides,
  };
}

type FetchCall = { url: string; init: RequestInit };

function installFetch(
  handlers: Array<(url: string, init: RequestInit) => Response | Promise<Response>>,
): { calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  let i = 0;
  globalThis.fetch = (async (
    input: string | URL | Request,
    init: RequestInit = {},
  ) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    calls.push({ url, init });
    const handler = handlers[Math.min(i, handlers.length - 1)];
    i += 1;
    return await handler!(url, init);
  }) as typeof fetch;
  return { calls };
}

function jsonResp(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cashop-client-test-'));
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('apiRequest — basic envelope handling', () => {
  it('sends Authorization: Bearer and unwraps envelope on success', async () => {
    seed(freshBundle());
    const { calls } = installFetch([
      () => jsonResp({ success: true, code: 0, message: 'ok', data: { ping: 'pong' } }),
    ]);
    const { apiRequest } = await import('../../src/core/client.js');
    const out = await apiRequest<{ ping: string }>({
      env: ENV,
      method: 'GET',
      url: '/ping',
    });
    expect(out).toEqual({ ping: 'pong' });
    expect(calls[0]!.url).toBe(`${API_BASE}/ping`);
    const headers = new Headers(calls[0]!.init.headers);
    expect(headers.get('authorization')).toBe('Bearer old-at');
  });

  it('accepts legacy success=true / code=200 envelopes', async () => {
    seed(freshBundle());
    installFetch([
      () => jsonResp({ success: true, code: 200, message: 'ok', data: 'legacy' }),
    ]);
    const { apiRequest } = await import('../../src/core/client.js');
    await expect(
      apiRequest<string>({ env: ENV, method: 'GET', url: '/legacy' }),
    ).resolves.toBe('legacy');
  });

  it('throws ApiError for non-auth envelope failure', async () => {
    seed(freshBundle());
    installFetch([
      () => jsonResp({ success: false, code: 10001, message: 'Not found', data: null }),
    ]);
    const { apiRequest } = await import('../../src/core/client.js');
    const { ApiError } = await import('../../src/core/errors.js');
    await expect(
      apiRequest({ env: ENV, method: 'GET', url: '/x' }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('appends query params to URL', async () => {
    seed(freshBundle());
    const { calls } = installFetch([
      () => jsonResp({ success: true, code: 0, message: 'ok', data: null }),
    ]);
    const { apiRequest } = await import('../../src/core/client.js');
    await apiRequest({
      env: ENV,
      method: 'GET',
      url: '/search',
      params: { q: 'shoe', page: 1, skip: undefined },
    });
    expect(calls[0]!.url).toBe(`${API_BASE}/search?q=shoe&page=1`);
  });
});

describe('apiRequest — missing auth', () => {
  it('throws AuthenticationError when no bundle is present', async () => {
    const { apiRequest } = await import('../../src/core/client.js');
    const { AuthenticationError } = await import('../../src/core/errors.js');
    await expect(
      apiRequest({ env: ENV, method: 'GET', url: '/x' }),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });
});

describe('apiRequest — proactive refresh (expiring soon)', () => {
  it('refreshes before sending when token expires in < 30s and persists new refreshToken', async () => {
    seed(freshBundle({ expiresAt: Date.now() + 5_000 }));

    const { calls } = installFetch([
      (url) => {
        expect(url).toBe(`${API_BASE}${AUTH_PATH}`);
        return jsonResp({
          code: 0,
          message: 'ok',
          data: {
            accessToken: 'new-at',
            refreshToken: 'new-rt',
            expiresIn: 7200,
          },
        });
      },
      (_url, init) => {
        const headers = new Headers(init.headers);
        expect(headers.get('authorization')).toBe('Bearer new-at');
        return jsonResp({ success: true, code: 0, message: 'ok', data: { ok: true } });
      },
    ]);

    const { apiRequest } = await import('../../src/core/client.js');
    const out = await apiRequest<{ ok: boolean }>({
      env: ENV,
      method: 'GET',
      url: '/ping',
    });
    expect(out).toEqual({ ok: true });
    expect(calls).toHaveLength(2);

    const persisted = readBundle();
    expect(persisted?.accessToken).toBe('new-at');
    expect(persisted?.refreshToken).toBe('new-rt');
  });

  it('keeps the old refreshToken when server omits it in the refresh response', async () => {
    seed(freshBundle({ expiresAt: Date.now() + 5_000, refreshToken: 'keep-me' }));
    installFetch([
      () =>
        jsonResp({
          code: 0,
          message: 'ok',
          data: { accessToken: 'new-at', expiresIn: 3600 },
        }),
      () => jsonResp({ success: true, code: 0, message: 'ok', data: null }),
    ]);
    const { apiRequest } = await import('../../src/core/client.js');
    await apiRequest({ env: ENV, method: 'GET', url: '/ping' });
    expect(readBundle()?.refreshToken).toBe('keep-me');
  });
});

describe('apiRequest — reactive refresh on 401 / 40103', () => {
  it('on envelope code 40103, refreshes and replays the request once', async () => {
    seed(freshBundle());
    const { calls } = installFetch([
      () => jsonResp({ code: 40103, success: false, message: 'Token expired', data: null }),
      () =>
        jsonResp({
          code: 0,
          message: 'ok',
          data: { accessToken: 'refreshed-at', refreshToken: 'refreshed-rt', expiresIn: 3600 },
        }),
      (_url, init) => {
        const headers = new Headers(init.headers);
        expect(headers.get('authorization')).toBe('Bearer refreshed-at');
        return jsonResp({ success: true, code: 0, message: 'ok', data: 'replayed' });
      },
    ]);
    const { apiRequest } = await import('../../src/core/client.js');
    await expect(
      apiRequest<string>({ env: ENV, method: 'GET', url: '/x' }),
    ).resolves.toBe('replayed');
    expect(calls).toHaveLength(3);
    expect(calls[1]!.url).toContain(AUTH_PATH);
  });

  it('on HTTP 401, refreshes and replays the request once', async () => {
    seed(freshBundle());
    installFetch([
      () => jsonResp({ message: 'Unauthorized' }, 401),
      () =>
        jsonResp({
          code: 0,
          message: 'ok',
          data: { accessToken: 'a2', refreshToken: 'r2', expiresIn: 3600 },
        }),
      () => jsonResp({ success: true, code: 0, message: 'ok', data: 'ok' }),
    ]);
    const { apiRequest } = await import('../../src/core/client.js');
    await expect(
      apiRequest<string>({ env: ENV, method: 'GET', url: '/x' }),
    ).resolves.toBe('ok');
  });

  it('clears auth and throws when refresh itself fails with 401', async () => {
    seed(freshBundle());
    installFetch([
      () => jsonResp({ message: 'Unauthorized' }, 401),
      () => jsonResp({ code: 40301, message: 'Refresh token invalid', data: null }),
    ]);
    const { apiRequest } = await import('../../src/core/client.js');
    const { AuthenticationError } = await import('../../src/core/errors.js');
    await expect(
      apiRequest({ env: ENV, method: 'GET', url: '/x' }),
    ).rejects.toBeInstanceOf(AuthenticationError);
    expect(readBundle()).toBeUndefined();
  });
});

describe('apiRequest — concurrent refresh coalescing', () => {
  it('two concurrent requests sharing an expiring token trigger only one refresh', async () => {
    seed(freshBundle({ expiresAt: Date.now() + 5_000 }));

    let refreshCount = 0;
    const handlers: Array<(url: string, init: RequestInit) => Response | Promise<Response>> = [];
    for (let i = 0; i < 8; i += 1) {
      handlers.push((url) => {
        if (url.includes(AUTH_PATH)) {
          refreshCount += 1;
          return jsonResp({
            code: 0,
            message: 'ok',
            data: { accessToken: 'at2', refreshToken: 'rt2', expiresIn: 3600 },
          });
        }
        return jsonResp({ success: true, code: 0, message: 'ok', data: 'ok' });
      });
    }
    installFetch(handlers);

    const { apiRequest } = await import('../../src/core/client.js');
    await Promise.all([
      apiRequest({ env: ENV, method: 'GET', url: '/a' }),
      apiRequest({ env: ENV, method: 'GET', url: '/b' }),
    ]);

    expect(refreshCount).toBe(1);
    expect(readBundle()?.accessToken).toBe('at2');
  });
});

describe('apiRequest — static access token override', () => {
  it('uses the override and does not refresh', async () => {
    // No seed: no bundle in config.
    const { calls } = installFetch([
      () => jsonResp({ success: true, code: 0, message: 'ok', data: 'ok' }),
    ]);
    const { apiRequest, setStaticAccessToken } = await import(
      '../../src/core/client.js'
    );
    try {
      setStaticAccessToken('static-at');
      await apiRequest({ env: ENV, method: 'GET', url: '/ping' });
      const headers = new Headers(calls[0]!.init.headers);
      expect(headers.get('authorization')).toBe('Bearer static-at');
    } finally {
      setStaticAccessToken(undefined);
    }
  });
});
