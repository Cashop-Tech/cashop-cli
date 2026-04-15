import { randomBytes } from 'node:crypto';
import type { Command } from 'commander';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';
import { gatewayRequest } from '../../core/http-client.js';
import type { ProductSearchData } from '../../types/api.js';

const SEARCH_PATH = '/business/cashop-business-aggr-prod/open/product/list';

const mod: CommandModule = {
  register(program: Command) {
    program
      .command('search <keyword>')
      .description('Search products (aggregated catalogue)')
      .option('--page <n>', 'page number (1-based)', '1')
      .option('--page-size <n>', 'items per page (1-50)', '10')
      .action(async function (this: Command, keyword: string) {
        const ctx = getCtx(this as unknown as Command);
        const opts = (this as any).opts();
        const pageNum = Number(opts.page);
        const pageSize = Number(opts.pageSize);
        const code = await runCmd(ctx, async () => {
          return await gatewayRequest<ProductSearchData>(ctx.baseUrl, SEARCH_PATH, {
            method: 'POST',
            provider: ctx.provider,
            body: {
              pageId: 'search-result',
              searchParams: {
                scene: 'SEARCH_PRODUCT',
                keyword,
                searchRequestId: `cli-${Date.now()}-${randomBytes(3).toString('hex')}`,
                pageSize,
                pageNum,
              },
              pageSize,
            },
          });
        });
        if (code !== 0) process.exit(code);
      });
  },
};
export default mod;
