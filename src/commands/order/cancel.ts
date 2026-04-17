import type { Command } from 'commander';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';
import { gatewayRequest } from '../../core/http-client.js';
import { confirmWrite } from '../../core/confirm.js';
import type { OrderCancelData, OrderCancelRequest } from '../../types/api.js';

const CANCEL_PATH = '/trade/cashop-order-prod/api/order/cancelOrderBeforePay';

const mod: CommandModule = {
  register(program: Command) {
    const order = ensureGroup(program, 'order');
    order.command('cancel <orderGroupNo>')
      .description('Cancel a PENDING_PAYMENT order (already-paid/shipped orders need refund flow)')
      .option('--reason-code <code>', 'backend reason code', 'OTHER')
      .option('--reason <text>', 'free-text cancel reason', 'cancelled via cashop-cli')
      .option('--country <code>', 'x-country header', 'JP')
      .option('--currency <code>', 'x-currency header', 'JPY')
      .option('--language <code>', 'x-language header', 'ja')
      .action(async function (this: Command, orderGroupNo: string) {
        const ctx = getCtx(this as unknown as Command);
        const opts = (this as unknown as { opts(): Record<string, string | undefined> }).opts();
        const body: OrderCancelRequest = {
          orderGroupNo,
          cancelReasonCode: String(opts.reasonCode),
          cancelSource: 'USER',
          cancelReasonMessage: String(opts.reason),
        };
        const code = await runCmd(ctx, async () => {
          const ok = await confirmWrite({
            prompt: `Cancel order ${orderGroupNo}? This cannot be undone.`,
            yes: !!ctx.flags.yes, autoConfirm: ctx.config.auto_confirm,
          });
          if (!ok) return { ok: false, reason: 'user-cancelled' };
          return await gatewayRequest<OrderCancelData>(ctx.baseUrl, CANCEL_PATH, {
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
