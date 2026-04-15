import type { Command } from 'commander';
import type { CommandModule } from './index.js';
import { getCtx, runCmd } from './_helpers.js';
import { gatewayRequest } from '../core/http-client.js';
import { confirmWrite } from '../core/confirm.js';

const BASE = '/ai/cashop-ai/rpc/auth/sessions/';

const mod: CommandModule = {
  register(program: Command) {
    const session = program.command('session').description('Session-scoped commands');

    session.command('rm <sessionId>')
      .description('Delete a chat session')
      .action(async function (this: Command, sessionId: string) {
        const ctx = getCtx(this as unknown as Command);
        const code = await runCmd(ctx, async () => {
          const ok = await confirmWrite({
            prompt: `Delete session ${sessionId}?`,
            yes: !!ctx.flags.yes, autoConfirm: ctx.config?.auto_confirm ?? false,
          });
          if (!ok) return { ok: false, reason: 'user-cancelled' };
          await gatewayRequest<unknown>(ctx.baseUrl, `${BASE}${encodeURIComponent(sessionId)}`, {
            method: 'DELETE', provider: ctx.provider, raw: true,
          });
          return { ok: true, deleted: sessionId };
        });
        if (code !== 0) process.exit(code);
      });
  },
};
export default mod;
