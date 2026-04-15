import type { Command } from 'commander';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';
import { gatewayRequest } from '../../core/http-client.js';
import type { CartData } from '../../types/api.js';

const LIST_PATH = '/trade/cashop-order-prod/api/cart/list';

const mod: CommandModule = {
  register(program: Command) {
    const cart = ensureGroup(program, 'cart');
    cart
      .description('List cart items (requires login). Use `cart add` to add a SKU.')
      .action(async function (this: Command) {
        const ctx = getCtx(this as unknown as Command);
        const code = await runCmd(ctx, async () =>
          await gatewayRequest<CartData>(ctx.baseUrl, LIST_PATH, {
            method: 'POST', provider: ctx.provider, body: {},
          }));
        if (code !== 0) process.exit(code);
      });
  },
};
export default mod;

function ensureGroup(program: Command, name: string): Command {
  return program.commands.find(c => c.name() === name) ?? program.command(name);
}
