import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../../helpers/mock-server.js';
import compareCmd from '../../../src/commands/shipping/compare.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Real API: POST /trade/cashop-order-prod/api/inventory/shipping-fee-query
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-shipping-compare.
const SHIPPING_URL = 'http://tgw/trade/cashop-order-prod/api/inventory/shipping-fee-query';

function makeCtx() {
  return {
    baseUrl: 'http://tgw', outputMode: 'json', env: 'stable',
    flags: {}, config: { auto_confirm: false } as unknown,
    provider: { kind: 'password', getAccessToken: async () => 'TOK', refresh: async () => {}, clear: async () => {} },
    logger: { info() {}, debug() {}, warn() {}, error() {}, close() {} },
    store: {} as unknown,
  };
}

describe('cashop shipping compare', () => {
  it('posts required country/weight with default 10cm dimensions, sortType=1, and JP/JPY/ja headers', async () => {
    let captured: Record<string, unknown> = {};
    const capturedHeaders: Record<string, string> = {};
    server.use(http.post(SHIPPING_URL, async ({ request }) => {
      captured = (await request.json()) as Record<string, unknown>;
      request.headers.forEach((v, k) => { capturedHeaders[k] = v; });
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: { lines: [{ lineCode: 'JP_STD', freight: 800 }] },
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    compareCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(
      ['shipping', 'compare', '--country', 'JP', '--weight', '500'],
      { from: 'user' },
    );
    expect(captured).toEqual({
      destinationCountry: 'JP',
      weight: 500,
      length: 10,
      width: 10,
      height: 10,
      sortType: 1,
    });
    expect(capturedHeaders['x-country']).toBe('JP');
    expect(capturedHeaders['x-currency']).toBe('JPY');
    expect(capturedHeaders['x-language']).toBe('ja');
    const out = spy.mock.calls.map(c => String(c[0])).join('');
    expect(JSON.parse(out).lines[0].freight).toBe(800);
    spy.mockRestore();
  });

  it('forwards custom dimensions as numbers', async () => {
    let captured: Record<string, unknown> = {};
    server.use(http.post(SHIPPING_URL, async ({ request }) => {
      captured = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null, data: {},
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    compareCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(
      ['shipping', 'compare',
       '--country', 'US', '--weight', '1200',
       '--length', '25', '--width', '15', '--height', '8'],
      { from: 'user' },
    );
    expect(captured.destinationCountry).toBe('US');
    expect(captured.weight).toBe(1200);
    expect(captured.length).toBe(25);
    expect(captured.width).toBe(15);
    expect(captured.height).toBe(8);
    spy.mockRestore();
  });
});
