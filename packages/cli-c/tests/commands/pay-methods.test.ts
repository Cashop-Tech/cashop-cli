import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../helpers/mock-server.js';
import payMethodsCmd from '../../src/commands/pay-methods.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Real API: GET /fin/cashop-fin-prod/api/finance/cashier/getPayMethods
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-pay-methods and
// cashop-ai PaymentMethodsParserTest#parsesRealUpstreamWithMixedAvailability.
const PAY_METHODS_URL = 'http://tgw/fin/cashop-fin-prod/api/finance/cashier/getPayMethods';

function makeCtx() {
  return {
    baseUrl: 'http://tgw', outputMode: 'json', env: 'stable',
    flags: {}, config: { auto_confirm: false } as unknown,
    provider: { kind: 'password', getAccessToken: async () => 'TOK', refresh: async () => {}, clear: async () => {} },
    logger: { info() {}, debug() {}, warn() {}, error() {}, close() {} },
    store: {} as unknown,
  };
}

describe('cashop pay methods', () => {
  it('GETs pay methods and passes through the raw upstream array (mixed availability)', async () => {
    const capturedHeaders: Record<string, string> = {};
    server.use(http.get(PAY_METHODS_URL, ({ request }) => {
      request.headers.forEach((v, k) => { capturedHeaders[k] = v; });
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: [
          {
            payMethodCode: 'GMO_PAY', payMethodShowName: 'GMO', payMethodDesc: 'GMO PAY',
            payRemark: 'Credit Card / CVS / PayPay / LINE Pay', payMethodIcon: 'gmo.png',
            isAvailable: true, unavailableReason: '',
          },
          {
            payMethodCode: 'BALANCE_PAYMENT', payMethodShowName: '余额支付', payMethodDesc: '',
            payRemark: '', payMethodIcon: 'balance.png',
            isAvailable: true, unavailableReason: '',
          },
          {
            payMethodCode: 'KONBINI', payMethodShowName: 'コンビニ', payMethodDesc: '',
            payRemark: '', payMethodIcon: 'konbini.png',
            isAvailable: false, unavailableReason: '¥30,000 以上不可用',
          },
        ],
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    payMethodsCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(['pay', 'methods'], { from: 'user' });
    // default headers match the shell script (JP/JPY/ja)
    expect(capturedHeaders['x-country']).toBe('JP');
    expect(capturedHeaders['x-currency']).toBe('JPY');
    expect(capturedHeaders['x-language']).toBe('ja');
    const out = spy.mock.calls.map(c => String(c[0])).join('');
    const parsed = JSON.parse(out) as Array<Record<string, unknown>>;
    expect(parsed).toHaveLength(3);
    expect(parsed[0]?.payMethodCode).toBe('GMO_PAY');
    expect(parsed[2]?.isAvailable).toBe(false);
    expect(parsed[2]?.unavailableReason).toBe('¥30,000 以上不可用');
    spy.mockRestore();
  });

  it('forwards custom --country / --currency / --language as gateway headers', async () => {
    const capturedHeaders: Record<string, string> = {};
    server.use(http.get(PAY_METHODS_URL, ({ request }) => {
      request.headers.forEach((v, k) => { capturedHeaders[k] = v; });
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null, data: [],
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    payMethodsCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(
      ['pay', 'methods', '--country', 'US', '--currency', 'USD', '--language', 'en'],
      { from: 'user' },
    );
    expect(capturedHeaders['x-country']).toBe('US');
    expect(capturedHeaders['x-currency']).toBe('USD');
    expect(capturedHeaders['x-language']).toBe('en');
    spy.mockRestore();
  });
});
