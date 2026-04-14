import { describe, it, expect } from 'vitest';
import { TokenStore, InMemoryBackend } from '../../src/core/token-store.js';

describe('token-store', () => {
  it('round-trips password tokens per env', async () => {
    const s = new TokenStore(new InMemoryBackend());
    await s.savePasswordToken('stable', {
      accessToken: 'abc', refreshToken: 'r', expires_at: 123, refresh_expires_at: 456, userId: '7',
    });
    const got = await s.getPasswordToken('stable');
    expect(got?.accessToken).toBe('abc');
    expect(await s.getPasswordToken('prod')).toBeNull();
  });

  it('clear removes only the specified env', async () => {
    const s = new TokenStore(new InMemoryBackend());
    await s.savePasswordToken('stable', { accessToken: 'a', refreshToken: 'ra', expires_at: 1, refresh_expires_at: 2, userId: '1' });
    await s.savePasswordToken('prod', { accessToken: 'b', refreshToken: 'rb', expires_at: 3, refresh_expires_at: 4, userId: '2' });
    await s.clearPasswordToken('stable');
    expect(await s.getPasswordToken('stable')).toBeNull();
    expect((await s.getPasswordToken('prod'))?.accessToken).toBe('b');
  });
});

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EncryptedFileBackend } from '../../src/core/token-store.js';

describe('EncryptedFileBackend', () => {
  it('encrypts then decrypts identically', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cashop-enc-'));
    const b = new EncryptedFileBackend(join(dir, 'creds.enc'), 'test-passphrase');
    await b.write({
      oauth: {}, api_keys: {},
      password_tokens: { stable: { accessToken: 'z', refreshToken: 'rz', expires_at: 9, refresh_expires_at: 10, userId: '1' } },
    });
    const got = await b.read();
    expect(got.password_tokens.stable?.accessToken).toBe('z');
  });
});
