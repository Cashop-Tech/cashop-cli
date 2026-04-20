import type { Command } from 'commander';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';
import { gatewayRequest } from '../../core/http-client.js';
import type { CartSplitData, CartSplitRequest, OrderDeliveryType } from '../../types/api.js';

const SPLIT_PATH = '/trade/cashop-order-prod/api/cart/split';
const DELIVERY_TYPES: readonly OrderDeliveryType[] = ['CONSOLIDATION', 'DIRECT_MAIL'];

const mod: CommandModule = {
  register(program: Command) {
    const cart = ensureGroup(program, 'cart');
    cart.command('split')
      .description(
        'Cart split preview before checkout. Bare call previews all cart items; ' +
        '--address-id + --delivery-type second-pass yields the full freight/tax breakdown.',
      )
      .option('--address-id <id>', 'delivery address id (second-pass)')
      .option('--cart-ids <csv>', 'comma-separated cartNos (default: all items in cart)')
      .option('--delivery-type <type>', 'CONSOLIDATION | DIRECT_MAIL (second-pass)')
      .option('--country <code>', 'x-country header', 'JP')
      .option('--currency <code>', 'x-currency header', 'JPY')
      .option('--language <code>', 'x-language header', 'ja')
      .action(async function (this: Command) {
        const ctx = getCtx(this as unknown as Command);
        const opts = (this as unknown as { opts(): Record<string, string | undefined> }).opts();

        const deliveryType = opts.deliveryType;
        if (deliveryType && !DELIVERY_TYPES.includes(deliveryType as OrderDeliveryType)) {
          throw new Error(`--delivery-type must be one of: ${DELIVERY_TYPES.join(', ')}`);
        }

        const body: CartSplitRequest = {};
        if (opts.addressId) body.addressId = String(opts.addressId);
        if (opts.cartIds) {
          body.cartNos = String(opts.cartIds).split(',').map(s => s.trim()).filter(Boolean);
        }
        if (deliveryType) body.deliveryType = deliveryType as OrderDeliveryType;

        const code = await runCmd(ctx, async () =>
          await gatewayRequest<CartSplitData>(ctx.baseUrl, SPLIT_PATH, {
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
