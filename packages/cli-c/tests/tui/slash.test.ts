import { describe, it, expect, vi, beforeAll } from 'vitest';
import type { Command } from 'commander';
import { dispatchSlash, type SlashCtx } from '../../src/tui/slash/index.js';
import { buildBangShape } from '../../src/tui/verb-catalog.js';

let bangProg: Command;
beforeAll(async () => { bangProg = await buildBangShape(); });

function makeCtx(overrides: Partial<SlashCtx> = {}): SlashCtx {
  return {
    out: vi.fn(),
    err: vi.fn(),
    state: { current_session_id: 'old-sid' },
    listSessions: async () => ({ sessions: [
      { session_id: 'A', title: 'Alpha', updated_at: '2026-04-14' },
      { session_id: 'B', title: null, updated_at: '2026-04-15' },
    ]}),
    exit: vi.fn(),
    bangProg,
    ...overrides,
  };
}

describe('dispatchSlash', () => {
  it('/help lists commands', async () => {
    const ctx = makeCtx();
    await dispatchSlash('help', [], ctx);
    const printed = (ctx.out as any).mock.calls.map((c: any[]) => c[0]).join('');
    expect(printed).toMatch(/\/help/);
    expect(printed).toMatch(/\/sessions/);
    expect(printed).toMatch(/\/new/);
  });

  it('/new clears current_session_id', async () => {
    const ctx = makeCtx();
    await dispatchSlash('new', [], ctx);
    expect(ctx.state.current_session_id).toBeUndefined();
  });

  it('/sessions prints a table', async () => {
    const ctx = makeCtx();
    await dispatchSlash('sessions', [], ctx);
    const printed = (ctx.out as any).mock.calls.map((c: any[]) => c[0]).join('');
    expect(printed).toMatch(/A/);
    expect(printed).toMatch(/Alpha/);
    expect(printed).toMatch(/B/);
  });

  it('/resume <id> sets current_session_id', async () => {
    const ctx = makeCtx();
    await dispatchSlash('resume', ['xyz'], ctx);
    expect(ctx.state.current_session_id).toBe('xyz');
  });

  it('/resume without id errors', async () => {
    const ctx = makeCtx();
    await dispatchSlash('resume', [], ctx);
    const printed = (ctx.err as any).mock.calls.map((c: any[]) => c[0]).join('');
    expect(printed).toMatch(/usage.*resume/i);
  });

  it('/exit calls exit()', async () => {
    const ctx = makeCtx();
    await dispatchSlash('exit', [], ctx);
    expect(ctx.exit).toHaveBeenCalled();
  });

  it('unknown slash errors', async () => {
    const ctx = makeCtx();
    await dispatchSlash('nope', [], ctx);
    const printed = (ctx.err as any).mock.calls.map((c: any[]) => c[0]).join('');
    expect(printed).toMatch(/unknown slash/);
  });
});
