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
      .action(async function (this: Command, spuCode: string) {
        const ctx = getCtx(this as unknown as Command);
        const code = await runCmd(ctx, async () =>
          await gatewayRequest<ProductDetail>(ctx.baseUrl, DETAIL_PATH, {
            method: 'POST', provider: ctx.provider, body: { spuCode },
          }));
        if (code !== 0) process.exit(code);
      });
  },
};
export default mod;
