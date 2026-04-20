import type { Command } from 'commander';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';
import { gatewayRequest } from '../../core/http-client.js';
import { confirmWrite } from '../../core/confirm.js';
import { BadArgsError } from '@cashop/core';
import type { OrderCreateData, OrderCreateRequest, OrderDeliveryType } from '../../types/api.js';

const CREATE_PATH = '/trade/cashop-order-prod/api/order/create';

const DELIVERY_TYPES: readonly OrderDeliveryType[] = ['CONSOLIDATION', 'DIRECT_MAIL'];

const mod: CommandModule = {
  register(program: Command) {
    const order = ensureGroup(program, 'order');
    order.command('create')
      .description('Create a direct-buy order (requires login, requires --address)')
      .requiredOption('--spu <spuCode>', 'SPU code')
      .requiredOption('--sku <skuId>', 'SKU id')
      .requiredOption('--qty <n>', 'quantity', (s) => parseInt(s, 10))
      .requiredOption('--address <addressId>', 'delivery address id (use `cashop address` to list)')
      .option('--delivery-type <type>', 'CONSOLIDATION | DIRECT_MAIL', 'CONSOLIDATION')
      .option('--dm-line-code <code>', 'direct-mail line code (required when --delivery-type DIRECT_MAIL)')
      .option('--dm-shipping-fee <fee>', 'direct-mail shipping fee (required when --delivery-type DIRECT_MAIL)')
      .option('--business-order-no <key>', 'idempotency key, format biz_{hash}')
      .option('--country <code>', 'x-country header', 'JP')
      .option('--currency <code>', 'x-currency header', 'JPY')
      .option('--language <code>', 'x-language header', 'ja')
      .action(async function (this: Command) {
        const ctx = getCtx(this as unknown as Command);
        const opts = (this as unknown as { opts(): Record<string, string | number | undefined> }).opts();
        const spu = String(opts.spu);
        const sku = String(opts.sku);
        const qty = Number(opts.qty);
        const address = String(opts.address);
        const deliveryType = String(opts.deliveryType) as OrderDeliveryType;
        const dmLineCode = opts.dmLineCode ? String(opts.dmLineCode) : undefined;
        const dmShippingFee = opts.dmShippingFee ? String(opts.dmShippingFee) : undefined;
        const businessOrderNo = opts.businessOrderNo ? String(opts.businessOrderNo) : undefined;

        if (!Number.isInteger(qty) || qty <= 0) throw new BadArgsError('--qty must be a positive integer');
        if (!DELIVERY_TYPES.includes(deliveryType)) {
          throw new BadArgsError(`--delivery-type must be one of ${DELIVERY_TYPES.join('|')}`);
        }
        if (deliveryType === 'DIRECT_MAIL' && (!dmLineCode || !dmShippingFee)) {
          throw new BadArgsError('--delivery-type DIRECT_MAIL requires --dm-line-code and --dm-shipping-fee');
        }

        const body: OrderCreateRequest = {
          addressId: address,
          orderWay: 1,
          products: [{ spuCode: spu, skuId: sku, quantity: qty }],
          deliveryType,
          ...(dmLineCode ? { dmLineCode } : {}),
          ...(dmShippingFee ? { dmShippingFee } : {}),
          ...(businessOrderNo ? { businessOrderNo } : {}),
        };

        const code = await runCmd(ctx, async () => {
          const ok = await confirmWrite({
            prompt: `Create order for ${qty}× ${spu} [${sku}] to address ${address}. Proceed?`,
            yes: !!ctx.flags.yes, autoConfirm: ctx.config.auto_confirm,
          });
          if (!ok) return { ok: false, reason: 'user-cancelled' };
          return await gatewayRequest<OrderCreateData>(ctx.baseUrl, CREATE_PATH, {
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

function ensureGroup(program: Command, name: string): Command {
  return program.commands.find(c => c.name() === name) ?? program.command(name);
}
