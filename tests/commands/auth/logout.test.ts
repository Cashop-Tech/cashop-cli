import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import logoutCmd from '../../../src/commands/auth/logout.js';
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

describe('auth logout', () => {
  it('clears stored token for current env', async () => {
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
    logoutCmd.register(program);
    await program.parseAsync(['logout'], { from: 'user' });
    expect(await store.getPasswordToken('stable')).toBeNull();
  });
});
