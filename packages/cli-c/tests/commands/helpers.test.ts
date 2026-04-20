import { describe, it, expect, vi } from 'vitest';
import { getCtx, runCmd } from '../../src/commands/_helpers.js';
import type { CliContext } from '../../src/core/globals.js';
import { NotFoundError } from '@cashop/core';

const fakeCtx = { outputMode: 'json' } as unknown as CliContext;

describe('_helpers', () => {
  it('getCtx retrieves context from commander command', () => {
    const cmd = { __ctx: fakeCtx, parent: null };
    expect(getCtx(cmd as any)).toBe(fakeCtx);
  });

  it('getCtx walks parent chain', () => {
    const root = { __ctx: fakeCtx, parent: null };
    const child = { parent: root };
    expect(getCtx(child as any)).toBe(fakeCtx);
  });

  it('runCmd prints formatted data and returns 0', async () => {
    const writes: string[] = [];
    const code = await runCmd(fakeCtx, async () => ({ a: 1 }), {
      write: (s) => writes.push(s),
    });
    expect(code).toBe(0);
    expect(JSON.parse(writes.join(''))).toEqual({ a: 1 });
  });

  it('runCmd catches typed error and returns mapped exit code', async () => {
    const writes: string[] = [];
    const code = await runCmd(fakeCtx, async () => { throw new NotFoundError('gone'); }, {
      write: (s) => writes.push(s),
      writeErr: (s) => writes.push(s),
    });
    expect(code).toBe(6);
  });
});
