import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../../helpers/mock-server.js';
import listCmd from '../../../src/commands/address/list.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Real API: POST /business/cashop-business-aggr-prod/api/member/address/list
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-address-list.
const LIST_URL = 'http://tgw/business/cashop-business-aggr-prod/api/member/address/list';

function makeCtx() {
  return {
    baseUrl: 'http://tgw', outputMode: 'json', env: 'stable',
    flags: {}, config: { auto_confirm: false } as unknown,
    provider: { kind: 'password', getAccessToken: async () => 'TOK', refresh: async () => {}, clear: async () => {} },
    logger: { info() {}, debug() {}, warn() {}, error() {}, close() {} },
    store: {} as unknown,
  };
}

describe('cashop address list', () => {
  it('posts default paging {pageIndex:1, pageSize:20} with JP/ja headers and parses addresses', async () => {
    let captured: Record<string, unknown> = {};
    const capturedHeaders: Record<string, string> = {};
    server.use(http.post(LIST_URL, async ({ request }) => {
      request.headers.forEach((v, k) => { capturedHeaders[k] = v; });
      captured = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: {
          data: [
            {
              addressId: 'ADDR_1', receiverFirstName: '太郎', receiverLastName: '山田',
              receiverPhone: '09012345678', countryName: 'Japan', provinceName: '東京都',
              cityName: '渋谷区', detailAddress: '神南1-2-3', postalCode: '150-0001',
              isDefault: true,
            },
          ],
          total: 1, pageIndex: 1, pageSize: 20,
        },
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    listCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(['address', 'list'], { from: 'user' });
    expect(captured).toEqual({ pageIndex: 1, pageSize: 20 });
    expect(capturedHeaders['x-country']).toBe('JP');
    expect(capturedHeaders['x-language']).toBe('ja');
    const out = spy.mock.calls.map(c => String(c[0])).join('');
    const parsed = JSON.parse(out);
    expect(parsed.data[0].addressId).toBe('ADDR_1');
    expect(parsed.data[0].isDefault).toBe(true);
    spy.mockRestore();
  });

  it('forwards --page, --page-size, and locale flags', async () => {
    let captured: Record<string, unknown> = {};
    const capturedHeaders: Record<string, string> = {};
    server.use(http.post(LIST_URL, async ({ request }) => {
      request.headers.forEach((v, k) => { capturedHeaders[k] = v; });
      captured = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: { data: [], total: 0 },
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    listCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(
      ['address', 'list', '--page', '3', '--page-size', '5', '--country', 'US', '--language', 'en'],
      { from: 'user' },
    );
    expect(captured).toEqual({ pageIndex: 3, pageSize: 5 });
    expect(capturedHeaders['x-country']).toBe('US');
    expect(capturedHeaders['x-language']).toBe('en');
    spy.mockRestore();
  });
});
