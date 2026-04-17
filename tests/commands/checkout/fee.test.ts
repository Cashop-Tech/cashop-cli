import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../../helpers/mock-server.js';
import feeCmd from '../../../src/commands/checkout/fee.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Real API: POST /trade/cashop-order-prod/api/inventory/fee-trial
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-fee-trial.
const FEE_TRIAL_URL = 'http://tgw/trade/cashop-order-prod/api/inventory/fee-trial';

function makeCtx() {
  return {
    baseUrl: 'http://tgw', outputMode: 'json', env: 'stable',
    flags: {}, config: { auto_confirm: false } as unknown,
    provider: { kind: 'password', getAccessToken: async () => 'TOK', refresh: async () => {}, clear: async () => {} },
    logger: { info() {}, debug() {}, warn() {}, error() {}, close() {} },
    store: {} as unknown,
  };
}

describe('cashop checkout fee', () => {
  it('posts CSV batch-nos as array with sortType=1 and default outer-pkg', async () => {
    let captured: Record<string, unknown> = {};
    server.use(http.post(FEE_TRIAL_URL, async ({ request }) => {
      captured = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: { totalProductAmount: 1000, totalFreightAmount: 300, totalSettleAmount: 1430 },
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    feeCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(
      ['checkout', 'fee', '--batch-nos', 'B1,B2', '--address-id', 'A_1'],
      { from: 'user' },
    );
    expect(captured).toEqual({
      batchNos: ['B1', 'B2'],
      addressId: 'A_1',
      outerPackageCode: 'DEFAULT',
      sortType: 1,
    });
    const out = spy.mock.calls.map(c => String(c[0])).join('');
    expect(JSON.parse(out).totalSettleAmount).toBe(1430);
    spy.mockRestore();
  });

  it('forwards optional --line-code and --outer-pkg', async () => {
    let captured: Record<string, unknown> = {};
    server.use(http.post(FEE_TRIAL_URL, async ({ request }) => {
      captured = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null, data: {},
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    feeCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(
      ['checkout', 'fee', '--batch-nos', 'B1', '--address-id', 'A_1',
       '--line-code', 'LC_JP_STD', '--outer-pkg', 'CUSTOM_BOX'],
      { from: 'user' },
    );
    expect(captured.batchNos).toEqual(['B1']);
    expect(captured.lineCode).toBe('LC_JP_STD');
    expect(captured.outerPackageCode).toBe('CUSTOM_BOX');
    spy.mockRestore();
  });
});
