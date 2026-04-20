import type { Command } from 'commander';
import type { CliContext } from '../core/globals.js';
import { BusinessError, exitCodeFor, friendlyBusinessMessage } from '@cashop/core';
import { format } from '@cashop/core';

export function getCtx(cmd: Command): CliContext {
  let c: any = cmd;
  while (c) {
    if (c.__ctx) return c.__ctx as CliContext;
    c = c.parent;
  }
  throw new Error('CliContext not initialised — did entry.ts run preAction?');
}

export interface RunIO {
  write?: (s: string) => void;
  writeErr?: (s: string) => void;
}

export async function runCmd<T>(
  ctx: CliContext,
  fn: () => Promise<T>,
  io: RunIO = {},
): Promise<number> {
  const write = io.write ?? ((s) => process.stdout.write(s + '\n'));
  const writeErr = io.writeErr ?? ((s) => process.stderr.write(s + '\n'));
  try {
    const data = await fn();
    if (data !== undefined) write(format(data, { mode: ctx.outputMode }));
    return 0;
  } catch (e) {
    if (e instanceof BusinessError) {
      writeErr(friendlyBusinessMessage(e.code, e.message));
    } else {
      writeErr(e instanceof Error ? e.message : String(e));
    }
    return exitCodeFor(e);
  }
}
