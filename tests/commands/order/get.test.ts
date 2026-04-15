import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../../helpers/mock-server.js';
import getCmd from '../../../src/commands/order/get.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Real API: GET /trade/cashop-order-prod/api/order/{orderNo} (confirmed via Task 22 Step 1 probe
// against OrderQueryController#queryOrderDetail in cashop-trade).
const DETAIL_URL = 'http://tgw/trade/cashop-order-prod/api/order/ORD-1';

describe('order get', () => {
  it('GETs /api/order/{orderNo} and returns the order document', async () => {
    server.use(http.get(DETAIL_URL, () => {
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: { orderNo: 'ORD-1', orderStatus: 2, totalAmount: 100, currency: 'USD', createTime: '2026-04-14T00:00:00Z' },
      });
    }));
    const program = new Command();
    (program as any).__ctx = {
      baseUrl: 'http://tgw', outputMode: 'json', env: 'stable',
      provider: { kind: 'password', getAccessToken: async () => 'TOK', refresh: async () => {}, clear: async () => {} },
      logger: { info(){}, debug(){}, warn(){}, error(){}, close(){} },
      flags: {}, config: {} as any, store: {} as any,
    } as any;
    getCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(['order', 'ORD-1'], { from: 'user' });
    const out = spy.mock.calls.map(c => String(c[0])).join('');
    expect(JSON.parse(out).orderNo).toBe('ORD-1');
    spy.mockRestore();
  });
});
