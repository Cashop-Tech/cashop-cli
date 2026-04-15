import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest';
import { Command } from 'commander';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { server, http, HttpResponse } from '../helpers/mock-server.js';
import askCmd from '../../src/commands/ask.js';
import { loadChatState } from '../../src/tui/session.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let tmp: string;

function sseBody(events: string[]): string {
  return events.map(e => `data: ${e}\n\n`).join('');
}

function makeCtx(overrides: any = {}) {
  return {
    env: 'stable', baseUrl: 'http://tgw',
    provider: { kind: 'password', getAccessToken: async () => 'TOK', refresh: async () => {}, clear: async () => {} },
    store: {} as any,
    logger: { info(){}, debug(){}, warn(){}, error(){}, close(){} },
    flags: {}, outputMode: 'pretty',
    config: {} as any, homeDir: tmp,
    ...overrides,
  };
}

describe('cashop ask', () => {
  beforeAll(() => { tmp = mkdtempSync(join(tmpdir(), 'ask-')); });
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it('streams text_delta to stdout and persists session id', async () => {
    server.use(http.post('http://tgw/ai/cashop-ai/rpc/auth/chat/message', () =>
      new HttpResponse(sseBody([
        '{"type":"session_start","session_id":"S42"}',
        '{"type":"text_delta","content":"Hello"}',
        '{"type":"text_delta","content":" world"}',
        '{"type":"done","session_id":"S42"}',
      ]), { headers: { 'Content-Type': 'text/event-stream' } })));

    const program = new Command();
    (program as any).__ctx = makeCtx();
    askCmd.register(program);
    const origWrite = process.stdout.write.bind(process.stdout);
    const chunks: string[] = [];
    (process.stdout as any).write = (s: any) => { chunks.push(String(s)); return true; };
    try {
      await program.parseAsync(['ask', 'hello'], { from: 'user' });
    } finally {
      (process.stdout as any).write = origWrite;
    }
    expect(chunks.join('')).toMatch(/Hello world/);
    expect(loadChatState(tmp).last_session_id).toBe('S42');
  });
});
