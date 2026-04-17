import type { Command } from 'commander';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';
import { gatewayRequest } from '../../core/http-client.js';
import type { OrderListData } from '../../types/api.js';

const LIST_PATH = '/trade/cashop-order-prod/api/order/list';

const mod: CommandModule = {
  register(program: Command) {
    program
      .command('orders')
      .description('List your orders (requires login)')
      .option('--page <n>', 'page number (1-based)', '1')
      .option('--page-size <n>', 'items per page', '10')
      .option('--country <code>', 'x-country header', 'JP')
      .option('--currency <code>', 'x-currency header', 'JPY')
      .option('--language <code>', 'x-language header', 'ja')
      .action(async function (this: Command) {
        const ctx = getCtx(this as unknown as Command);
        const opts = (this as any).opts();
        const code = await runCmd(ctx, async () =>
          await gatewayRequest<OrderListData>(ctx.baseUrl, LIST_PATH, {
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
