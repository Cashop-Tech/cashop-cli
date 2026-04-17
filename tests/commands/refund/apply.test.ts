import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../../helpers/mock-server.js';
import applyCmd from '../../../src/commands/refund/apply.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Real API: POST /trade/cashop-aftersale/operation-support/cashop-aftersale/api/aftersale/apply
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-refund-apply.
const APPLY_URL = 'http://tgw/trade/cashop-aftersale/operation-support/cashop-aftersale/api/aftersale/apply';

function makeCtx() {
  return {
    baseUrl: 'http://tgw', outputMode: 'json', env: 'stable',
    flags: {}, config: { auto_confirm: false } as unknown,
    provider: { kind: 'password', getAccessToken: async () => 'TOK', refresh: async () => {}, clear: async () => {} },
    logger: { info() {}, debug() {}, warn() {}, error() {}, close() {} },
    store: {} as unknown,
  };
}

describe('cashop refund apply', () => {
  it('posts required fields with default quantity=1 and prints the service number', async () => {
    let captured: Record<string, unknown> = {};
    server.use(http.post(APPLY_URL, async ({ request }) => {
      captured = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: 'AS202604100012',
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    applyCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(
      ['refund', 'apply', '--order-no', 'ON_1', '--as-type', '2', '--reason-code', '5'],
      { from: 'user' },
    );
    expect(captured).toEqual({
      orderNo: 'ON_1', asType: 2, applyReason: 5, applyQuantity: 1,
    });
    const out = spy.mock.calls.map(c => String(c[0])).join('');
    expect(out.trim()).toBe('"AS202604100012"');
    spy.mockRestore();
  });

  it('forwards --sku-order-no, --quantity, --remark', async () => {
    let captured: Record<string, unknown> = {};
    server.use(http.post(APPLY_URL, async ({ request }) => {
      captured = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null, data: 'AS_2',
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    applyCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(
      ['refund', 'apply',
       '--order-no', 'ON_2', '--as-type', '4', '--reason-code', '6',
       '--sku-order-no', 'SKU_3', '--quantity', '2', '--remark', '包装破损'],
      { from: 'user' },
    );
    expect(captured).toEqual({
      orderNo: 'ON_2', asType: 4, applyReason: 6, applyQuantity: 2,
      skuOrderNo: 'SKU_3', applyRemark: '包装破损',
    });
    spy.mockRestore();
  });

  it.each([
    ['--as-type', '3'],
    ['--as-type', '99'],
    ['--reason-code', '-1'],
    ['--reason-code', '7'],
  ])('rejects invalid %s=%s', async (flag, value) => {
    const program = new Command();
    program.exitOverride();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    applyCmd.register(program);
    const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit'); });
    const baseArgs = ['refund', 'apply', '--order-no', 'ON_X', '--as-type', '2', '--reason-code', '0'];
    const idx = baseArgs.indexOf(flag);
    baseArgs[idx + 1] = value;
    await expect(program.parseAsync(baseArgs, { from: 'user' })).rejects.toBeTruthy();
    errSpy.mockRestore(); exitSpy.mockRestore();
  });
});
