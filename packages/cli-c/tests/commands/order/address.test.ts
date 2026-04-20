import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../../helpers/mock-server.js';
import addressCmd from '../../../src/commands/order/address.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Real API: POST /trade/cashop-order-prod/trade/order/v2/modifyAddress
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-order-address.
const MODIFY_URL = 'http://tgw/trade/cashop-order-prod/trade/order/v2/modifyAddress';

function makeCtx() {
  return {
    baseUrl: 'http://tgw', outputMode: 'json', env: 'stable',
    flags: {}, config: { auto_confirm: false } as unknown,
    provider: { kind: 'password', getAccessToken: async () => 'TOK', refresh: async () => {}, clear: async () => {} },
    logger: { info() {}, debug() {}, warn() {}, error() {}, close() {} },
    store: {} as unknown,
  };
}

describe('cashop order address', () => {
  it('posts {orderNo,addressId} and passes through boolean envelope data', async () => {
    let captured: Record<string, unknown> = {};
    const capturedHeaders: Record<string, string> = {};
    server.use(http.post(MODIFY_URL, async ({ request }) => {
      request.headers.forEach((v, k) => { capturedHeaders[k] = v; });
      captured = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null, data: true,
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    addressCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(
      ['order', 'address', 'ON_1', '--address-id', 'A_42'],
      { from: 'user' },
    );
    expect(captured).toEqual({ orderNo: 'ON_1', addressId: 'A_42' });
    expect(capturedHeaders['x-country']).toBe('JP');
    expect(capturedHeaders['x-currency']).toBe('JPY');
    expect(capturedHeaders['x-language']).toBe('ja');
    const out = spy.mock.calls.map(c => String(c[0])).join('');
    expect(out.trim()).toBe('true');
    spy.mockRestore();
  });

  it('forwards custom --country/--currency/--language headers', async () => {
    const capturedHeaders: Record<string, string> = {};
    server.use(http.post(MODIFY_URL, async ({ request }) => {
      request.headers.forEach((v, k) => { capturedHeaders[k] = v; });
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null, data: true,
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    addressCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(
      ['order', 'address', 'ON_2', '--address-id', 'A_5',
       '--country', 'US', '--currency', 'USD', '--language', 'en'],
      { from: 'user' },
    );
    expect(capturedHeaders['x-country']).toBe('US');
    expect(capturedHeaders['x-currency']).toBe('USD');
    expect(capturedHeaders['x-language']).toBe('en');
    spy.mockRestore();
  });
});
