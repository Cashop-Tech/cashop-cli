import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../helpers/mock-server.js';
import promoCmd from '../../src/commands/promo.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Real API paths; captured 2026-04-17 from cashop-ai/cli/consumer/cashop-promo-list.
// Shell branches: token → auth path; no token → open path.
const AUTH_URL = 'http://tgw/marketing/cashop-marketing/cms/v2/activity/queryActivityList';
const OPEN_URL = 'http://tgw/marketing/cashop-marketing/open/cms/v2/activity/queryActivityList';

function makeCtx(tok: string | null = 'TOK') {
  return {
    baseUrl: 'http://tgw', outputMode: 'json', env: 'stable',
    flags: {}, config: { auto_confirm: false } as unknown,
    provider: { kind: 'password', getAccessToken: async () => tok, refresh: async () => {}, clear: async () => {} },
    logger: { info() {}, debug() {}, warn() {}, error() {}, close() {} },
    store: {} as unknown,
  };
}

describe('cashop promo', () => {
  it('posts pageIndex=1/pageSize=20 by default with JP/JPY/ja headers', async () => {
    let captured: Record<string, unknown> = {};
    const capturedHeaders: Record<string, string> = {};
    server.use(http.post(AUTH_URL, async ({ request }) => {
      captured = (await request.json()) as Record<string, unknown>;
      request.headers.forEach((v, k) => { capturedHeaders[k] = v; });
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: { data: [{ activityId: 'ACT_1', title: '新人满减' }], total: 1 },
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    promoCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(['promo'], { from: 'user' });
    expect(captured).toEqual({ pageIndex: 1, pageSize: 20 });
    expect(capturedHeaders['x-country']).toBe('JP');
    expect(capturedHeaders['x-language']).toBe('ja');
    const out = spy.mock.calls.map(c => String(c[0])).join('');
    expect(JSON.parse(out).total).toBe(1);
    spy.mockRestore();
  });

  it('honors --page and --page-size as numbers', async () => {
    let captured: Record<string, unknown> = {};
    server.use(http.post(AUTH_URL, async ({ request }) => {
      captured = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null, data: {},
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    promoCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(['promo', '--page', '3', '--page-size', '50'], { from: 'user' });
    expect(captured).toEqual({ pageIndex: 3, pageSize: 50 });
    spy.mockRestore();
  });

  it('uses the open path when provider has no token', async () => {
    let captured: Record<string, unknown> = {};
    server.use(http.post(OPEN_URL, async ({ request }) => {
      captured = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: { data: [{ activityId: 'ACT_OPEN', title: '公开活动' }], total: 1 },
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx(null);
    promoCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(['promo'], { from: 'user' });
    expect(captured).toEqual({ pageIndex: 1, pageSize: 20 });
    spy.mockRestore();
  });
});
