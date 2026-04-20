import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import { runBang } from '../../src/tui/bang.js';

describe('runBang', () => {
  it('routes argv through a Commander program and captures stdout', async () => {
    const captured: string[] = [];
    const program = new Command();
    program.exitOverride();
    program.command('ping')
      .description('ping')
      .action(function () {
        captured.push('ping-called');
      });

    const out: string[] = [];
    const err: string[] = [];
    await runBang(program, ['ping'], {
      out: (s) => out.push(s),
      err: (s) => err.push(s),
    });
    expect(captured).toContain('ping-called');
  });

  it('captures commander errors (unknown command) without throwing', async () => {
    const program = new Command();
    program.exitOverride();
    program.command('known').action(() => {});

    const out: string[] = [];
    const err: string[] = [];
    await runBang(program, ['unknown'], {
      out: (s) => out.push(s),
      err: (s) => err.push(s),
    });
    expect(err.join('')).toMatch(/unknown command|error/i);
  });

  it('catches thrown errors in action without crashing', async () => {
    const program = new Command();
    program.exitOverride();
    program.command('boom').action(async () => { throw new Error('kaboom'); });

    const err: string[] = [];
    await runBang(program, ['boom'], {
      out: () => {},
      err: (s) => err.push(s),
    });
    expect(err.join('')).toMatch(/kaboom/);
  });

  it('intercepts process.exit(code) so P1-style commands do not kill the TUI', async () => {
    const program = new Command();
    program.exitOverride();
    // 模仿 P1 模块：action 最后 process.exit(code)
    program.command('quit-nonzero').action(() => { (process.exit as any)(3); });
    program.command('quit-zero').action(() => { (process.exit as any)(0); });

    const err: string[] = [];
    const out: string[] = [];
    const code1 = await runBang(program, ['quit-nonzero'], {
      out: (s) => out.push(s), err: (s) => err.push(s),
    });
    const code2 = await runBang(program, ['quit-zero'], {
      out: (s) => out.push(s), err: (s) => err.push(s),
    });
    expect(code1).toBe(3);
    expect(code2).toBe(0);
    // 还原：process.exit 必须仍是可用的（测试自身不能坏）
    expect(typeof process.exit).toBe('function');
  });
});
