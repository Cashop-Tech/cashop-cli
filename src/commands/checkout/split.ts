import type { Command } from 'commander';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';
import { gatewayRequest } from '../../core/http-client.js';
import type {
  DirectSplitData, DirectSplitProduct, DirectSplitRequest, OrderDeliveryType,
} from '../../types/api.js';

const SPLIT_PATH = '/trade/cashop-order-prod/api/cart/direct-split';
const DELIVERY_TYPES: readonly OrderDeliveryType[] = ['CONSOLIDATION', 'DIRECT_MAIL'];

const mod: CommandModule = {
  register(program: Command) {
    const checkout = ensureGroup(program, 'checkout');
    checkout.command('split')
      .description(
        'Direct-buy split preview. First-pass without --address-id returns delivery options; ' +
        'pass --address-id + --delivery-type for the full breakdown with freight/tax.',
      )
      .requiredOption('--spu <spuCode>', 'SPU code')
      .requiredOption('--sku <skuId>', 'SKU id')
      .requiredOption('--qty <n>', 'quantity', (s) => parseInt(s, 10))
      .option('--address-id <id>', 'delivery address id (second-pass)')
      .option('--delivery-type <type>', 'CONSOLIDATION | DIRECT_MAIL (second-pass)')
      .option('--size-format <fmt>', 'size chart format (e.g. US/JP/CN)')
      .option('--country <code>', 'targetCountryCode + x-country header', 'JP')
      .option('--currency <code>', 'x-currency header', 'JPY')
      .option('--language <code>', 'x-language header', 'ja')
      .action(async function (this: Command) {
        const ctx = getCtx(this as unknown as Command);
        const opts = (this as unknown as { opts(): Record<string, string | number | undefined> }).opts();

        const deliveryType = opts.deliveryType as string | undefined;
        if (deliveryType && !DELIVERY_TYPES.includes(deliveryType as OrderDeliveryType)) {
          throw new Error(`--delivery-type must be one of: ${DELIVERY_TYPES.join(', ')}`);
        }

        const product: DirectSplitProduct = {
          spuCode: String(opts.spu),
          skuId: String(opts.sku),
          quantity: Number(opts.qty),
        };
        if (opts.sizeFormat) product.sizeFormat = String(opts.sizeFormat);

        const body: DirectSplitRequest = {
          products: [product],
          targetCountryCode: String(opts.country),
        };
        if (opts.addressId) body.addressId = String(opts.addressId);
        if (deliveryType) body.deliveryType = deliveryType as OrderDeliveryType;
        if (opts.sizeFormat) body.sizeFormat = String(opts.sizeFormat);

        const code = await runCmd(ctx, async () =>
          await gatewayRequest<DirectSplitData>(ctx.baseUrl, SPLIT_PATH, {
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

function ensureGroup(program: Command, name: string): Command {
  return program.commands.find(c => c.name() === name) ?? program.command(name);
}
