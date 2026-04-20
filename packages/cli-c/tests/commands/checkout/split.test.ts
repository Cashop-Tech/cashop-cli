import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../../helpers/mock-server.js';
import splitCmd from '../../../src/commands/checkout/split.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Real API: POST /trade/cashop-order-prod/api/cart/direct-split
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-direct-split.
const SPLIT_URL = 'http://tgw/trade/cashop-order-prod/api/cart/direct-split';

function makeCtx() {
  return {
    baseUrl: 'http://tgw', outputMode: 'json', env: 'stable',
    flags: {}, config: { auto_confirm: false } as unknown,
    provider: { kind: 'password', getAccessToken: async () => 'TOK', refresh: async () => {}, clear: async () => {} },
    logger: { info() {}, debug() {}, warn() {}, error() {}, close() {} },
    store: {} as unknown,
  };
}

describe('cashop checkout split', () => {
  it('first-pass: posts product array + targetCountryCode with JP/JPY/ja headers', async () => {
    let captured: Record<string, unknown> = {};
    const capturedHeaders: Record<string, string> = {};
    server.use(http.post(SPLIT_URL, async ({ request }) => {
      request.headers.forEach((v, k) => { capturedHeaders[k] = v; });
      captured = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: { hasAvailableLines: true, effectiveCartGroupList: [] },
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    splitCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(
      ['checkout', 'split', '--spu', 'SPU_1', '--sku', 'SKU_1', '--qty', '2'],
      { from: 'user' },
    );
    expect(captured).toEqual({
      products: [{ spuCode: 'SPU_1', skuId: 'SKU_1', quantity: 2 }],
      targetCountryCode: 'JP',
    });
    expect(capturedHeaders['x-country']).toBe('JP');
    expect(capturedHeaders['x-currency']).toBe('JPY');
    expect(capturedHeaders['x-language']).toBe('ja');
    spy.mockRestore();
  });

  it('second-pass: forwards --address-id + --delivery-type + --size-format (top & product)', async () => {
    let captured: Record<string, unknown> = {};
    server.use(http.post(SPLIT_URL, async ({ request }) => {
      captured = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: { totalSettleAmount: 1430, deliveryType: 'DIRECT_MAIL' },
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    splitCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(
      ['checkout', 'split',
       '--spu', 'SPU_1', '--sku', 'SKU_1', '--qty', '1',
       '--address-id', 'A_1', '--delivery-type', 'DIRECT_MAIL', '--size-format', 'JP',
       '--country', 'US', '--currency', 'USD', '--language', 'en'],
      { from: 'user' },
    );
    expect(captured).toEqual({
      products: [{ spuCode: 'SPU_1', skuId: 'SKU_1', quantity: 1, sizeFormat: 'JP' }],
      targetCountryCode: 'US',
      addressId: 'A_1',
      deliveryType: 'DIRECT_MAIL',
      sizeFormat: 'JP',
    });
    spy.mockRestore();
  });

  it('rejects invalid --delivery-type', async () => {
    const program = new Command();
    program.exitOverride();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    splitCmd.register(program);
    const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    await expect(program.parseAsync(
      ['checkout', 'split', '--spu', 'S', '--sku', 'K', '--qty', '1', '--delivery-type', 'BOGUS'],
      { from: 'user' },
    )).rejects.toBeTruthy();
    errSpy.mockRestore(); exitSpy.mockRestore();
  });
});
