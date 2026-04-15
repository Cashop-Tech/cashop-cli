import { spawn } from 'node:child_process';

export type OpenBrowserResult =
  | { opened: true }
  | { opened: false; reason: 'ssh' | 'no-display' | 'disabled' | 'spawn-failed' };

export interface OpenBrowserOpts {
  noBrowser: boolean;
  env: Record<string, string | undefined>;
  platform: NodeJS.Platform;
}

export async function openBrowser(url: string, opts: OpenBrowserOpts): Promise<OpenBrowserResult> {
  if (opts.noBrowser) return { opened: false, reason: 'disabled' };
  if (opts.env.SSH_TTY || opts.env.SSH_CONNECTION) return { opened: false, reason: 'ssh' };
  if (opts.platform === 'linux' && !opts.env.DISPLAY && !opts.env.WAYLAND_DISPLAY) {
    return { opened: false, reason: 'no-display' };
  }

  const cmd =
    opts.platform === 'darwin' ? 'open' :
    opts.platform === 'win32' ? 'cmd' :
    'xdg-open';
  const args = opts.platform === 'win32' ? ['/c', 'start', '', url] : [url];

  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {});
    child.unref();
    return { opened: true };
  } catch {
    return { opened: false, reason: 'spawn-failed' };
  }
}
