import type { Command } from 'commander';
import type { CommandModule } from './index.js';
import { getCtx, runCmd } from './_helpers.js';
import { gatewayRequest } from '../core/http-client.js';
import type { TrackingData } from '../types/api.js';

const mod: CommandModule = {
  register(program: Command) {
    program
      .command('track <orderNo>')
      .description('Show logistics tracking for an order')
      .option('--country <code>', 'x-country header', 'JP')
      .option('--currency <code>', 'x-currency header', 'JPY')
      .option('--language <code>', 'x-language header', 'ja')
      .action(async function (this: Command, orderNo: string) {
        const ctx = getCtx(this as unknown as Command);
        const opts = (this as unknown as { opts(): Record<string, string | undefined> }).opts();
        const path = `/trade/cashop-order-prod/api/order/${encodeURIComponent(orderNo)}/tracking`;
        const code = await runCmd(ctx, async () =>
          await gatewayRequest<TrackingData>(ctx.baseUrl, path, {
            method: 'GET', provider: ctx.provider,
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
