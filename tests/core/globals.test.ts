import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildContext } from '../../src/core/globals.js';

let home: string;
beforeEach(() => { home = mkdtempSync(join(tmpdir(), 'cashop-ctx-')); });

describe('buildContext', () => {
  it('resolves base URL from config env', async () => {
    const ctx = await buildContext({
      homeDir: home, flags: {}, envVars: { CASHOP_TEST_BACKEND: 'memory' },
    });
    expect(ctx.env).toBe('stable');
    expect(ctx.baseUrl).toBe('http://159.138.7.47');
    expect(ctx.provider.kind).toBe('none');
  });

  it('throws when prod env chosen but api.prod is null', async () => {
    await expect(buildContext({
      homeDir: home, flags: { env: 'prod' }, envVars: { CASHOP_TEST_BACKEND: 'memory' },
    })).rejects.toThrow(/prod.*not.*yet.*open|not configured/i);
  });
});
