import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../helpers/mock-server.js';
import trackCmd from '../../src/commands/track.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Real API: GET /trade/cashop-order-prod/api/order/{orderNo}/tracking
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-logistics.
function trackingUrl(orderNo: string): string {
  return `http://tgw/trade/cashop-order-prod/api/order/${orderNo}/tracking`;
}

function makeCtx() {
  return {
    baseUrl: 'http://tgw', outputMode: 'json', env: 'stable',
    flags: {}, config: { auto_confirm: false } as unknown,
    provider: { kind: 'password', getAccessToken: async () => 'TOK', refresh: async () => {}, clear: async () => {} },
    logger: { info() {}, debug() {}, warn() {}, error() {}, close() {} },
    store: {} as unknown,
  };
}

describe('cashop track', () => {
  it('GETs tracking for the positional orderNo with JP/JPY/ja headers', async () => {
    const capturedHeaders: Record<string, string> = {};
    server.use(http.get(trackingUrl('ON_1'), ({ request }) => {
      request.headers.forEach((v, k) => { capturedHeaders[k] = v; });
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: { deliveryStatus: 'IN_TRANSIT', waybillNo: 'WB_123' },
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    trackCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(['track', 'ON_1'], { from: 'user' });
    expect(capturedHeaders['x-country']).toBe('JP');
    expect(capturedHeaders['x-currency']).toBe('JPY');
    expect(capturedHeaders['x-language']).toBe('ja');
    const out = spy.mock.calls.map(c => String(c[0])).join('');
    expect(JSON.parse(out).waybillNo).toBe('WB_123');
    spy.mockRestore();
  });

  it('forwards --country/--currency/--language as headers', async () => {
    const capturedHeaders: Record<string, string> = {};
    server.use(http.get(trackingUrl('ON_2'), ({ request }) => {
      request.headers.forEach((v, k) => { capturedHeaders[k] = v; });
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null, data: {},
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    trackCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(
      ['track', 'ON_2', '--country', 'US', '--currency', 'USD', '--language', 'en'],
      { from: 'user' },
    );
    expect(capturedHeaders['x-country']).toBe('US');
    expect(capturedHeaders['x-currency']).toBe('USD');
    expect(capturedHeaders['x-language']).toBe('en');
    spy.mockRestore();
  });
});
