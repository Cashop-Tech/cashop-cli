import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../helpers/mock-server.js';
import recommendCmd from '../../src/commands/recommend.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Real API: POST /business/cashop-business-aggr-prod/open/product/recommend
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-product (gateway_post prepends /open).
const RECOMMEND_URL = 'http://tgw/business/cashop-business-aggr-prod/open/product/recommend';

function makeCtx() {
  return {
    baseUrl: 'http://tgw', outputMode: 'json', env: 'stable',
    flags: {}, config: { auto_confirm: false } as unknown,
    provider: { kind: 'password', getAccessToken: async () => 'TOK', refresh: async () => {}, clear: async () => {} },
    logger: { info() {}, debug() {}, warn() {}, error() {}, close() {} },
    store: {} as unknown,
  };
}

describe('cashop recommend', () => {
  it('POSTs the shell-parity body (scene=product_detail, spuCodes=[<spu>]) with JP/JPY/ja headers', async () => {
    let captured: Record<string, unknown> = {};
    const capturedHeaders: Record<string, string> = {};
    server.use(http.post(RECOMMEND_URL, async ({ request }) => {
      captured = (await request.json()) as Record<string, unknown>;
      request.headers.forEach((v, k) => { capturedHeaders[k] = v; });
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: { total: 1, data: [{ spuCode: 'JP_REC_1', uniqueId: 'JP_REC_1' }] },
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    recommendCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(['recommend', 'JP_123'], { from: 'user' });

    expect(captured.scene).toBe('product_detail');
    expect(captured.spuCodes).toEqual(['JP_123']);
    expect(captured.pageIndex).toBe(1);
    expect(captured.pageSize).toBe(10);
    expect(String(captured.searchRequestId)).toMatch(/^cli-\d{10}-\d+$/);
    expect(capturedHeaders['x-country']).toBe('JP');
    expect(capturedHeaders['x-currency']).toBe('JPY');
    expect(capturedHeaders['x-language']).toBe('ja');
    const out = spy.mock.calls.map(c => String(c[0])).join('');
    expect(JSON.parse(out).total).toBe(1);
    spy.mockRestore();
  });

  it('forwards --page/--page-size/--country/--currency/--language overrides', async () => {
    let captured: Record<string, unknown> = {};
    const capturedHeaders: Record<string, string> = {};
    server.use(http.post(RECOMMEND_URL, async ({ request }) => {
      captured = (await request.json()) as Record<string, unknown>;
      request.headers.forEach((v, k) => { capturedHeaders[k] = v; });
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: { total: 0, data: [] },
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    recommendCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(
      ['recommend', 'US_9', '--page', '3', '--page-size', '25', '--country', 'US', '--currency', 'USD', '--language', 'en'],
      { from: 'user' },
    );
    expect(captured.pageIndex).toBe(3);
    expect(captured.pageSize).toBe(25);
    expect(capturedHeaders['x-country']).toBe('US');
    expect(capturedHeaders['x-currency']).toBe('USD');
    expect(capturedHeaders['x-language']).toBe('en');
    spy.mockRestore();
  });
});
