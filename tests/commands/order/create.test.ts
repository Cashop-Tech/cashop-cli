import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../../helpers/mock-server.js';
import createCmd from '../../../src/commands/order/create.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Real API: POST /trade/cashop-order-prod/api/order/create
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-order-create (OrderCreateController).
const CREATE_URL = 'http://tgw/trade/cashop-order-prod/api/order/create';

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    baseUrl: 'http://tgw', outputMode: 'json', env: 'stable',
    flags: { yes: true }, config: { auto_confirm: false } as unknown,
    provider: { kind: 'password', getAccessToken: async () => 'TOK', refresh: async () => {}, clear: async () => {} },
    logger: { info() {}, debug() {}, warn() {}, error() {}, close() {} },
    store: {} as unknown,
    ...overrides,
  };
}

describe('order create', () => {
  it('posts single-SKU direct buy body with explicit --address and JP/JPY/ja headers', async () => {
    let captured: unknown = null;
    const capturedHeaders: Record<string, string> = {};
    server.use(http.post(CREATE_URL, async ({ request }) => {
      captured = await request.json();
      request.headers.forEach((v, k) => { capturedHeaders[k] = v; });
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: {
          orderGroupNo: 'OG_1', orderNoList: ['ON_1'],
          totalAmount: 609, currency: 'JPY', orderStatus: 'PENDING_PAYMENT',
        },
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    createCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(
      ['order', 'create', '--spu', 'JP_1', '--sku', 's1', '--qty', '2', '--address', 'ADDR_9'],
      { from: 'user' },
    );
    expect(captured).toEqual({
      addressId: 'ADDR_9',
      orderWay: 1,
      products: [{ spuCode: 'JP_1', skuId: 's1', quantity: 2 }],
      deliveryType: 'CONSOLIDATION',
    });
    expect(capturedHeaders['x-country']).toBe('JP');
    expect(capturedHeaders['x-currency']).toBe('JPY');
    expect(capturedHeaders['x-language']).toBe('ja');
    const out = spy.mock.calls.map(c => String(c[0])).join('');
    expect(JSON.parse(out).orderGroupNo).toBe('OG_1');
    spy.mockRestore();
  });

  it('includes businessOrderNo when provided (idempotency)', async () => {
    let captured: Record<string, unknown> = {};
    server.use(http.post(CREATE_URL, async ({ request }) => {
      captured = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: { orderGroupNo: 'OG_2', orderNoList: ['ON_2'], totalAmount: 100, currency: 'JPY', orderStatus: 'PENDING_PAYMENT' },
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    createCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(
      ['order', 'create', '--spu', 'JP_1', '--sku', 's1', '--qty', '1', '--address', 'A', '--business-order-no', 'biz_abc'],
      { from: 'user' },
    );
    expect(captured.businessOrderNo).toBe('biz_abc');
    spy.mockRestore();
  });

  it('passes DIRECT_MAIL fields through when both dm-line-code and dm-shipping-fee set', async () => {
    let captured: Record<string, unknown> = {};
    server.use(http.post(CREATE_URL, async ({ request }) => {
      captured = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: { orderGroupNo: 'OG_3', orderNoList: ['ON_3'], totalAmount: 100, currency: 'JPY', orderStatus: 'PENDING_PAYMENT' },
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    createCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(
      ['order', 'create',
        '--spu', 'JP_1', '--sku', 's1', '--qty', '1', '--address', 'A',
        '--delivery-type', 'DIRECT_MAIL', '--dm-line-code', 'LINE_JP', '--dm-shipping-fee', '800'],
      { from: 'user' },
    );
    expect(captured.deliveryType).toBe('DIRECT_MAIL');
    expect(captured.dmLineCode).toBe('LINE_JP');
    expect(captured.dmShippingFee).toBe('800');
    spy.mockRestore();
  });
});
