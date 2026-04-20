import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../../helpers/mock-server.js';
import loginCmd from '../../../src/commands/auth/login.js';
import { TokenStore, InMemoryBackend } from '../../../src/core/token-store.js';
import type { CliContext } from '../../../src/core/globals.js';
import { runDeviceFlow } from '../../../src/core/device/device-flow.js';

vi.mock('../../../src/core/device/device-flow.js', () => ({
  runDeviceFlow: vi.fn(async () => ({ userId: '9527' })),
}));

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function makeCtx(store: TokenStore): CliContext {
  return {
    env: 'stable', baseUrl: 'http://tgw', store, provider: { kind: 'none' } as any,
    logger: { info: () => {}, debug: () => {}, warn: () => {}, error: () => {}, close: () => {} },
    flags: {}, outputMode: 'json',
    config: {} as any,
  };
}

describe('auth login', () => {
  it('stores accessToken/refreshToken and resolves account id', async () => {
    server.use(http.post('http://tgw/member/cashop-member-auth/open/auth/v1/login', () =>
      HttpResponse.json({
        code: '00000', success: true, message: '成功',
        data: {
          nickname: 'Test', accessToken: 'TOK', refreshToken: 'REF', userId: '42',
          expireTime: new Date(Date.now() + 7_200_000).toISOString(),
          refreshExpireTime: new Date(Date.now() + 7 * 86_400_000).toISOString(),
          loginType: 'emailPassword', channel: 'app',
        },
      })));
    const store = new TokenStore(new InMemoryBackend());
    const program = new Command();
    (program as any).__ctx = makeCtx(store);
    loginCmd.register(program);
    await program.parseAsync(['login', '--email', 'u@x.com', '--password', 'p'], { from: 'user' });
    const saved = await store.getPasswordToken('stable');
    expect(saved?.accessToken).toBe('TOK');
    expect(saved?.userId).toBe('42');
  });
});

describe('auth login --device', () => {
  it('invokes runDeviceFlow and NOT PasswordProvider', async () => {
    const store = new TokenStore(new InMemoryBackend());
    const program = new Command();
    (program as any).__ctx = makeCtx(store);
    loginCmd.register(program);
    await program.parseAsync(['login', '--device'], { from: 'user' });
    expect(runDeviceFlow).toHaveBeenCalledOnce();
    const args = (runDeviceFlow as any).mock.calls[0][0];
    expect(args.noBrowser).toBe(false);
  });

  it('--device --no-browser passes noBrowser:true', async () => {
    (runDeviceFlow as any).mockClear();
    const store = new TokenStore(new InMemoryBackend());
    const program = new Command();
    (program as any).__ctx = makeCtx(store);
    loginCmd.register(program);
    await program.parseAsync(['login', '--device', '--no-browser'], { from: 'user' });
    expect((runDeviceFlow as any).mock.calls[0][0].noBrowser).toBe(true);
  });

  it('password login prints tip about --device', async () => {
    server.use(http.post('http://tgw/member/cashop-member-auth/open/auth/v1/login', () =>
      HttpResponse.json({
        code: '00000', success: true, message: 'ok',
        data: {
          nickname: 'T', accessToken: 'TOK', refreshToken: 'REF', userId: '42',
          expireTime: new Date(Date.now() + 7_200_000).toISOString(),
          refreshExpireTime: new Date(Date.now() + 7 * 86_400_000).toISOString(),
          loginType: 'emailPassword', channel: 'app',
        },
      })));
    const lines: string[] = [];
    const origLog = console.log;
    console.log = (...a: unknown[]) => lines.push(a.map(String).join(' '));
    try {
      const store = new TokenStore(new InMemoryBackend());
      const program = new Command();
      (program as any).__ctx = makeCtx(store);
      loginCmd.register(program);
      await program.parseAsync(['login', '--email', 'u@x.com', '--password', 'p'], { from: 'user' });
    } finally { console.log = origLog; }
    expect(lines.some(l => l.toLowerCase().includes('--device'))).toBe(true);
  });
});
