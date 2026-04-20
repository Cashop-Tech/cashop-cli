import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../../helpers/mock-server.js';
import getCmd from '../../../src/commands/product/get.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const DETAIL_URL = 'http://tgw/business/cashop-business-aggr-prod/open/product/v2';

describe('product get', () => {
  it('POSTs spuCode and returns the product document', async () => {
    server.use(http.post(DETAIL_URL, async ({ request }) => {
      const body = await request.json() as any;
      expect(body.spuCode).toBe('JP_1');
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: { spuCode: 'JP_1', suppInfoVO: { title: 'Phone' } },
      });
    }));
    const program = new Command();
    (program as any).__ctx = {
      baseUrl: 'http://tgw', outputMode: 'json',
      provider: { kind: 'none', getAccessToken: async () => null, refresh: async () => {}, clear: async () => {} },
      logger: { info(){}, debug(){}, warn(){}, error(){}, close(){} },
      flags: {}, config: {} as any, store: {} as any, env: 'stable',
    } as any;
    getCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(['product', 'JP_1'], { from: 'user' });
    const out = spy.mock.calls.map(c => String(c[0])).join('');
    expect(JSON.parse(out).spuCode).toBe('JP_1');
    spy.mockRestore();
  });
});
