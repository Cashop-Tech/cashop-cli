import type { Command } from 'commander';

export interface BangSinks {
  out: (s: string) => void;
  err: (s: string) => void;
}

/**
 * P1 命令全部在 action 末尾调用 `process.exit(code)`（见 login.ts:33、cart/add.ts:36 等）。
 * 在 bang 语境下，这会把整个 TUI 一起杀掉。这里把 process.exit 在 runBang 作用域内
 * 替换为 throw 一个可识别的 BangExit 对象，退出后立即恢复；不允许任何异常路径漏掉还原。
 */
class BangExit extends Error {
  constructor(public exitCode: number) { super(`bang exited with ${exitCode}`); }
}

export async function runBang(program: Command, argv: string[], sinks: BangSinks): Promise<number> {
  const realExit = process.exit.bind(process);
  (process as any).exit = ((code?: number) => {
    throw new BangExit(typeof code === 'number' ? code : 0);
  }) as typeof process.exit;
  try {
    await program.parseAsync(['node', 'cashop', ...argv]);
    return 0;
  } catch (e: any) {
    if (e instanceof BangExit) {
      // 非 0 就当作 bang 失败；P1 已经把 user-friendly error 写过 stderr，不再重复打
      return e.exitCode;
    }
    if (e && typeof e === 'object' && 'code' in e && typeof e.code === 'string' && e.code.startsWith('commander.')) {
      // Commander exitOverride 抛 CommanderError；打印 message 继续
      if (e.code === 'commander.helpDisplayed' || e.code === 'commander.version') return 0;
      sinks.err(`${e.message ?? 'commander error'}\n`);
      return 1;
    }
    sinks.err(`${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  } finally {
    (process as any).exit = realExit;
  }
}
