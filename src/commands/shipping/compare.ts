import type { Command } from 'commander';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';
import { gatewayRequest } from '../../core/http-client.js';
import type { ShippingCompareData, ShippingCompareRequest } from '../../types/api.js';

const SHIPPING_PATH = '/trade/cashop-order-prod/api/inventory/shipping-fee-query';

const mod: CommandModule = {
  register(program: Command) {
    const shipping = ensureGroup(program, 'shipping');
    shipping.command('compare')
      .description('Compare shipping methods and freight estimates for a parcel')
      .requiredOption('--country <code>', 'destination country ISO code, e.g. JP')
      .requiredOption('--weight <g>', 'weight in grams', (s) => parseInt(s, 10))
      .option('--length <cm>', 'length in cm', (s) => parseInt(s, 10), 10)
      .option('--width <cm>', 'width in cm', (s) => parseInt(s, 10), 10)
      .option('--height <cm>', 'height in cm', (s) => parseInt(s, 10), 10)
      .action(async function (this: Command) {
        const ctx = getCtx(this as unknown as Command);
        const opts = (this as unknown as {
          opts(): Record<string, string | number | undefined>;
        }).opts();
        const body: ShippingCompareRequest = {
          destinationCountry: String(opts.country),
          weight: Number(opts.weight),
          length: Number(opts.length),
          width: Number(opts.width),
          height: Number(opts.height),
          sortType: 1,
        };
        const code = await runCmd(ctx, async () =>
          await gatewayRequest<ShippingCompareData>(ctx.baseUrl, SHIPPING_PATH, {
            method: 'POST', provider: ctx.provider, body,
            // Shell hardcodes gateway_auth_post header defaults (JP/JPY/ja);
            // no CLI override since --country is already the body's destinationCountry.
            headers: { 'x-country': 'JP', 'x-currency': 'JPY', 'x-language': 'ja' },
          }));
        if (code !== 0) process.exit(code);
      });
  },
};
export default mod;

function ensureGroup(program: Command, name: string): Command {
  return program.commands.find(c => c.name() === name) ?? program.command(name);
}
