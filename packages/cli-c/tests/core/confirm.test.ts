import { describe, it, expect, vi } from 'vitest';
import { confirmWrite } from '../../src/core/confirm.js';

describe('confirmWrite', () => {
  it('skips prompt when yes flag is true', async () => {
    const ok = await confirmWrite({ prompt: 'x?', yes: true, readLine: async () => 'never' });
    expect(ok).toBe(true);
  });

  it('skips prompt when auto_confirm config is true', async () => {
    const ok = await confirmWrite({ prompt: 'x?', yes: false, autoConfirm: true, readLine: async () => 'never' });
    expect(ok).toBe(true);
  });

  it('reads a single line when not skipped', async () => {
    const ok = await confirmWrite({ prompt: 'x?', yes: false, readLine: async () => 'y' });
    expect(ok).toBe(true);
  });

  it('returns false on anything other than y/yes', async () => {
    expect(await confirmWrite({ prompt: 'x?', yes: false, readLine: async () => 'n' })).toBe(false);
    expect(await confirmWrite({ prompt: 'x?', yes: false, readLine: async () => '' })).toBe(false);
  });
});
