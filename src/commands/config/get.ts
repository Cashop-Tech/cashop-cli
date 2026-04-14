import type { Command } from 'commander';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';
import { getField } from '../../core/config.js';

const mod: CommandModule = {
  register(program: Command) {
    const cfg = ensureGroup(program, 'config');
    cfg.command('get [key]')
      .description('Print one or all config values')
      .action(async function (this: Command, key?: string) {
        const ctx = getCtx(this as unknown as Command);
        const code = await runCmd(ctx, async () => key ? getField(ctx.config, key) : ctx.config);
        if (code !== 0) process.exit(code);
      });
  },
};
export default mod;
function ensureGroup(program: Command, name: string): Command {
  return program.commands.find(c => c.name() === name) ?? program.command(name);
}
