import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { server, http, HttpResponse } from '../../helpers/mock-server.js';
import { OAuthDeviceProvider } from '../../../src/core/auth-provider/oauth-device.js';
import { TokenStore, InMemoryBackend } from '../../../src/core/token-store.js';
import { NetworkError, ReauthRequired } from '../../../src/core/errors.js';

const BASE = 'http://tgw';
const REFRESH = `${BASE}/member/cashop-member-auth/open/auth/v1/device/refresh`;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

async function seed(store: TokenStore, overrides: Partial<{ refresh_expires_at: number }> = {}) {
  await store.saveOAuth('stable', {
    access_token: 'A', refresh_token: 'R',
    expires_at: Date.now() + 1_000_000,
    refresh_expires_at: overrides.refresh_expires_at ?? Date.now() + 1_000_000_000,
    account: '9527', scopes: ['cli'],
  });
}

describe('OAuthDeviceProvider', () => {
  it('getAccessToken returns stored access_token', async () => {
    const store = new TokenStore(new InMemoryBackend());
    await seed(store);
    const p = new OAuthDeviceProvider(BASE, 'stable', store);
    expect(await p.getAccessToken()).toBe('A');
  });

  it('getAccessToken returns null when no token', async () => {
    const store = new TokenStore(new InMemoryBackend());
    const p = new OAuthDeviceProvider(BASE, 'stable', store);
    expect(await p.getAccessToken()).toBeNull();
  });

  it('refresh happy path persists new tokens with snake_case mapping', async () => {
    server.use(http.post(REFRESH, () =>
      HttpResponse.json({
        code: '00000', success: true, message: 'ok',
        data: {
          accessToken: 'A2', refreshToken: 'R2',
          tokenType: 'Bearer', expiresIn: 2592000, refreshExpiresIn: 7776000,
          userId: 9527, scope: 'cli',
        },
      })));
    const store = new TokenStore(new InMemoryBackend());
    await seed(store);
    const p = new OAuthDeviceProvider(BASE, 'stable', store);
    await p.refresh();
    const saved = await store.getOAuth('stable');
    expect(saved?.access_token).toBe('A2');
    expect(saved?.refresh_token).toBe('R2');
    expect(saved?.scopes).toEqual(['cli']);
  });

  it('refresh preflight: expired refresh clears + throws ReauthRequired without HTTP', async () => {
    const fetchSpy = vi.fn();
    server.use(http.post(REFRESH, ({ request }) => { fetchSpy(request.url); return HttpResponse.json({}); }));
    const store = new TokenStore(new InMemoryBackend());
    await seed(store, { refresh_expires_at: Date.now() - 1 });
    const p = new OAuthDeviceProvider(BASE, 'stable', store);
    await expect(p.refresh()).rejects.toBeInstanceOf(ReauthRequired);
    expect(await store.getOAuth('stable')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refresh 703005 clears + throws ReauthRequired (session expired msg)', async () => {
    server.use(http.post(REFRESH, () =>
      HttpResponse.json({ code: '703005', success: false, message: 'invalid_grant', data: null })));
    const store = new TokenStore(new InMemoryBackend());
    await seed(store);
    const p = new OAuthDeviceProvider(BASE, 'stable', store);
    await expect(p.refresh()).rejects.toThrow(/Session expired/i);
    expect(await store.getOAuth('stable')).toBeNull();
  });

  it('refresh 703011 clears + throws ReauthRequired (reuse detected msg)', async () => {
    server.use(http.post(REFRESH, () =>
      HttpResponse.json({ code: '703011', success: false, message: 'refresh reuse', data: null })));
    const store = new TokenStore(new InMemoryBackend());
    await seed(store);
    const p = new OAuthDeviceProvider(BASE, 'stable', store);
    await expect(p.refresh()).rejects.toThrow(/token reuse detected/i);
    expect(await store.getOAuth('stable')).toBeNull();
  });

  it('refresh 5xx network error: does NOT clear, throws NetworkError', async () => {
    server.use(http.post(REFRESH, () => HttpResponse.error()));
    const store = new TokenStore(new InMemoryBackend());
    await seed(store);
    const p = new OAuthDeviceProvider(BASE, 'stable', store);
    await expect(p.refresh()).rejects.toBeInstanceOf(NetworkError);
    expect(await store.getOAuth('stable')).not.toBeNull();
  });
});
