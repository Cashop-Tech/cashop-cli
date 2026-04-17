import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../helpers/mock-server.js';
import payCmd from '../../src/commands/pay.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Real API: POST /trade/cashop-order-prod/api/order/payment/prepay
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-prepay.
const PREPAY_URL = 'http://tgw/trade/cashop-order-prod/api/order/payment/prepay';

function makeCtx() {
  return {
    baseUrl: 'http://tgw', outputMode: 'json', env: 'stable',
    flags: {}, config: { auto_confirm: false } as unknown,
    provider: { kind: 'password', getAccessToken: async () => 'TOK', refresh: async () => {}, clear: async () => {} },
    logger: { info() {}, debug() {}, warn() {}, error() {}, close() {} },
    store: {} as unknown,
  };
}

describe('cashop pay', () => {
  it('posts orderGroupNo with default return/cancel deep-link URLs and JP/JPY/ja headers', async () => {
    let captured: Record<string, unknown> = {};
    const capturedHeaders: Record<string, string> = {};
    server.use(http.post(PREPAY_URL, async ({ request }) => {
      captured = (await request.json()) as Record<string, unknown>;
      request.headers.forEach((v, k) => { capturedHeaders[k] = v; });
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: { paymentTradeNo: 'PTN_1', paymentUrl: '/pay?t=PTN_1' },
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    payCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(['pay', 'OG_1'], { from: 'user' });
    expect(captured).toEqual({
      orderGroupNo: 'OG_1',
      returnUrl: 'cashop://payment/success',
      cancelUrl: 'cashop://payment/cancel',
    });
    expect(capturedHeaders['x-language']).toBe('ja');
    const out = spy.mock.calls.map(c => String(c[0])).join('');
    expect(JSON.parse(out).paymentTradeNo).toBe('PTN_1');
    spy.mockRestore();
  });

  it('forwards custom --return-url and --cancel-url', async () => {
    let captured: Record<string, unknown> = {};
    server.use(http.post(PREPAY_URL, async ({ request }) => {
      captured = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: { paymentTradeNo: 'PTN_2', paymentUrl: '/pay?t=PTN_2' },
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    payCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(
      ['pay', 'OG_2', '--return-url', 'https://ok.test/', '--cancel-url', 'https://cancel.test/'],
      { from: 'user' },
    );
    expect(captured.returnUrl).toBe('https://ok.test/');
    expect(captured.cancelUrl).toBe('https://cancel.test/');
    spy.mockRestore();
  });
});
