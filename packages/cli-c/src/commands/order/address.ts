import type { Command } from 'commander';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';
import { gatewayRequest } from '../../core/http-client.js';
import type {
  OrderModifyAddressData, OrderModifyAddressRequest,
} from '../../types/api.js';

const MODIFY_PATH = '/trade/cashop-order-prod/trade/order/v2/modifyAddress';

const mod: CommandModule = {
  register(program: Command) {
    const order = ensureGroup(program, 'order');
    order.command('address <orderNo>')
      .description('Change the delivery address on an unshipped order')
      .requiredOption('--address-id <id>', 'new address id (from `cashop address list`)')
      .option('--country <code>', 'x-country header', 'JP')
      .option('--currency <code>', 'x-currency header', 'JPY')
      .option('--language <code>', 'x-language header', 'ja')
      .action(async function (this: Command, orderNo: string) {
        const ctx = getCtx(this as unknown as Command);
        const opts = (this as unknown as { opts(): Record<string, string | undefined> }).opts();
        const body: OrderModifyAddressRequest = {
          orderNo,
          addressId: String(opts.addressId),
        };
        const code = await runCmd(ctx, async () =>
          await gatewayRequest<OrderModifyAddressData>(ctx.baseUrl, MODIFY_PATH, {
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
