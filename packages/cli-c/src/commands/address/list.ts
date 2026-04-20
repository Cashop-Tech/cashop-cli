import type { Command } from 'commander';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';
import { gatewayRequest } from '../../core/http-client.js';
import type { AddressListData } from '../../types/api.js';

const LIST_PATH = '/business/cashop-business-aggr-prod/api/member/address/list';

const mod: CommandModule = {
  register(program: Command) {
    const address = ensureGroup(program, 'address');
    address.command('list')
      .description('List saved delivery addresses (paged)')
      .option('--page <n>', 'page number (1-based)', '1')
      .option('--page-size <n>', 'items per page', '20')
      .option('--country <code>', 'x-country header', 'JP')
      .option('--currency <code>', 'x-currency header', 'JPY')
      .option('--language <code>', 'x-language header', 'ja')
      .action(async function (this: Command) {
        const ctx = getCtx(this as unknown as Command);
        const opts = (this as unknown as { opts(): Record<string, string | undefined> }).opts();
        const code = await runCmd(ctx, async () =>
          await gatewayRequest<AddressListData>(ctx.baseUrl, LIST_PATH, {
            method: 'POST', provider: ctx.provider,
            body: { pageIndex: Number(opts.page), pageSize: Number(opts.pageSize) },
            headers: {
              'x-country': String(opts.country),
              'x-currency': String(opts.currency),
              'x-language': String(opts.language),
            },
          }));
        if (code !== 0) process.exit(code);
      });
  },
};
export default mod;

function ensureGroup(program: Command, name: string): Command {
  return program.commands.find(c => c.name() === name) ?? program.command(name);
}
