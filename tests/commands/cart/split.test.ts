import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../../helpers/mock-server.js';
import splitCmd from '../../../src/commands/cart/split.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Real API: POST /trade/cashop-order-prod/api/cart/split
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-cart-split.
const SPLIT_URL = 'http://tgw/trade/cashop-order-prod/api/cart/split';

function makeCtx() {
  return {
    baseUrl: 'http://tgw', outputMode: 'json', env: 'stable',
    flags: {}, config: { auto_confirm: false } as unknown,
    provider: { kind: 'password', getAccessToken: async () => 'TOK', refresh: async () => {}, clear: async () => {} },
    logger: { info() {}, debug() {}, warn() {}, error() {}, close() {} },
    store: {} as unknown,
  };
}

describe('cashop cart split', () => {
  it('first-pass with no flags posts bare {} and JP/JPY/ja headers (all-cart preview)', async () => {
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
    await program.parseAsync(['cart', 'split'], { from: 'user' });
    expect(captured).toEqual({});
    expect(capturedHeaders['x-country']).toBe('JP');
    expect(capturedHeaders['x-currency']).toBe('JPY');
    expect(capturedHeaders['x-language']).toBe('ja');
    spy.mockRestore();
  });

  it('second-pass: forwards --address-id + --cart-ids (CSV → cartNos) + --delivery-type', async () => {
    let captured: Record<string, unknown> = {};
    server.use(http.post(SPLIT_URL, async ({ request }) => {
      captured = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: { totalSettleAmount: 1430, deliveryType: 'CONSOLIDATION' },
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    splitCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(
      ['cart', 'split',
       '--address-id', 'A_1', '--cart-ids', 'C1,C2,C3', '--delivery-type', 'CONSOLIDATION'],
      { from: 'user' },
    );
    expect(captured).toEqual({
      addressId: 'A_1',
      cartNos: ['C1', 'C2', 'C3'],
      deliveryType: 'CONSOLIDATION',
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
      ['cart', 'split', '--delivery-type', 'BOGUS'],
      { from: 'user' },
    )).rejects.toBeTruthy();
    errSpy.mockRestore(); exitSpy.mockRestore();
  });
});
