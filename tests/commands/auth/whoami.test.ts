import { describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import whoamiCmd from '../../../src/commands/auth/whoami.js';
import { TokenStore, InMemoryBackend } from '../../../src/core/token-store.js';
import type { CliContext } from '../../../src/core/globals.js';

function makeCtx(store: TokenStore): CliContext {
  return {
    env: 'stable', baseUrl: 'http://tgw', store, provider: { kind: 'none' } as any,
    logger: { info: () => {}, debug: () => {}, warn: () => {}, error: () => {}, close: () => {} },
    flags: {}, outputMode: 'json',
    config: {} as any,
  };
}

describe('auth whoami', () => {
  it('prints userId when logged in', async () => {
    const store = new TokenStore(new InMemoryBackend());
    await store.savePasswordToken('stable', {
      accessToken: 'T',
      refreshToken: 'R',
      expires_at: Date.now() + 1e6,
      refresh_expires_at: Date.now() + 1e9,
      userId: '77',
    });
    const program = new Command();
    (program as any).__ctx = makeCtx(store);
    whoamiCmd.register(program);
    const log = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(['auth', 'whoami'], { from: 'user' });
    const out = log.mock.calls.map(c => String(c[0])).join('');
    expect(out).toMatch(/77/);
    log.mockRestore();
  });

  it('exits 4 when not logged in', async () => {
    const store = new TokenStore(new InMemoryBackend());
    const program = new Command();
    (program as any).__ctx = makeCtx(store);
    whoamiCmd.register(program);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit ${code}`);
    }) as never);
    await expect(program.parseAsync(['auth', 'whoami'], { from: 'user' })).rejects.toThrow(/exit 4/);
    exitSpy.mockRestore();
  });
});
