import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

type Level = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(msg: string, meta?: unknown): void;
  info(msg: string, meta?: unknown): void;
  warn(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
  close(): void;
}

export function createLogger(opts: { logDir: string; verbose: boolean }): Logger {
  mkdirSync(opts.logDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const path = join(opts.logDir, `cli-${date}.log`);

  const write = (level: Level, msg: string, meta?: unknown) => {
    if (level === 'debug' && !opts.verbose) return;
    const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, meta }) + '\n';
    appendFileSync(path, line);
    if (opts.verbose || level === 'warn' || level === 'error') {
      process.stderr.write(`[${level}] ${msg}\n`);
    }
  };

  return {
    debug: (m, meta) => write('debug', m, meta),
    info: (m, meta) => write('info', m, meta),
    warn: (m, meta) => write('warn', m, meta),
    error: (m, meta) => write('error', m, meta),
    close: () => {},
  };
}
