import { describe, it, expect, afterEach } from 'vitest';
import { login, refreshAccessToken, getMe } from '../../src/api/internal-auth.js';
import { ApiError, AuthenticationError } from '../../src/core/errors.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function stubFetch(
  handler: (url: string, init: RequestInit) => Response | Promise<Response>,
): { calls: Array<{ url: string; init: RequestInit }> } {
  const calls: Array<{ url: string; init: RequestInit }> = [];
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
    return await handler(url, init);
  }) as typeof fetch;
  return { calls };
}

const LOGIN = 'https://api.castable.hk/basic/cashop-internal-auth/api/v1/login';
const REFRESH = 'https://api.castable.hk/basic/cashop-internal-auth/api/v1/token/refresh';
const ME = 'https://api.castable.hk/basic/cashop-internal-auth/api/v1/me';

describe('login', () => {
  it('posts credentials and returns tokens on success', async () => {
    const { calls } = stubFetch((url) => {
      expect(url).toBe(LOGIN);
      return new Response(
        JSON.stringify({
          code: 0,
          message: 'ok',
          data: {
            accessToken: 'at',
            refreshToken: 'rt',
            expiresIn: 7200,
          },
        }),
        { status: 200 },
      );
    });

    const res = await login('stable', {
      username: 'alice',
      password: 'secret',
      totpCode: '123456',
    });
    expect(res.accessToken).toBe('at');
    expect(res.refreshToken).toBe('rt');

    const body = JSON.parse(String(calls[0]!.init.body)) as Record<string, unknown>;
    expect(body).toEqual({
      username: 'alice',
      password: 'secret',
      totpCode: '123456',
    });
  });

  it('surfaces needTotp when server requests TOTP', async () => {
    stubFetch(
      () =>
        new Response(
          JSON.stringify({ code: 0, data: { needTotp: true } }),
          { status: 200 },
        ),
    );
    const res = await login('stable', { username: 'alice', password: 'secret' });
    expect(res.needTotp).toBe(true);
    expect(res.accessToken).toBeUndefined();
  });

  it('throws ApiError when envelope reports a generic business error', async () => {
    stubFetch(
      () =>
        new Response(
          JSON.stringify({ code: 10001, message: 'Bad credentials', data: null }),
          { status: 200 },
        ),
    );
    await expect(
      login('stable', { username: 'alice', password: 'wrong' }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('throws AuthenticationError on HTTP 401', async () => {
    stubFetch(() => new Response('', { status: 401 }));
    await expect(
      login('stable', { username: 'alice', password: 'wrong' }),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });
});

describe('refreshAccessToken', () => {
  it('posts refreshToken and returns rotated tokens', async () => {
    const { calls } = stubFetch((url) => {
      expect(url).toBe(REFRESH);
      return new Response(
        JSON.stringify({
          code: 0,
          data: { accessToken: 'new-at', refreshToken: 'new-rt', expiresIn: 3600 },
        }),
        { status: 200 },
      );
    });

    const res = await refreshAccessToken('stable', 'old-rt');
    expect(res.accessToken).toBe('new-at');
    expect(res.refreshToken).toBe('new-rt');

    const body = JSON.parse(String(calls[0]!.init.body)) as Record<string, unknown>;
    expect(body).toEqual({ refreshToken: 'old-rt' });
  });
});

describe('getMe', () => {
  it('sends Authorization: Bearer header', async () => {
    const { calls } = stubFetch((url) => {
      expect(url).toBe(ME);
      return new Response(
        JSON.stringify({
          code: 0,
          data: { userId: 1, username: 'alice', realName: 'Alice', isSuperAdmin: false },
        }),
        { status: 200 },
      );
    });

    const me = await getMe('stable', 'at');
    expect(me.username).toBe('alice');

    const headers = new Headers(calls[0]!.init.headers);
    expect(headers.get('authorization')).toBe('Bearer at');
  });
});
