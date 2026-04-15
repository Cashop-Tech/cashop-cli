import type { Command } from 'commander';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';

const mod: CommandModule = {
  register(program: Command) {
    program
      .command('whoami')
      .description('Show the logged-in user for the current env')
      .action(async function (this: Command) {
        const ctx = getCtx(this as unknown as Command);
        const code = await runCmd(ctx, async () => {
          const oauth = await ctx.store.getOAuth(ctx.env);
          if (oauth) {
            if (oauth.refresh_expires_at > Date.now()) {
              return {
                kind: 'oauth-device',
                userId: oauth.account,
                env: ctx.env,
                expires_at: new Date(oauth.expires_at).toISOString(),
              };
            }
            const pw = await ctx.store.getPasswordToken(ctx.env);
            if (!pw) return { kind: 'none', env: ctx.env, note: 'device token expired' };
          }
          const pw = await ctx.store.getPasswordToken(ctx.env);
          if (pw) {
            return {
              kind: 'password',
              userId: pw.userId,
              env: ctx.env,
              expires_at: new Date(pw.expires_at).toISOString(),
            };
          }
          const apiKey = await ctx.store.getApiKey(ctx.env);
          if (apiKey) return { kind: 'api-key', env: ctx.env, name: apiKey.name };
          return { kind: 'none', env: ctx.env };
        });
        if (code !== 0) process.exit(code);
      });
  },
};
export default mod;
