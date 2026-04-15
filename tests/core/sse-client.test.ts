import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest';
import { server, http, HttpResponse } from '../helpers/mock-server.js';
import { streamChat } from '../../src/core/sse-client.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const URL = 'http://tgw/ai/cashop-ai/rpc/auth/chat/message';

function sseResponse(events: string[]): Response {
  const body = events.map(e => `data: ${e}\n\n`).join('');
  return new HttpResponse(body, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('sse-client streamChat', () => {
  it('yields events from a multi-block SSE body', async () => {
    server.use(http.post(URL, () =>
      sseResponse([
        '{"type":"session_start","session_id":"S1"}',
        '{"type":"text_delta","content":"Hi "}',
        '{"type":"text_delta","content":"there"}',
        '{"type":"done","session_id":"S1"}',
      ])));
    const got: any[] = [];
    for await (const ev of streamChat({
      base: 'http://tgw', token: 'T', body: { message: 'hello' },
    })) got.push(ev);
    expect(got.map(e => e.type)).toEqual(['session_start', 'text_delta', 'text_delta', 'done']);
    expect(got[2].content).toBe('there');
  });

  it('handles a partial buffer split across reads', async () => {
    server.use(http.post(URL, () =>
      sseResponse([
        '{"type":"text_delta","content":"abc"}',
        '{"type":"text_delta","content":"def"}',
      ])));
    const got: any[] = [];
    for await (const ev of streamChat({
      base: 'http://tgw', token: 'T', body: { message: 'hi' },
    })) got.push(ev);
    expect(got.length).toBe(2);
    expect(got[0].content + got[1].content).toBe('abcdef');
  });

  it('throws NetworkError on non-2xx', async () => {
    server.use(http.post(URL, () =>
      HttpResponse.json({ error: 'boom' }, { status: 500 })));
    await expect(async () => {
      for await (const _ of streamChat({
        base: 'http://tgw', token: 'T', body: {},
      })) { /* drain */ }
    }).rejects.toThrow(/HTTP 500/);
  });
});
