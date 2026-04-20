import { describe, it, expect, vi, beforeEach } from 'vitest';

let spawnMock: ReturnType<typeof vi.fn>;
vi.mock('node:child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

async function callOpenBrowser(url: string, opts: { noBrowser?: boolean; env?: Record<string, string>; platform?: NodeJS.Platform } = {}) {
  const { openBrowser } = await import('../../../src/core/device/open-browser.js');
  return openBrowser(url, {
    noBrowser: opts.noBrowser ?? false,
    env: opts.env ?? {},
    platform: opts.platform ?? 'darwin',
  });
}

beforeEach(() => {
  spawnMock = vi.fn(() => ({ unref: () => {}, on: () => {} }));
  vi.resetModules();
});

describe('openBrowser', () => {
  it('opens on macOS TTY with no SSH', async () => {
    const r = await callOpenBrowser('https://x', { platform: 'darwin' });
    expect(r).toEqual({ opened: true });
    expect(spawnMock).toHaveBeenCalledOnce();
    expect(spawnMock.mock.calls[0][0]).toBe('open');
  });

  it('skips when $SSH_TTY is set', async () => {
    const r = await callOpenBrowser('https://x', { env: { SSH_TTY: '/dev/pts/1' } });
    expect(r).toEqual({ opened: false, reason: 'ssh' });
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('skips on Linux without DISPLAY or WAYLAND_DISPLAY', async () => {
    const r = await callOpenBrowser('https://x', { platform: 'linux', env: {} });
    expect(r).toEqual({ opened: false, reason: 'no-display' });
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('skips when noBrowser=true', async () => {
    const r = await callOpenBrowser('https://x', { noBrowser: true });
    expect(r).toEqual({ opened: false, reason: 'disabled' });
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('catches spawn failure and returns spawn-failed', async () => {
    spawnMock = vi.fn(() => { throw new Error('ENOENT'); });
    const r = await callOpenBrowser('https://x');
    expect(r).toEqual({ opened: false, reason: 'spawn-failed' });
  });
});
