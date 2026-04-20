import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../../helpers/mock-server.js';
import addCmd from '../../../src/commands/cart/add.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const ADD_URL = 'http://tgw/trade/cashop-order-prod/api/cart/add';

describe('cart add', () => {
  it('posts skuId/spuCode/quantity with --yes skipping confirm', async () => {
    let captured: any = null;
    server.use(http.post(ADD_URL, async ({ request }) => {
      captured = await request.json();
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: { cartCount: 1, effectiveCartGroupList: [], invalidCartLineList: [], totalProductCount: 1,
          totalProductAmount: 0, totalFreightAmount: 0, totalDiscountAmount: 0, totalSettleAmount: 0,
          currency: null, ddpEnabled: false },
      });
    }));
    const program = new Command();
    (program as any).__ctx = {
      baseUrl: 'http://tgw', outputMode: 'json', env: 'stable',
      flags: { yes: true }, config: { auto_confirm: false } as any,
      provider: { kind: 'password', getAccessToken: async () => 'TOK', refresh: async () => {}, clear: async () => {} },
      logger: { info(){}, debug(){}, warn(){}, error(){}, close(){} },
      store: {} as any,
    } as any;
    addCmd.register(program);
    await program.parseAsync(['cart', 'add', '--spu', 'JP_1', '--sku', 's1', '--qty', '1'], { from: 'user' });
    expect(captured).toEqual({ skuId: 's1', spuCode: 'JP_1', quantity: 1 });
  });
});
