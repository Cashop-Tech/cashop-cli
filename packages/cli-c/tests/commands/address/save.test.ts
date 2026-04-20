import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../../helpers/mock-server.js';
import saveCmd from '../../../src/commands/address/save.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Real API: POST /business/cashop-business-aggr-prod/api/member/address/save
// Captured 2026-04-17 from cashop-ai/cli/consumer/cashop-address-save.
const SAVE_URL = 'http://tgw/business/cashop-business-aggr-prod/api/member/address/save';

function makeCtx() {
  return {
    baseUrl: 'http://tgw', outputMode: 'json', env: 'stable',
    flags: {}, config: { auto_confirm: false } as unknown,
    provider: { kind: 'password', getAccessToken: async () => 'TOK', refresh: async () => {}, clear: async () => {} },
    logger: { info() {}, debug() {}, warn() {}, error() {}, close() {} },
    store: {} as unknown,
  };
}

const REQUIRED_ARGS = [
  '--first-name', '太郎', '--last-name', '山田', '--phone', '09012345678',
  '--area-code', '+81', '--country', 'JP', '--province', '東京都',
  '--city', '渋谷区', '--detail', '神南1-2-3', '--postal-code', '150-0001',
];

describe('cashop address save', () => {
  it('create: posts full CJK body with isDefault=false and country-driven header', async () => {
    let captured: Record<string, unknown> = {};
    const capturedHeaders: Record<string, string> = {};
    server.use(http.post(SAVE_URL, async ({ request }) => {
      request.headers.forEach((v, k) => { capturedHeaders[k] = v; });
      captured = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: { addressId: 'ADDR_NEW' },
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    saveCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(['address', 'save', ...REQUIRED_ARGS], { from: 'user' });
    expect(captured).toEqual({
      receiverFirstName: '太郎',
      receiverLastName: '山田',
      receiverPhone: '09012345678',
      phoneAreaCode: '+81',
      country: 'JP',
      province: '東京都',
      city: '渋谷区',
      detailAddress: '神南1-2-3',
      postalCode: '150-0001',
      isDefault: false,
    });
    expect(capturedHeaders['x-country']).toBe('JP');
    expect(capturedHeaders['x-language']).toBe('ja');
    const out = spy.mock.calls.map(c => String(c[0])).join('');
    expect(JSON.parse(out).addressId).toBe('ADDR_NEW');
    spy.mockRestore();
  });

  it('update: --address-id included, --default sets isDefault=true', async () => {
    let captured: Record<string, unknown> = {};
    server.use(http.post(SAVE_URL, async ({ request }) => {
      captured = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({
        code: '00000', success: true, message: '成功', extAttrs: null,
        data: { addressId: 'ADDR_EXISTING' },
      });
    }));
    const program = new Command();
    (program as unknown as { __ctx: unknown }).__ctx = makeCtx();
    saveCmd.register(program);
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(
      ['address', 'save', ...REQUIRED_ARGS, '--address-id', 'ADDR_EXISTING', '--default'],
      { from: 'user' },
    );
    expect(captured.addressId).toBe('ADDR_EXISTING');
    expect(captured.isDefault).toBe(true);
    spy.mockRestore();
  });
});
