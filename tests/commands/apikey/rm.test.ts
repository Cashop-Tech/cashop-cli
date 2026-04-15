import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../../helpers/mock-server.js';
import type { CliContext } from '../../../src/core/globals.js';
import type { AuthProvider } from '../../../src/core/auth-provider/index.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  __setConfirmAnswer(null);
});
afterAll(() => server.close());

const LIST_URL = 'http://tgw/member/cashop-member-auth/api/auth/v1/apikey/list';
const REVOKE_URL = 'http://tgw/member/cashop-member-auth/api/auth/v1/apikey/revoke';

// Module seam: the `rm` module exports a mutable `confirm` ref so tests can stub it.
// See src/commands/apikey/rm.ts — we import `__setConfirmAnswer` (test-only helper)
// to deterministically answer the y/N prompt without piping stdin.
let __pendingAnswer: string | null = null;
function __setConfirmAnswer(a: string | null) { __pendingAnswer = a; }

// Stub node:readline/promises.createInterface so rl.question() resolves to __pendingAnswer.
vi.mock('node:readline/promises', () => {
  return {
    default: {
      createInterface: () => ({
        question: async () => __pendingAnswer ?? '',
        close: () => {},
      }),
    },
    createInterface: () => ({
      question: async () => __pendingAnswer ?? '',
      close: () => {},
    }),
  };
});

// Import AFTER vi.mock so the mock applies.
const { default: rmCmd } = await import('../../../src/commands/apikey/rm.js');

function makeOAuthProvider(): AuthProvider {
  return {
    kind: 'oauth-device',
    async getAccessToken() { return 'TOK'; },
    async refresh() {},
    async clear() {},
  };
}

function makeCtx(provider: AuthProvider, outputMode: 'pretty' | 'json' = 'pretty'): CliContext {
  return {
    env: 'stable',
    baseUrl: 'http://tgw',
    outputMode,
    provider,
    logger: { info() {}, debug() {}, warn() {}, error() {}, close() {} } as any,
    flags: {},
    config: {} as any,
    store: {} as any,
    homeDir: '/tmp/fake-home',
  };
}

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function invoke(argv: string[], ctx: CliContext): Promise<RunResult> {
  const program = new Command();
  program.exitOverride();
  (program as any).__ctx = ctx;
  rmCmd.register(program);

  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: any) => {
    stdoutChunks.push(String(chunk));
    return true;
  });
  const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: any) => {
    stderrChunks.push(String(chunk));
    return true;
  });
  let exitCode = 0;
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    exitCode = code ?? 0;
    throw new Error(`__exit_${exitCode}__`);
  }) as any);

  try {
    await program.parseAsync(argv, { from: 'user' });
  } catch (e) {
    if (!(e instanceof Error && e.message.startsWith('__exit_'))) {
      stderrChunks.push((e instanceof Error ? e.message : String(e)) + '\n');
    }
  } finally {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    exitSpy.mockRestore();
  }
  return {
    stdout: stdoutChunks.join(''),
    stderr: stderrChunks.join(''),
    exitCode,
  };
}

describe('cashop apikey rm', () => {
  it('-y skips prompt, skips list, calls revoke', async () => {
    let listCalled = false;
    let revokeBody: any = null;
    server.use(
      http.get(LIST_URL, () => {
        listCalled = true;
        return HttpResponse.json({ code: '00000', success: true, message: '', data: { items: [] } });
      }),
      http.post(REVOKE_URL, async ({ request }) => {
        revokeBody = await request.json();
        return HttpResponse.json({
          code: '00000', success: true, message: '',
          data: { revoked: true },
        });
      }),
    );

    const ctx = makeCtx(makeOAuthProvider());
    const { stdout, exitCode } = await invoke(['apikey', 'rm', 'ak_target', '-y'], ctx);

    expect(exitCode).toBe(0);
    expect(listCalled).toBe(false);
    expect(revokeBody).toEqual({ kid: 'ak_target' });
    expect(stdout).toContain('Revoked');
  });

  it('without -y, user answers n → list is called, revoke is NOT called, cancelled', async () => {
    let listCalled = false;
    let revokeCalled = false;
    server.use(
      http.get(LIST_URL, () => {
        listCalled = true;
        return HttpResponse.json({
          code: '00000', success: true, message: '',
          data: { items: [{ kid: 'ak_target', name: 'x', createdAt: 1, expiresAt: null, lastUsedAt: null }] },
        });
      }),
      http.post(REVOKE_URL, () => {
        revokeCalled = true;
        return HttpResponse.json({
          code: '00000', success: true, message: '',
          data: { revoked: true },
        });
      }),
    );

    __setConfirmAnswer('n');
    const ctx = makeCtx(makeOAuthProvider());
    const { stdout, exitCode } = await invoke(['apikey', 'rm', 'ak_target'], ctx);

    expect(exitCode).toBe(0);
    expect(listCalled).toBe(true);
    expect(revokeCalled).toBe(false);
    expect(stdout.toLowerCase()).toContain('cancelled');
  });

  it('703015 → friendly "API key not found"', async () => {
    server.use(
      http.post(REVOKE_URL, () =>
        HttpResponse.json({ code: '703015', success: false, message: 'apikey_not_found', data: null }),
      ),
    );

    const ctx = makeCtx(makeOAuthProvider());
    const { stderr, exitCode } = await invoke(['apikey', 'rm', 'ak_x', '-y'], ctx);

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('API key not found');
  });
});
