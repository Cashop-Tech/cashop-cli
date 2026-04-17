import type { Command } from 'commander';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';
import { gatewayRequest } from '../../core/http-client.js';
import { confirmWrite } from '../../core/confirm.js';
import { BadArgsError } from '../../core/errors.js';
import type { CartData } from '../../types/api.js';

const ADD_PATH = '/trade/cashop-order-prod/api/cart/add';

const mod: CommandModule = {
  register(program: Command) {
    const cart = ensureGroup(program, 'cart');
    cart.command('add')
      .description('Add a SKU to your cart (requires login)')
      .requiredOption('--spu <spuCode>', 'SPU code (e.g. JP_506379367274803200)')
      .requiredOption('--sku <skuId>', 'SKU id (numeric string)')
      .requiredOption('--qty <n>', 'quantity', (s) => parseInt(s, 10))
      .option('--country <code>', 'x-country header', 'JP')
      .option('--currency <code>', 'x-currency header', 'JPY')
      .option('--language <code>', 'x-language header', 'ja')
      .action(async function (this: Command) {
        const ctx = getCtx(this as unknown as Command);
        const opts = (this as any).opts() as {
          spu: string; sku: string; qty: number;
          country: string; currency: string; language: string;
        };
        const { spu, sku, qty } = opts;
        if (!Number.isInteger(qty) || qty <= 0) throw new BadArgsError('--qty must be a positive integer');
        const code = await runCmd(ctx, async () => {
          if (qty > 5) {
            const ok = await confirmWrite({
              prompt: `Adding ${qty}× ${spu} [${sku}]. Proceed?`,
              yes: !!ctx.flags.yes, autoConfirm: ctx.config.auto_confirm,
            });
            if (!ok) return { ok: false, reason: 'user-cancelled' };
          }
          return await gatewayRequest<CartData>(ctx.baseUrl, ADD_PATH, {
            method: 'POST', provider: ctx.provider,
            body: { skuId: sku, spuCode: spu, quantity: qty },
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
  return program.commands.find(c => c.name() === name) ?? program.command(name).description('Cart commands');
}
