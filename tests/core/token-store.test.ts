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

describe('TokenStore oauth methods', () => {
  it('saveOAuth / getOAuth roundtrips including refresh_expires_at', async () => {
    const store = new TokenStore(new InMemoryBackend());
    const now = Date.now();
    await store.saveOAuth('stable', {
      access_token: 'A', refresh_token: 'R',
      expires_at: now + 30 * 86_400_000,
      refresh_expires_at: now + 90 * 86_400_000,
      account: '9527', scopes: ['cli'],
    });
    const got = await store.getOAuth('stable');
    expect(got?.access_token).toBe('A');
    expect(got?.refresh_token).toBe('R');
    expect(got?.account).toBe('9527');
    expect(got?.scopes).toEqual(['cli']);
    expect(got?.refresh_expires_at).toBe(now + 90 * 86_400_000);
  });

  it('clearOAuth removes only the oauth entry for the env', async () => {
    const store = new TokenStore(new InMemoryBackend());
    await store.saveOAuth('stable', {
      access_token: 'A', refresh_token: 'R',
      expires_at: 1, refresh_expires_at: 2, account: '1', scopes: ['cli'],
    });
    await store.savePasswordToken('stable', {
      accessToken: 'P', refreshToken: 'PR', expires_at: 1, refresh_expires_at: 2, userId: '1',
    });
    await store.clearOAuth('stable');
    expect(await store.getOAuth('stable')).toBeNull();
    expect(await store.getPasswordToken('stable')).not.toBeNull();
  });
});
