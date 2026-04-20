import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// tmpDir is set before each test and read by the os mock below.
// It must be declared in the outer scope so the factory closure can reference it.
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
  // Clear the module registry so config.ts re-evaluates CONFIG_DIR with the new tmpDir.
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// Helper: dynamically import config after resetModules so each test gets a
// fresh module evaluation with the current tmpDir.
async function importConfig() {
  return import('../../src/core/config.js');
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
});

describe('getToken / setToken', () => {
  it('returns undefined when no token has been stored for an env', async () => {
    const { getToken } = await importConfig();
    expect(getToken('stable')).toBeUndefined();
  });

  it('stores and retrieves a token per environment', async () => {
    const { setToken, getToken } = await importConfig();
    setToken('stable', 'tok-stable-123');
    expect(getToken('stable')).toBe('tok-stable-123');
  });

  it('stores tokens independently for different environments', async () => {
    const { setToken, getToken } = await importConfig();
    setToken('stable', 'tok-stable');
    setToken('prod', 'tok-prod');
    expect(getToken('stable')).toBe('tok-stable');
    expect(getToken('prod')).toBe('tok-prod');
  });

  it('overwrites an existing token for the same environment', async () => {
    const { setToken, getToken } = await importConfig();
    setToken('stable', 'first');
    setToken('stable', 'second');
    expect(getToken('stable')).toBe('second');
  });
});

describe('clearToken', () => {
  it('removes the token for the specified environment', async () => {
    const { setToken, getToken, clearToken } = await importConfig();
    setToken('stable', 'tok-abc');
    clearToken('stable');
    expect(getToken('stable')).toBeUndefined();
  });

  it('does not affect tokens for other environments', async () => {
    const { setToken, getToken, clearToken } = await importConfig();
    setToken('stable', 'tok-stable');
    setToken('prod', 'tok-prod');
    clearToken('stable');
    expect(getToken('prod')).toBe('tok-prod');
  });

  it('is a no-op when the config has no tokens at all', async () => {
    const { clearToken, readConfig } = await importConfig();
    // Should not throw even when tokens map is absent
    expect(() => clearToken('stable')).not.toThrow();
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

  it('overwrites an existing value', async () => {
    const { setConfigValue, getConfigValue } = await importConfig();
    setConfigValue('env', 'stable');
    setConfigValue('env', 'prod');
    expect(getConfigValue('env')).toBe('prod');
  });

  it('returns undefined for non-string values', async () => {
    // Write a config where a key holds a non-string (e.g. tokens object)
    const { writeConfig, getConfigValue } = await importConfig();
    writeConfig({ tokens: { stable: 'tok' } });
    // 'tokens' is an object, not a string — getConfigValue must return undefined
    expect(getConfigValue('tokens')).toBeUndefined();
  });

  it('persists multiple keys independently', async () => {
    const { setConfigValue, getConfigValue } = await importConfig();
    setConfigValue('defaultSite', 'site-a');
    setConfigValue('env', 'prod');
    expect(getConfigValue('defaultSite')).toBe('site-a');
    expect(getConfigValue('env')).toBe('prod');
  });
});
