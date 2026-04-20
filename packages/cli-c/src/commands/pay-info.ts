import type { Command } from 'commander';
import type { CommandModule } from './index.js';
import { getCtx, runCmd } from './_helpers.js';
import { gatewayRequest } from '../core/http-client.js';
import type { PaymentInfoData } from '../types/api.js';

const PAYMENT_INFO_PATH = '/fin/cashop-fin-prod/api/finance/cashier/queryPaymentInfo';

const mod: CommandModule = {
  register(program: Command) {
    const pay = ensureGroup(program, 'pay');
    pay.command('info <paymentTradeNo>')
      .description('Query prepay info (receivableAmount etc.) for a paymentTradeNo')
      .option('--country <code>', 'x-country header', 'JP')
      .option('--currency <code>', 'x-currency header', 'JPY')
      .option('--language <code>', 'x-language header', 'ja')
      .action(async function (this: Command, paymentTradeNo: string) {
        const ctx = getCtx(this as unknown as Command);
        const opts = (this as unknown as { opts(): Record<string, string | undefined> }).opts();
        const code = await runCmd(ctx, async () =>
          await gatewayRequest<PaymentInfoData>(
            ctx.baseUrl,
            `${PAYMENT_INFO_PATH}?paymentTradeNo=${encodeURIComponent(paymentTradeNo)}`,
            {
              method: 'GET', provider: ctx.provider,
              headers: {
                'x-country': String(opts.country),
                'x-currency': String(opts.currency),
                'x-language': String(opts.language),
              },
            },
          ));
        if (code !== 0) process.exit(code);
      });
  },
};
export default mod;

function ensureGroup(program: Command, name: string): Command {
  return program.commands.find(c => c.name() === name) ?? program.command(name);
}
