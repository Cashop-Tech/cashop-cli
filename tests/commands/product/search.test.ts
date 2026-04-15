import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../../helpers/mock-server.js';
import searchCmd from '../../../src/commands/product/search.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const SEARCH_URL = 'http://tgw/business/cashop-business-aggr-prod/open/product/list';

describe('product search', () => {
  it('POSTs to /open/product/list with the correct search envelope', async () => {
    server.use(http.post(SEARCH_URL, async ({ request }) => {
      const body = await request.json() as any;
      expect(body.searchParams.keyword).toBe('phone');
      expect(body.searchParams.scene).toBe('SEARCH_PRODUCT');
      expect(body.searchParams.pageSize).toBe(5);
      expect(body.searchParams.pageNum).toBe(2);
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: {
          pageIndexStartZero: false, pageIndex: null, pageSize: null, total: 23, pages: 5,
          data: [{
            uniqueId: 'JP_1', spuCode: 'JP_1', productNum: '1',
            suppInfoVO: { title: 'Phone', sellOut: false, spuOnline: true },
            skuMainImageUrls: [],
            skuCurrentPriceInfo: { tagPrice: 1000, standPrice: 900, memberPrice: 800, promoStatus: 2, taxIncludedPrice: 900 },
          }],
          hasNext: true,
        },
      });
    }));
    const program = new Command();
    (program as any).__ctx = {
      env: 'stable', baseUrl: 'http://tgw', outputMode: 'json',
      provider: { kind: 'none', getAccessToken: async () => null, refresh: async () => {}, clear: async () => {} },
      logger: { info(){}, debug(){}, warn(){}, error(){}, close(){} },
      flags: {}, config: {} as any, store: {} as any,
    } as any;
    searchCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(['search', 'phone', '--page', '2', '--page-size', '5'], { from: 'user' });
    const out = spy.mock.calls.map(c => String(c[0])).join('');
    const parsed = JSON.parse(out);
    expect(parsed.data[0].suppInfoVO.title).toBe('Phone');
    expect(parsed.total).toBe(23);
    spy.mockRestore();
  });
});
