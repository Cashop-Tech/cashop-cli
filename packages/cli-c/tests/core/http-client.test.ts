import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { server, http, HttpResponse } from '../helpers/mock-server.js';
import { gatewayRequest } from '../../src/core/http-client.js';
import {
  ReauthRequired, NotFoundError, ForbiddenError, ConflictError, HttpError, BusinessError, NetworkError,
} from '@cashop/core';

const BASE = 'http://test-gateway';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const ok = <T,>(data: T) => ({ code: '00000', success: true, message: 'ok', data, extAttrs: null });

describe('http-client', () => {
  it('sends authorization header as raw token (no Bearer prefix)', async () => {
    let captured = '';
    server.use(http.post(`${BASE}/member/probe`, ({ request }) => {
      captured = request.headers.get('authorization') ?? '';
      return HttpResponse.json(ok({ ping: true }));
    }));
    await gatewayRequest(BASE, '/member/probe', {
      method: 'POST', body: {},
      provider: { kind: 'password', getAccessToken: async () => 'TOK123', refresh: async () => {}, clear: async () => {} },
    });
    expect(captured).toBe('TOK123');
  });

  it('injects default X-Country / X-Currency / X-Language', async () => {
    let country = '', currency = '', lang = '';
    server.use(http.post(`${BASE}/ping`, ({ request }) => {
      country = request.headers.get('x-country') ?? '';
      currency = request.headers.get('x-currency') ?? '';
      lang = request.headers.get('x-language') ?? '';
      return HttpResponse.json(ok({}));
    }));
    await gatewayRequest(BASE, '/ping', { method: 'POST', body: {} });
    expect(country).toBe('JP');
    expect(currency).toBe('JPY');
    expect(lang).toBe('en');
  });

  it('unwraps envelope: returns data for code=00000', async () => {
    server.use(http.post(`${BASE}/ok`, () => HttpResponse.json(ok({ n: 42 }))));
    const r = await gatewayRequest<{ n: number }>(BASE, '/ok', { method: 'POST', body: {} });
    expect(r.n).toBe(42);
  });

  it('throws BusinessError for code != 00000 (HTTP 200 with success:false)', async () => {
    server.use(http.post(`${BASE}/biz`, () =>
      HttpResponse.json({ code: '702021', success: false, message: 'bad creds', data: null, extAttrs: null })));
    await expect(gatewayRequest(BASE, '/biz', { method: 'POST', body: {} }))
      .rejects.toBeInstanceOf(BusinessError);
  });

  it('reauth code triggers refresh + retry; still reauth → ReauthRequired', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const getTok = vi.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('new');
    let calls = 0;
    server.use(http.post(`${BASE}/protected`, () => {
      calls++;
      return HttpResponse.json({ code: '702001', success: false, message: 'token expired', data: null });
    }));
    await expect(gatewayRequest(BASE, '/protected', {
      method: 'POST', body: {},
      provider: { kind: 'password', getAccessToken: getTok, refresh, clear: async () => {} },
    })).rejects.toBeInstanceOf(ReauthRequired);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(calls).toBe(2);
  });

  it('maps transport 404 → NotFoundError', async () => {
    server.use(http.post(`${BASE}/missing`, () => new HttpResponse(null, { status: 404 })));
    await expect(gatewayRequest(BASE, '/missing', { method: 'POST', body: {} })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('maps 403 → Forbidden, 409 → Conflict', async () => {
    server.use(http.post(`${BASE}/forbid`, () => new HttpResponse(null, { status: 403 })));
    server.use(http.post(`${BASE}/conflict`, () => new HttpResponse(null, { status: 409 })));
    await expect(gatewayRequest(BASE, '/forbid', { method: 'POST', body: {} })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(gatewayRequest(BASE, '/conflict', { method: 'POST', body: {} })).rejects.toBeInstanceOf(ConflictError);
  });

  it('network failure retries twice then throws NetworkError', async () => {
    server.use(http.post(`${BASE}/down`, () => HttpResponse.error()));
    await expect(gatewayRequest(BASE, '/down', { method: 'POST', body: {} })).rejects.toBeInstanceOf(NetworkError);
  });
});
