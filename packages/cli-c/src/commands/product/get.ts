import type { Command } from 'commander';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';
import { gatewayRequest } from '../../core/http-client.js';
import type { ProductDetail } from '../../types/api.js';

const DETAIL_PATH = '/business/cashop-business-aggr-prod/open/product/v2';

const mod: CommandModule = {
  register(program: Command) {
    program
      .command('product <spuCode>')
      .description('Show a product by spuCode')
      .option('--country <code>', 'x-country header', 'JP')
      .option('--currency <code>', 'x-currency header', 'JPY')
      .option('--language <code>', 'x-language header', 'ja')
      .action(async function (this: Command, spuCode: string) {
        const ctx = getCtx(this as unknown as Command);
        const opts = (this as unknown as { opts(): Record<string, string | undefined> }).opts();
        const code = await runCmd(ctx, async () =>
          await gatewayRequest<ProductDetail>(ctx.baseUrl, DETAIL_PATH, {
            method: 'POST', provider: ctx.provider, body: { spuCode },
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
