import type { Command } from 'commander';
import type { CommandModule } from './index.js';
import { getCtx, runCmd } from './_helpers.js';
import { gatewayRequest } from '../core/http-client.js';
import type { PromoListData, PromoListRequest } from '../types/api.js';

// Shell script branches on token presence:
//   token present → auth path (personal + public offers)
//   no token      → open path (public offers only)
// CLI mirrors this so unauthenticated callers don't hit a 401 from the auth path.
const AUTH_PATH = '/marketing/cashop-marketing/cms/v2/activity/queryActivityList';
const OPEN_PATH = '/marketing/cashop-marketing/open/cms/v2/activity/queryActivityList';

const mod: CommandModule = {
  register(program: Command) {
    program
      .command('promo')
      .description('List available promotions and coupons')
      .option('--page <n>', 'page number (1-based)', (s) => parseInt(s, 10), 1)
      .option('--page-size <n>', 'items per page', (s) => parseInt(s, 10), 20)
      .option('--country <code>', 'x-country header', 'JP')
      .option('--currency <code>', 'x-currency header', 'JPY')
      .option('--language <code>', 'x-language header', 'ja')
      .action(async function (this: Command) {
        const ctx = getCtx(this as unknown as Command);
        const opts = (this as unknown as {
          opts(): Record<string, string | number | undefined>;
        }).opts();
        const body: PromoListRequest = {
          pageIndex: Number(opts.page),
          pageSize: Number(opts.pageSize),
        };
        const code = await runCmd(ctx, async () => {
          const tok = await ctx.provider.getAccessToken();
          const path = tok ? AUTH_PATH : OPEN_PATH;
          return await gatewayRequest<PromoListData>(ctx.baseUrl, path, {
            method: 'POST', provider: ctx.provider, body,
            headers: {
              'x-country': String(opts.country),
              'x-currency': String(opts.currency),
              'x-language': String(opts.language),
            },
          });
        });
        if (code !== 0) process.exit(code);
      });
  },
};
export default mod;
