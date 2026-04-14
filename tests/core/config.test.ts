import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, saveConfig, defaultConfig } from '../../src/core/config.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cashop-cli-cfg-'));
});

describe('config', () => {
  it('returns defaults when file missing', () => {
    const cfg = loadConfig(join(dir, 'missing.yaml'));
    expect(cfg).toEqual(defaultConfig);
    expect(cfg.env).toBe('stable');
    expect(cfg.api.stable).toBe('http://159.138.7.47');
    expect(cfg.api.prod).toBeNull();
  });

  it('round-trips a custom config', () => {
    const path = join(dir, 'config.yaml');
    saveConfig(path, { ...defaultConfig, env: 'prod', output: 'json' });
    const loaded = loadConfig(path);
    expect(loaded.env).toBe('prod');
    expect(loaded.output).toBe('json');
  });

  it('rejects malformed YAML with a helpful error', () => {
    const path = join(dir, 'bad.yaml');
    writeFileSync(path, 'env: not-a-valid-env\n');
    expect(() => loadConfig(path)).toThrow(/env/);
  });

  it('fills in missing keys with defaults', () => {
    const path = join(dir, 'partial.yaml');
    writeFileSync(path, 'env: stable\n');
    const cfg = loadConfig(path);
    expect(cfg.output).toBe('pretty');
    expect(cfg.api.stable).toBe('http://159.138.7.47');
  });
});
