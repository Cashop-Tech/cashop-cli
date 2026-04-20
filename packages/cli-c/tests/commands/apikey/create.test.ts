import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { server, http, HttpResponse } from '../../helpers/mock-server.js';
import createCmd from '../../../src/commands/apikey/create.js';
import type { CliContext } from '../../../src/core/globals.js';
import type { AuthProvider } from '../../../src/core/auth-provider/index.js';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const CREATE_URL = 'http://tgw/member/cashop-member-auth/api/auth/v1/apikey/create';

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
  createCmd.register(program);

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
    // Throw to stop further execution, but don't actually kill the process.
    throw new Error(`__exit_${exitCode}__`);
  }) as any);

  try {
    await program.parseAsync(argv, { from: 'user' });
  } catch (e) {
    // swallow the __exit__ sentinel; surface other errors via stderr for visibility
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

describe('cashop apikey create', () => {
  it('prints kid and key on success', async () => {
    server.use(
      http.post(CREATE_URL, async () => {
        return HttpResponse.json({
          code: '00000', success: true, message: 'success',
          data: {
            kid: 'ak_abc12345',
            key: 'csk_live_deadbeef',
            name: 'ci-bot',
            createdAt: 1744700400000,
            expiresAt: 1752476400000,
          },
        });
      }),
    );
    const ctx = makeCtx(makeOAuthProvider());
    const { stdout, exitCode } = await invoke(
      ['apikey', 'create', '--name', 'ci-bot', '--ttl', '90d'],
      ctx,
    );
    expect(exitCode).toBe(0);
    expect(stdout).toContain('ak_abc12345');
    expect(stdout).toContain('csk_live_deadbeef');
    expect(stdout).toContain('ci-bot');
  });

  it('--json prints one-line JSON', async () => {
    server.use(
      http.post(CREATE_URL, async () => {
        return HttpResponse.json({
          code: '00000', success: true, message: 'success',
          data: {
            kid: 'ak_j', key: 'csk_live_j', name: 'j',
            createdAt: 1, expiresAt: null,
          },
        });
      }),
    );
    const ctx = makeCtx(makeOAuthProvider());
    const { stdout, exitCode } = await invoke(
      ['apikey', 'create', '--name', 'j', '--ttl', 'never', '--json'],
      ctx,
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout.trim());
    expect(parsed.kid).toBe('ak_j');
    expect(parsed.expiresAt).toBeNull();
  });

  it('maps 703014 to friendly message', async () => {
    server.use(
      http.post(CREATE_URL, async () => {
        return HttpResponse.json(
          { code: '703014', success: false, message: 'apikey_name_conflict', data: null },
          { status: 200 },
        );
      }),
    );
    const ctx = makeCtx(makeOAuthProvider());
    const { stderr, exitCode } = await invoke(
      ['apikey', 'create', '--name', 'dup', '--ttl', '90d'],
      ctx,
    );
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('already exists');
  });

  it('maps 703012 to friendly message', async () => {
    server.use(
      http.post(CREATE_URL, async () => {
        return HttpResponse.json(
          { code: '703012', success: false, message: 'apikey_limit_exceeded', data: null },
          { status: 200 },
        );
      }),
    );
    const ctx = makeCtx(makeOAuthProvider());
    const { stderr, exitCode } = await invoke(
      ['apikey', 'create', '--name', '11th', '--ttl', '90d'],
      ctx,
    );
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('Reached limit of 10 API keys');
  });

  it('rejects when no oauth-device login', async () => {
    const ctx = makeCtx(makeNoProvider());
    const { stderr, exitCode } = await invoke(
      ['apikey', 'create', '--name', 'x', '--ttl', '90d'],
      ctx,
    );
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('device login');
  });
});
