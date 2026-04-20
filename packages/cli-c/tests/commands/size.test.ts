import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../helpers/mock-server.js';
import sizeCmd from '../../src/commands/size.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Real API: POST /business/cashop-business-aggr-prod/open/product/size-assistant
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-size-assistant.
const SIZE_URL = 'http://tgw/business/cashop-business-aggr-prod/open/product/size-assistant';

function makeCtx() {
  return {
    baseUrl: 'http://tgw', outputMode: 'json', env: 'stable',
    flags: {}, config: { auto_confirm: false } as unknown,
    provider: { kind: 'password', getAccessToken: async () => 'TOK', refresh: async () => {}, clear: async () => {} },
    logger: { info() {}, debug() {}, warn() {}, error() {}, close() {} },
    store: {} as unknown,
  };
}

describe('cashop size', () => {
  it('posts {spuCode} with JP/JPY/ja defaults and returns opaque data', async () => {
    let captured: Record<string, unknown> = {};
    const capturedHeaders: Record<string, string> = {};
    server.use(http.post(SIZE_URL, async ({ request }) => {
      captured = (await request.json()) as Record<string, unknown>;
      request.headers.forEach((v, k) => { capturedHeaders[k] = v; });
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: { recommendedSize: 'M', confidence: 0.85 },
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    sizeCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(['size', 'SPU_1'], { from: 'user' });
    expect(captured).toEqual({ spuCode: 'SPU_1' });
    expect(capturedHeaders['x-country']).toBe('JP');
    expect(capturedHeaders['x-currency']).toBe('JPY');
    expect(capturedHeaders['x-language']).toBe('ja');
    const out = spy.mock.calls.map(c => String(c[0])).join('');
    expect(JSON.parse(out).recommendedSize).toBe('M');
    spy.mockRestore();
  });

  it('forwards --country/--currency/--language overrides', async () => {
    const capturedHeaders: Record<string, string> = {};
    server.use(http.post(SIZE_URL, async ({ request }) => {
      request.headers.forEach((v, k) => { capturedHeaders[k] = v; });
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null, data: {},
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    sizeCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(
      ['size', 'SPU_2', '--country', 'US', '--currency', 'USD', '--language', 'en'],
      { from: 'user' },
    );
    expect(capturedHeaders['x-country']).toBe('US');
    expect(capturedHeaders['x-currency']).toBe('USD');
    expect(capturedHeaders['x-language']).toBe('en');
    spy.mockRestore();
  });
});
