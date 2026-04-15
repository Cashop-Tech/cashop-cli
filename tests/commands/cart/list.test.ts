import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../../helpers/mock-server.js';
import listCmd from '../../../src/commands/cart/list.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const CART_URL = 'http://tgw/trade/cashop-order-prod/api/cart/list';

describe('cart list', () => {
  it('POSTs empty body and prints envelope data', async () => {
    server.use(http.post(CART_URL, async ({ request }) => {
      expect(await request.json()).toEqual({});
      expect(request.headers.get('authorization')).toBe('TOK');
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: {
          effectiveCartGroupList: [], invalidCartLineList: [], totalProductCount: 0,
          totalProductAmount: 0, totalFreightAmount: 0, totalDiscountAmount: 0,
          totalSettleAmount: 0, cartCount: 0, currency: null, ddpEnabled: false,
        },
      });
    }));
    const program = new Command();
    (program as any).__ctx = {
      baseUrl: 'http://tgw', outputMode: 'json', env: 'stable',
      provider: { kind: 'password', getAccessToken: async () => 'TOK', refresh: async () => {}, clear: async () => {} },
      logger: { info(){}, debug(){}, warn(){}, error(){}, close(){} },
      flags: {}, config: {} as any, store: {} as any,
    } as any;
    listCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(['cart'], { from: 'user' });
    const out = spy.mock.calls.map(c => String(c[0])).join('');
    expect(JSON.parse(out).cartCount).toBe(0);
    spy.mockRestore();
  });
});
