import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../../helpers/mock-server.js';
import listCmd from '../../../src/commands/apikey/list.js';
import type { CliContext } from '../../../src/core/globals.js';
import type { AuthProvider } from '../../../src/core/auth-provider/index.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const LIST_URL = 'http://tgw/member/cashop-member-auth/api/auth/v1/apikey/list';

function makeOAuthProvider(): AuthProvider {
  return {
    kind: 'oauth-device',
    async getAccessToken() { return 'TOK'; },
    async refresh() {},
    async clear() {},
  };
}

function makeNoProvider(): AuthProvider {
  return {
    kind: 'none',
    async getAccessToken() { return null; },
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
  listCmd.register(program);

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

describe('cashop apikey list', () => {
  it('prints a table', async () => {
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json({
          code: '00000', success: true, message: 'success',
          data: { items: [
            { kid: 'ak_a', name: 'ci-bot', createdAt: 1, expiresAt: 2, lastUsedAt: 3 },
            { kid: 'ak_b', name: 'laptop', createdAt: 1, expiresAt: null, lastUsedAt: null },
          ] },
        }),
      ),
    );
    const ctx = makeCtx(makeOAuthProvider());
    const { stdout, exitCode } = await invoke(['apikey', 'list'], ctx);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('ak_a');
    expect(stdout).toContain('ci-bot');
    expect(stdout).toContain('—'); // null cells
  });

  it('--json prints raw items', async () => {
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json({
          code: '00000', success: true, message: 'success',
          data: { items: [] },
        }),
      ),
    );
    const ctx = makeCtx(makeOAuthProvider());
    const { stdout, exitCode } = await invoke(['apikey', 'list', '--json'], ctx);
    expect(exitCode).toBe(0);
    expect(JSON.parse(stdout.trim())).toEqual({ items: [] });
  });

  it('rejects when no oauth-device login', async () => {
    const ctx = makeCtx(makeNoProvider());
    const { stderr, exitCode } = await invoke(['apikey', 'list'], ctx);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('device login');
  });
});
