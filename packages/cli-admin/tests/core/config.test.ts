import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import type { AuthBundle } from '../../src/core/config.js';

// tmpDir is set before each test and read by the os mock below.
let tmpDir: string;

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  return {
    ...actual,
    default: {
      ...actual,
      homedir: () => tmpDir,
    },
  };
});

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cashop-cli-test-'));
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function importConfig() {
  return import('../../src/core/config.js');
}

function makeBundle(overrides: Partial<AuthBundle> = {}): AuthBundle {
  return {
    accessToken: 'at',
    refreshToken: 'rt',
    expiresAt: Date.now() + 60_000,
    username: 'alice',
    savedAt: Date.now(),
    ...overrides,
  };
}

describe('readConfig', () => {
  it('returns {} when config file does not exist', async () => {
    const { readConfig } = await importConfig();
    expect(readConfig()).toEqual({});
  });

  it('returns parsed JSON when config file exists', async () => {
    const { readConfig, writeConfig } = await importConfig();
    writeConfig({ env: 'stable' });
    expect(readConfig()).toEqual({ env: 'stable' });
  });

  it('returns {} when config file contains invalid JSON', async () => {
    const configDir = path.join(tmpDir, '.cashop-console');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'config.json'), 'not-json', 'utf-8');
    const { readConfig } = await importConfig();
    expect(readConfig()).toEqual({});
  });
});

describe('writeConfig', () => {
  it('creates the config directory if it does not exist', async () => {
    const { writeConfig } = await importConfig();
    writeConfig({ env: 'prod' });
    const configDir = path.join(tmpDir, '.cashop-console');
    expect(fs.existsSync(configDir)).toBe(true);
  });

  it('writes a JSON file that can be re-read', async () => {
    const { writeConfig, readConfig } = await importConfig();
    const cfg = { env: 'stable' as const, defaultSite: 'cashop' };
    writeConfig(cfg);
    expect(readConfig()).toEqual(cfg);
  });

  it('sets 0600 permissions on the config file when first created', async () => {
    if (process.platform === 'win32') return;
    const { writeConfig } = await importConfig();
    writeConfig({ env: 'prod' });
    const file = path.join(tmpDir, '.cashop-console', 'config.json');
    const mode = fs.statSync(file).mode & 0o777;
    expect(mode).toBe(0o600);
  });
});

describe('getAuth / setAuth / clearAuth', () => {
  it('returns undefined when no bundle is stored', async () => {
    const { getAuth } = await importConfig();
    expect(getAuth('stable')).toBeUndefined();
  });

  it('stores and retrieves an AuthBundle per environment', async () => {
    const { setAuth, getAuth } = await importConfig();
    const bundle = makeBundle({ accessToken: 'at-stable' });
    setAuth('stable', bundle);
    expect(getAuth('stable')?.accessToken).toBe('at-stable');
  });

  it('keeps bundles for different environments separate', async () => {
    const { setAuth, getAuth } = await importConfig();
    setAuth('stable', makeBundle({ accessToken: 'at-s' }));
    setAuth('prod', makeBundle({ accessToken: 'at-p' }));
    expect(getAuth('stable')?.accessToken).toBe('at-s');
    expect(getAuth('prod')?.accessToken).toBe('at-p');
  });

  it('overwrites an existing bundle for the same env (immutable update)', async () => {
    const { setAuth, getAuth } = await importConfig();
    setAuth('stable', makeBundle({ accessToken: 'first' }));
    setAuth('stable', makeBundle({ accessToken: 'second' }));
    expect(getAuth('stable')?.accessToken).toBe('second');
  });

  it('clearAuth removes only the specified env', async () => {
    const { setAuth, getAuth, clearAuth } = await importConfig();
    setAuth('stable', makeBundle({ accessToken: 'at-s' }));
    setAuth('prod', makeBundle({ accessToken: 'at-p' }));
    clearAuth('stable');
    expect(getAuth('stable')).toBeUndefined();
    expect(getAuth('prod')?.accessToken).toBe('at-p');
  });

  it('clearAuth is a no-op when no auth is stored', async () => {
    const { clearAuth, readConfig } = await importConfig();
    expect(() => clearAuth('stable')).not.toThrow();
    expect(readConfig()).toEqual({});
  });
});

describe('setConfigValue / getConfigValue', () => {
  it('stores and retrieves a string value by key', async () => {
    const { setConfigValue, getConfigValue } = await importConfig();
    setConfigValue('defaultSite', 'cashop');
    expect(getConfigValue('defaultSite')).toBe('cashop');
  });

  it('returns undefined for a key that has not been set', async () => {
    const { getConfigValue } = await importConfig();
    expect(getConfigValue('nonExistentKey')).toBeUndefined();
  });

  it('returns undefined for non-string values (e.g. the auth object)', async () => {
    const { setAuth, getConfigValue } = await importConfig();
    setAuth('stable', makeBundle());
    expect(getConfigValue('auth')).toBeUndefined();
  });
});
