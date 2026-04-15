import type { Command } from 'commander';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';
import { ReauthRequired } from '../../core/errors.js';

const mod: CommandModule = {
  register(program: Command) {
    program
      .command('whoami')
      .description('Show the logged-in user for the current env')
      .action(async function (this: Command) {
        const ctx = getCtx(this as unknown as Command);
        const code = await runCmd(ctx, async () => {
          const tok = await ctx.store.getPasswordToken(ctx.env);
          if (!tok) throw new ReauthRequired();
          return { userId: tok.userId, env: ctx.env, expires_at: new Date(tok.expires_at).toISOString() };
        });
        if (code !== 0) process.exit(code);
      });
  },
};
export default mod;
