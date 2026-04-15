import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { server, http, HttpResponse } from '../../helpers/mock-server.js';
import { runDeviceFlow } from '../../../src/core/device/device-flow.js';
import { TokenStore, InMemoryBackend } from '../../../src/core/token-store.js';
import { CashopCliError, NetworkError } from '../../../src/core/errors.js';

const BASE = 'http://tgw';
const DEVICE = `${BASE}/member/cashop-member-auth/open/auth/v1/device`;
const POLL = `${BASE}/member/cashop-member-auth/open/auth/v1/device/poll`;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function deviceOk(overrides: Record<string, unknown> = {}) {
  return HttpResponse.json({
    code: '00000', success: true, message: 'ok',
    data: {
      deviceCode: 'dc-abc', userCode: 'ABCD-EFGH',
      verificationUri: 'https://host/device',
      verificationUriComplete: 'https://host/device?user_code=ABCD-EFGH',
      expiresIn: 600, interval: 5, ...overrides,
    },
  });
}

function pollOk() {
  return HttpResponse.json({
    code: '00000', success: true, message: 'ok',
    data: {
      accessToken: 'ACC', refreshToken: 'REF',
      tokenType: 'Bearer', expiresIn: 2592000, refreshExpiresIn: 7776000,
      userId: 9527, scope: 'cli',
    },
  });
}
function pollErr(code: string, message = 'err') {
  return HttpResponse.json({ code, success: false, message, data: null });
}

const openMock = vi.fn(async () => ({ opened: true as const }));
vi.mock('../../../src/core/device/open-browser.js', () => ({
  openBrowser: (...a: unknown[]) => openMock(...a),
}));

describe('runDeviceFlow', () => {
  it('happy path: saves token with correct snake_case mapping', async () => {
    server.use(http.post(DEVICE, () => deviceOk()));
    let calls = 0;
    server.use(http.post(POLL, () => (++calls === 1 ? pollErr('703007', 'pending') : pollOk())));

    const store = new TokenStore(new InMemoryBackend());
    vi.useFakeTimers();
    const p = runDeviceFlow({ base: BASE, env: 'stable', store, noBrowser: true, printer: () => {}, nowProvider: () => 0 });
    await vi.runAllTimersAsync();
    const result = await p;
    vi.useRealTimers();

    expect(result.userId).toBe('9527');
    const saved = await store.getOAuth('stable');
    expect(saved).toMatchObject({
      access_token: 'ACC', refresh_token: 'REF', account: '9527', scopes: ['cli'],
    });
    expect(saved!.expires_at).toBe(2592000 * 1000);
    expect(saved!.refresh_expires_at).toBe(7776000 * 1000);
  });

  it('slow_down doubles interval, capped at 30s', async () => {
    server.use(http.post(DEVICE, () => deviceOk({ interval: 5 })));
    const waits: number[] = [];
    server.use(http.post(POLL, () => pollErr('703008', 'slow down')));

    const store = new TokenStore(new InMemoryBackend());
    const p = runDeviceFlow({
      base: BASE, env: 'stable', store, noBrowser: true, printer: () => {},
      nowProvider: () => 0,
      sleeper: (ms) => { waits.push(ms); return Promise.resolve(); },
      maxPolls: 6,
    });
    await expect(p).rejects.toBeInstanceOf(CashopCliError);
    expect(waits.slice(0, 5)).toEqual([5000, 10000, 20000, 30000, 30000]);
  });

  it('703009 access_denied → CashopCliError', async () => {
    server.use(http.post(DEVICE, () => deviceOk()));
    server.use(http.post(POLL, () => pollErr('703009', 'denied')));
    const store = new TokenStore(new InMemoryBackend());
    await expect(runDeviceFlow({
      base: BASE, env: 'stable', store, noBrowser: true, printer: () => {},
      nowProvider: () => 0, sleeper: () => Promise.resolve(),
    })).rejects.toThrow(/Authorization denied/i);
  });

  it('703010 expired_token → CashopCliError', async () => {
    server.use(http.post(DEVICE, () => deviceOk()));
    server.use(http.post(POLL, () => pollErr('703010', 'expired')));
    const store = new TokenStore(new InMemoryBackend());
    await expect(runDeviceFlow({
      base: BASE, env: 'stable', store, noBrowser: true, printer: () => {},
      nowProvider: () => 0, sleeper: () => Promise.resolve(),
    })).rejects.toThrow(/Authorization expired/i);
  });

  it('local timeout once now >= startedAt + expires_in*1000', async () => {
    server.use(http.post(DEVICE, () => deviceOk({ expiresIn: 1 })));
    server.use(http.post(POLL, () => pollErr('703007', 'pending')));
    const store = new TokenStore(new InMemoryBackend());
    let now = 0;
    await expect(runDeviceFlow({
      base: BASE, env: 'stable', store, noBrowser: true, printer: () => {},
      nowProvider: () => { now += 2000; return now; },
      sleeper: () => Promise.resolve(),
    })).rejects.toThrow(/Authorization expired/i);
  });

  it('browser unavailable: prints fallback with URL + user_code, flow continues', async () => {
    openMock.mockResolvedValueOnce({ opened: false, reason: 'ssh' });
    server.use(http.post(DEVICE, () => deviceOk({ verificationUriComplete: 'https://host/device?user_code=ABCD-EFGH' })));
    server.use(http.post(POLL, () => pollOk()));
    const lines: string[] = [];
    const store = new TokenStore(new InMemoryBackend());
    await runDeviceFlow({
      base: BASE, env: 'stable', store, noBrowser: false, printer: (l) => lines.push(l),
      nowProvider: () => 0, sleeper: () => Promise.resolve(),
    });
    expect(lines.some(l => l.includes('https://host/device?user_code=ABCD-EFGH'))).toBe(true);
    expect(lines.some(l => l.includes('ABCD-EFGH'))).toBe(true);
  });

  it('POST /device network failure surfaces as NetworkError', async () => {
    server.use(http.post(DEVICE, () => HttpResponse.error()));
    const store = new TokenStore(new InMemoryBackend());
    await expect(runDeviceFlow({
      base: BASE, env: 'stable', store, noBrowser: true, printer: () => {},
      nowProvider: () => 0, sleeper: () => Promise.resolve(),
    })).rejects.toBeInstanceOf(NetworkError);
  });

  it('saveOAuth assertion: account is String(userId) and scopes is [scope]', async () => {
    server.use(http.post(DEVICE, () => deviceOk()));
    server.use(http.post(POLL, () => pollOk()));
    const store = new TokenStore(new InMemoryBackend());
    await runDeviceFlow({
      base: BASE, env: 'stable', store, noBrowser: true, printer: () => {},
      nowProvider: () => 0, sleeper: () => Promise.resolve(),
    });
    const saved = await store.getOAuth('stable');
    expect(typeof saved!.account).toBe('string');
    expect(saved!.account).toBe('9527');
    expect(saved!.scopes).toEqual(['cli']);
  });
});
