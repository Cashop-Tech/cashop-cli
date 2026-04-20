import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Command } from 'commander';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';
import { PasswordProvider } from '../../core/auth-provider/password.js';
import { runDeviceFlow } from '../../core/device/device-flow.js';
import { saveConfig } from '../../core/config.js';

const mod: CommandModule = {
  register(program: Command) {
    program
      .command('login')
      .description('Log in (password by default; --device for OAuth device code)')
      .option('--device', 'use OAuth 2.0 device authorization grant', false)
      .option('--no-browser', 'do not auto-open the browser (device flow only)')
      .option('--email <email>', 'email address (password flow)')
      .option('--password <password>', 'password (password flow)')
      .action(async function (this: Command) {
        const ctx = getCtx(this as unknown as Command);
        const opts = (this as any).opts() as { device?: boolean; browser?: boolean; noBrowser?: boolean; email?: string; password?: string };
        const noBrowser = opts.noBrowser === true || opts.browser === false;
        const code = await runCmd(ctx, async () => {
          if (opts.device) {
            const { userId } = await runDeviceFlow({
              base: ctx.baseUrl,
              env: ctx.env,
              store: ctx.store,
              noBrowser,
              printer: (l) => console.log(l),
            });
            return { ok: true, userId, env: ctx.env, method: 'device' };
          }
          if (!opts.email || !opts.password) {
            throw new Error('email and password required for password login (or pass --device)');
          }
          let deviceId = ctx.config.device_id;
          if (!deviceId) {
            deviceId = `cli-${randomUUID()}`;
            ctx.config.device_id = deviceId;
            saveConfig(join(homedir(), '.cashop', 'config.yaml'), ctx.config);
          }
          const { userId, nickname } = await PasswordProvider.login({
            base: ctx.baseUrl, env: ctx.env, store: ctx.store,
            email: opts.email, password: opts.password, deviceId,
          });
          console.log('Tip: use `cashop login --device` for secure OAuth login (no password sent to CLI).');
          return { ok: true, userId, nickname, env: ctx.env, method: 'password' };
        });
        if (code !== 0) process.exit(code);
      });
  },
};
export default mod;
