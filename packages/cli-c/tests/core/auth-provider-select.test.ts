import { describe, it, expect } from 'vitest';
import { selectProvider, NoProvider } from '../../src/core/auth-provider/index.js';
import { TokenStore, InMemoryBackend } from '../../src/core/token-store.js';
import { OAuthDeviceProvider } from '../../src/core/auth-provider/oauth-device.js';

describe('selectProvider', () => {
  it('returns NoProvider when nothing configured', async () => {
    const store = new TokenStore(new InMemoryBackend());
    const p = await selectProvider({ env: 'stable', store, flags: {}, envVars: {} });
    expect(p.kind).toBe('none');
    await expect(p.getAccessToken()).resolves.toBeNull();
  });

  it('prefers --api-key flag over everything', async () => {
    const store = new TokenStore(new InMemoryBackend());
    await store.savePasswordToken('stable', { accessToken: 'pw-tok', refreshToken: 'r', expires_at: Date.now() + 1e6, refresh_expires_at: Date.now() + 1e9, userId: '1' });
    const p = await selectProvider({ env: 'stable', store, flags: { apiKey: 'sk-flag' }, envVars: {} });
    expect(p.kind).toBe('api-key');
    expect(await p.getAccessToken()).toBe('sk-flag');
  });

  it('prefers CASHOP_API_KEY env over stored tokens', async () => {
    const store = new TokenStore(new InMemoryBackend());
    await store.savePasswordToken('stable', { accessToken: 'pw-tok', refreshToken: 'r', expires_at: Date.now() + 1e6, refresh_expires_at: Date.now() + 1e9, userId: '1' });
    const p = await selectProvider({ env: 'stable', store, flags: {}, envVars: { CASHOP_API_KEY: 'sk-env' } });
    expect(p.kind).toBe('api-key');
    expect(await p.getAccessToken()).toBe('sk-env');
  });

  it('falls back to stored password token', async () => {
    const store = new TokenStore(new InMemoryBackend());
    await store.savePasswordToken('stable', { accessToken: 'pw-tok', refreshToken: 'r', expires_at: Date.now() + 1e6, refresh_expires_at: Date.now() + 1e9, userId: '1' });
    const p = await selectProvider({ env: 'stable', store, flags: {}, envVars: {} });
    expect(p.kind).toBe('password');
    expect(await p.getAccessToken()).toBe('pw-tok');
  });
});

describe('selectProvider — oauth priority', () => {
  it('picks oauth over password when refresh not expired', async () => {
    const store = new TokenStore(new InMemoryBackend());
    await store.saveOAuth('stable', {
      access_token: 'oa', refresh_token: 'or',
      expires_at: Date.now() + 1e6, refresh_expires_at: Date.now() + 1e9,
      account: '1', scopes: ['cli'],
    });
    await store.savePasswordToken('stable', {
      accessToken: 'pw', refreshToken: 'pr', expires_at: Date.now() + 1e6,
      refresh_expires_at: Date.now() + 1e9, userId: '1',
    });
    const p = await selectProvider({ env: 'stable', store, flags: {}, envVars: {}, base: 'http://x' } as any);
    expect(p.kind).toBe('oauth-device');
    expect(p).toBeInstanceOf(OAuthDeviceProvider);
  });

  it('falls through to password when oauth refresh is expired', async () => {
    const store = new TokenStore(new InMemoryBackend());
    await store.saveOAuth('stable', {
      access_token: 'oa', refresh_token: 'or',
      expires_at: Date.now() - 1, refresh_expires_at: Date.now() - 1,
      account: '1', scopes: ['cli'],
    });
    await store.savePasswordToken('stable', {
      accessToken: 'pw', refreshToken: 'pr', expires_at: Date.now() + 1e6,
      refresh_expires_at: Date.now() + 1e9, userId: '1',
    });
    const p = await selectProvider({ env: 'stable', store, flags: {}, envVars: {}, base: 'http://x' } as any);
    expect(p.kind).toBe('password');
  });

  it('apiKey beats oauth and password', async () => {
    const store = new TokenStore(new InMemoryBackend());
    await store.saveOAuth('stable', {
      access_token: 'oa', refresh_token: 'or',
      expires_at: Date.now() + 1e6, refresh_expires_at: Date.now() + 1e9,
      account: '1', scopes: ['cli'],
    });
    const p = await selectProvider({ env: 'stable', store, flags: { apiKey: 'sk' }, envVars: {}, base: 'http://x' } as any);
    expect(p.kind).toBe('api-key');
  });
});
