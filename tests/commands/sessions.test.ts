import { beforeAll, afterAll, afterEach, describe, it, expect } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../helpers/mock-server.js';
import sessionsCmd from '../../src/commands/sessions.js';
import sessionCmd from '../../src/commands/session.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function makeCtx() {
  return {
    env: 'stable', baseUrl: 'http://tgw', outputMode: 'json',
    flags: {}, config: {} as any,
    provider: { kind: 'password', getAccessToken: async () => 'TOK', refresh: async () => {}, clear: async () => {} },
    store: {} as any,
    logger: { info(){}, debug(){}, warn(){}, error(){}, close(){} },
  } as any;
}

describe('cashop sessions', () => {
  it('lists via GET /ai/cashop-ai/rpc/auth/sessions', async () => {
    server.use(http.get('http://tgw/ai/cashop-ai/rpc/auth/sessions', () =>
      HttpResponse.json({
        code: '00000', success: true, message: '', extAttrs: null,
        data: { sessions: [{ session_id: 'A', title: 'Alpha' }] },
      })));
    const program = new Command();
    (program as any).__ctx = makeCtx();
    sessionsCmd.register(program);
    const captured: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    (process.stdout as any).write = (s: any) => { captured.push(String(s)); return true; };
    try {
      await program.parseAsync(['sessions'], { from: 'user' });
    } finally {
      (process.stdout as any).write = orig;
    }
    expect(captured.join('')).toMatch(/Alpha/);
  });
});

describe('cashop session rm', () => {
  it('calls DELETE with --yes to skip confirm', async () => {
    let gotDelete = false;
    server.use(http.delete('http://tgw/ai/cashop-ai/rpc/auth/sessions/sid1', () => {
      gotDelete = true;
      return HttpResponse.json({
        code: '00000', success: true, message: '', extAttrs: null, data: null,
      });
    }));
    const program = new Command();
    (program as any).__ctx = { ...makeCtx(), flags: { yes: true } };
    sessionCmd.register(program);
    await program.parseAsync(['session', 'rm', 'sid1'], { from: 'user' });
    expect(gotDelete).toBe(true);
  });
});
