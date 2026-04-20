import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest';
import { server, http, HttpResponse } from '../helpers/mock-server.js';
import { PasswordProvider } from '../../src/core/auth-provider/password.js';
import { TokenStore, InMemoryBackend } from '../../src/core/token-store.js';
import { BusinessError } from '@cashop/core';

const BASE = 'http://test-gw';
const LOGIN_PATH = '/member/cashop-member-auth/open/auth/v1/login';
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('PasswordProvider.login', () => {
  it('POSTs credentials with required headers and stores accessToken/refreshToken/expiry', async () => {
    let loginChannel = '', deviceId = '';
    server.use(http.post(`${BASE}${LOGIN_PATH}`, async ({ request }) => {
      loginChannel = request.headers.get('login-channel') ?? '';
      deviceId = request.headers.get('device-id') ?? '';
      const body = await request.json() as { email: string; password: string; loginType: string; channel: string };
      expect(body.email).toBe('u@x.com');
      expect(body.loginType).toBe('emailPassword');
      expect(body.channel).toBe('app');
      return HttpResponse.json({
        code: '00000', success: true, message: '成功',
        data: {
          nickname: 'Test', accessToken: 'T', refreshToken: 'R', userId: '42',
          expireTime: new Date(Date.now() + 7_200_000).toISOString(),
          refreshExpireTime: new Date(Date.now() + 7 * 86_400_000).toISOString(),
          loginType: 'emailPassword', channel: 'app',
        },
      });
    }));

    const store = new TokenStore(new InMemoryBackend());
    const result = await PasswordProvider.login({
      base: BASE, env: 'stable', store, email: 'u@x.com', password: 'pw', deviceId: 'cli-test-001',
    });
    expect(result.userId).toBe('42');
    expect(loginChannel).toBe('app');
    expect(deviceId).toBe('cli-test-001');

    const saved = await store.getPasswordToken('stable');
    expect(saved?.accessToken).toBe('T');
    expect(saved?.refreshToken).toBe('R');
    expect(saved?.userId).toBe('42');
    expect(saved?.expires_at).toBeGreaterThan(Date.now());
  });

  it('throws BusinessError on wrong credentials (HTTP 200 + code 702021)', async () => {
    server.use(http.post(`${BASE}${LOGIN_PATH}`, () =>
      HttpResponse.json({ code: '702021', success: false, message: '账号或密码错误', data: null })));
    const store = new TokenStore(new InMemoryBackend());
    await expect(PasswordProvider.login({
      base: BASE, env: 'stable', store, email: 'u@x.com', password: 'wrong', deviceId: 'd',
    })).rejects.toBeInstanceOf(BusinessError);
  });
});
