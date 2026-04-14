import type { Command } from 'commander';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';

const mod: CommandModule = {
  register(program: Command) {
    const auth = ensureGroup(program, 'auth');
    auth.command('logout')
      .description('Clear stored tokens for the current env')
      .action(async function (this: Command) {
        const ctx = getCtx(this as unknown as Command);
        const code = await runCmd(ctx, async () => {
          await ctx.store.clearPasswordToken(ctx.env);
          return { ok: true, env: ctx.env };
        });
        if (code !== 0) process.exit(code);
      });
  },
};
export default mod;

function ensureGroup(program: Command, name: string): Command {
  return program.commands.find(c => c.name() === name) ?? program.command(name);
}
