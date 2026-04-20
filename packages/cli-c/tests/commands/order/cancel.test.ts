import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../../helpers/mock-server.js';
import cancelCmd from '../../../src/commands/order/cancel.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Real API: POST /trade/cashop-order-prod/api/order/cancelOrderBeforePay
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-order-cancel.
const CANCEL_URL = 'http://tgw/trade/cashop-order-prod/api/order/cancelOrderBeforePay';

function makeCtx() {
  return {
    baseUrl: 'http://tgw', outputMode: 'json', env: 'stable',
    flags: { yes: true }, config: { auto_confirm: false } as unknown,
    provider: { kind: 'password', getAccessToken: async () => 'TOK', refresh: async () => {}, clear: async () => {} },
    logger: { info() {}, debug() {}, warn() {}, error() {}, close() {} },
    store: {} as unknown,
  };
}

describe('order cancel', () => {
  it('posts default reason OTHER with -y and JP/JPY/ja headers and prints boolean data', async () => {
    let captured: Record<string, unknown> = {};
    const capturedHeaders: Record<string, string> = {};
    server.use(http.post(CANCEL_URL, async ({ request }) => {
      captured = (await request.json()) as Record<string, unknown>;
      request.headers.forEach((v, k) => { capturedHeaders[k] = v; });
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null, data: true,
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    cancelCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(['order', 'cancel', 'OG_1'], { from: 'user' });
    expect(captured).toEqual({
      orderGroupNo: 'OG_1',
      cancelReasonCode: 'OTHER',
      cancelSource: 'USER',
      cancelReasonMessage: 'cancelled via cashop-cli',
    });
    expect(capturedHeaders['x-language']).toBe('ja');
    const out = spy.mock.calls.map(c => String(c[0])).join('');
    expect(out.trim()).toBe('true');
    spy.mockRestore();
  });

  it('forwards custom --reason-code and --reason', async () => {
    let captured: Record<string, unknown> = {};
    server.use(http.post(CANCEL_URL, async ({ request }) => {
      captured = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null, data: true,
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    cancelCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(
      ['order', 'cancel', 'OG_2', '--reason-code', 'NO_LONGER_NEEDED', '--reason', 'changed my mind'],
      { from: 'user' },
    );
    expect(captured.cancelReasonCode).toBe('NO_LONGER_NEEDED');
    expect(captured.cancelReasonMessage).toBe('changed my mind');
    spy.mockRestore();
  });
});
