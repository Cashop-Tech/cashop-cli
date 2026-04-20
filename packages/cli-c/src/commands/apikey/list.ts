import type { Command } from 'commander';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';
import { gatewayRequest } from '../../core/http-client.js';
import { BusinessError, CashopCliError, friendlyBusinessMessage } from '@cashop/core';
import type { ApiKeyListResponse } from '../../types/api.js';
import { requireOAuthDevice, renderListTable } from './_shared.js';

const LIST_PATH = '/member/cashop-member-auth/api/auth/v1/apikey/list';

function ensureGroup(program: Command, name: string): Command {
  return program.commands.find(c => c.name() === name)
    ?? program.command(name).description('Manage API keys');
}

const mod: CommandModule = {
  register(program: Command) {
    const group = ensureGroup(program, 'apikey');

    group
      .command('list')
      .description('List API keys for the current user (requires device login)')
      .option('--json', 'print JSON instead of table')
      .action(async function (this: Command) {
        const opts = (this as any).opts() as { json?: boolean };
        const ctx = getCtx(this as unknown as Command);

        const code = await runCmd(ctx, async () => {
          requireOAuthDevice(ctx.provider);
          let data: ApiKeyListResponse;
          try {
            data = await gatewayRequest<ApiKeyListResponse>(ctx.baseUrl, LIST_PATH, {
              method: 'GET',
              provider: ctx.provider,
            });
          } catch (e) {
            if (e instanceof BusinessError) {
              throw new CashopCliError(friendlyBusinessMessage(e.code, e.message));
            }
            throw e;
          }

          if (opts.json || ctx.outputMode === 'json') {
            process.stdout.write(JSON.stringify(data) + '\n');
            return;
          }
          if (data.items.length === 0) {
            process.stdout.write('No API keys.\n');
            return;
          }
          process.stdout.write(renderListTable(data.items) + '\n');
        });
        if (code !== 0) process.exit(code);
      });
  },
};

export default mod;
