import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../helpers/mock-server.js';
import payInfoCmd from '../../src/commands/pay-info.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Real API: GET /fin/cashop-fin-prod/api/finance/cashier/queryPaymentInfo?paymentTradeNo=<id>
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-query-payment-info.
const PAYMENT_INFO_URL = 'http://tgw/fin/cashop-fin-prod/api/finance/cashier/queryPaymentInfo';

function makeCtx() {
  return {
    baseUrl: 'http://tgw', outputMode: 'json', env: 'stable',
    flags: {}, config: { auto_confirm: false } as unknown,
    provider: { kind: 'password', getAccessToken: async () => 'TOK', refresh: async () => {}, clear: async () => {} },
    logger: { info() {}, debug() {}, warn() {}, error() {}, close() {} },
    store: {} as unknown,
  };
}

describe('cashop pay info', () => {
  it('GETs queryPaymentInfo with the paymentTradeNo URL-encoded in query string and default JP/JPY/ja headers', async () => {
    let capturedUrl = '';
    const capturedHeaders: Record<string, string> = {};
    server.use(http.get(PAYMENT_INFO_URL, ({ request }) => {
      capturedUrl = request.url;
      request.headers.forEach((v, k) => { capturedHeaders[k] = v; });
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: { receivableAmount: 2418, currency: 'JPY', orderStatus: 'PENDING_PAYMENT' },
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    payInfoCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(['pay', 'info', 'PTN/9+x'], { from: 'user' });

    const u = new URL(capturedUrl);
    expect(u.pathname).toBe('/fin/cashop-fin-prod/api/finance/cashier/queryPaymentInfo');
    expect(u.searchParams.get('paymentTradeNo')).toBe('PTN/9+x');
    expect(capturedHeaders['x-country']).toBe('JP');
    expect(capturedHeaders['x-currency']).toBe('JPY');
    expect(capturedHeaders['x-language']).toBe('ja');
    const out = spy.mock.calls.map(c => String(c[0])).join('');
    expect(JSON.parse(out).receivableAmount).toBe(2418);
    spy.mockRestore();
  });
});
