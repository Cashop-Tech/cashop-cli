import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../../helpers/mock-server.js';
import listCmd from '../../../src/commands/order/list.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const LIST_URL = 'http://tgw/trade/cashop-order-prod/api/order/list';

describe('order list', () => {
  it('POSTs pageIndex/pageSize and returns list data', async () => {
    server.use(http.post(LIST_URL, async ({ request }) => {
      const body = await request.json() as any;
      expect(body).toEqual({ pageIndex: 2, pageSize: 5 });
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: {
          pageIndex: 2, pageSize: 5, total: 0, data: [],
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
    await program.parseAsync(['orders', '--page', '2', '--page-size', '5'], { from: 'user' });
    const out = spy.mock.calls.map(c => String(c[0])).join('');
    expect(JSON.parse(out).pageIndex).toBe(2);
    spy.mockRestore();
  });
});
