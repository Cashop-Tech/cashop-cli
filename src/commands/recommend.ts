import type { Command } from 'commander';
import type { CommandModule } from './index.js';
import { getCtx, runCmd } from './_helpers.js';
import { gatewayRequest } from '../core/http-client.js';
import type { RecommendData, RecommendRequest } from '../types/api.js';

const RECOMMEND_PATH = '/business/cashop-business-aggr-prod/open/product/recommend';

const mod: CommandModule = {
  register(program: Command) {
    program
      .command('recommend <spuCode>')
      .description('List related-product recommendations for an SPU (open endpoint)')
      .option('--page <n>', 'page number (1-based)', '1')
      .option('--page-size <n>', 'items per page', '10')
      .option('--country <code>', 'x-country header', 'JP')
      .option('--currency <code>', 'x-currency header', 'JPY')
      .option('--language <code>', 'x-language header', 'ja')
      .action(async function (this: Command, spuCode: string) {
        const ctx = getCtx(this as unknown as Command);
        const opts = (this as unknown as { opts(): Record<string, string | undefined> }).opts();
        const body: RecommendRequest = {
          pageIndex: Number(opts.page),
          pageSize: Number(opts.pageSize),
          scene: 'product_detail',
          searchRequestId: `cli-${Math.floor(Date.now() / 1000)}-${process.pid}`,
          spuCodes: [spuCode],
        };
        const code = await runCmd(ctx, async () =>
          await gatewayRequest<RecommendData>(ctx.baseUrl, RECOMMEND_PATH, {
            method: 'POST', provider: ctx.provider, body,
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
