import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Command } from 'commander';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';
import { PasswordProvider } from '../../core/auth-provider/password.js';
import { saveConfig } from '../../core/config.js';

const mod: CommandModule = {
  register(program: Command) {
    const auth = ensureGroup(program, 'auth', 'Authentication commands');
    auth
      .command('login')
      .description('Log in via email/password (P1 — will be replaced by OAuth in P3)')
      .requiredOption('--email <email>', 'email address')
      .requiredOption('--password <password>', 'password')
      .action(async function (this: Command) {
        const ctx = getCtx(this as unknown as Command);
        const { email, password } = (this as any).opts();
        const code = await runCmd(ctx, async () => {
          let deviceId = ctx.config.device_id;
          if (!deviceId) {
            deviceId = `cli-${randomUUID()}`;
            ctx.config.device_id = deviceId;
            saveConfig(join(homedir(), '.cashop', 'config.yaml'), ctx.config);
          }
          const { userId, nickname } = await PasswordProvider.login({
            base: ctx.baseUrl, env: ctx.env, store: ctx.store,
            email, password, deviceId,
          });
          return { ok: true, userId, nickname, env: ctx.env };
        });
        if (code !== 0) process.exit(code);
      });
  },
};
export default mod;

function ensureGroup(program: Command, name: string, description: string): Command {
  const existing = program.commands.find(c => c.name() === name);
  if (existing) return existing;
  return program.command(name).description(description);
}
