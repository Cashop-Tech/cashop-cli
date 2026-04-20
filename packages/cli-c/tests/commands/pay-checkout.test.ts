import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../helpers/mock-server.js';
import payCheckoutCmd from '../../src/commands/pay-checkout.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Real API: POST /fin/cashop-fin-prod/api/finance/cashier/payFromCheckout
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-pay-from-checkout.
const CHECKOUT_PAY_URL = 'http://tgw/fin/cashop-fin-prod/api/finance/cashier/payFromCheckout';

function makeCtx() {
  return {
    baseUrl: 'http://tgw', outputMode: 'json', env: 'stable',
    flags: {}, config: { auto_confirm: false } as unknown,
    provider: { kind: 'password', getAccessToken: async () => 'TOK', refresh: async () => {}, clear: async () => {} },
    logger: { info() {}, debug() {}, warn() {}, error() {}, close() {} },
    store: {} as unknown,
  };
}

describe('cashop pay checkout', () => {
  it('POSTs {paymentTradeNo, payChannel, totalAmount, currency} and uses --currency for both body and x-currency', async () => {
    let captured: Record<string, unknown> = {};
    const capturedHeaders: Record<string, string> = {};
    server.use(http.post(CHECKOUT_PAY_URL, async ({ request }) => {
      captured = (await request.json()) as Record<string, unknown>;
      request.headers.forEach((v, k) => { capturedHeaders[k] = v; });
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: { paymentResult: 'SUCCESS', paymentTradeNo: 'PTN_9' },
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    payCheckoutCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(
      ['pay', 'checkout',
        '--payment-trade-no', 'PTN_9',
        '--pay-channel', 'GMO_PAY',
        '--total-amount', '2418',
        '--currency', 'JPY'],
      { from: 'user' },
    );
    expect(captured).toEqual({
      paymentTradeNo: 'PTN_9',
      payChannel: 'GMO_PAY',
      totalAmount: 2418,
      currency: 'JPY',
    });
    expect(capturedHeaders['x-country']).toBe('JP');
    expect(capturedHeaders['x-currency']).toBe('JPY');
    expect(capturedHeaders['x-language']).toBe('ja');
    const out = spy.mock.calls.map(c => String(c[0])).join('');
    expect(JSON.parse(out).paymentResult).toBe('SUCCESS');
    spy.mockRestore();
  });

  it('rejects non-positive --total-amount with bad-args (exit code 2)', async () => {
    const program = new Command();
    program.exitOverride();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    payCheckoutCmd.register(program);
    const spyOut = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await expect(
      program.parseAsync(
        ['pay', 'checkout',
          '--payment-trade-no', 'PTN_X',
          '--pay-channel', 'GMO_PAY',
          '--total-amount', '0'],
        { from: 'user' },
      ),
    ).rejects.toThrow(/positive number/);
    spyOut.mockRestore();
  });
});
