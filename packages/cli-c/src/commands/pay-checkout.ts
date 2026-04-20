import type { Command } from 'commander';
import type { CommandModule } from './index.js';
import { getCtx, runCmd } from './_helpers.js';
import { gatewayRequest } from '../core/http-client.js';
import { BadArgsError } from '@cashop/core';
import type { PayFromCheckoutData, PayFromCheckoutRequest } from '../types/api.js';

const CHECKOUT_PAY_PATH = '/fin/cashop-fin-prod/api/finance/cashier/payFromCheckout';

const mod: CommandModule = {
  register(program: Command) {
    const pay = ensureGroup(program, 'pay');
    pay.command('checkout')
      .description('Execute payment for a prepay (run `cashop pay <orderGroupNo>` first to get paymentTradeNo)')
      .requiredOption('--payment-trade-no <ptn>', 'prepay trade number (from `cashop pay` response)')
      .requiredOption('--pay-channel <channel>', 'payment channel, e.g. GMO_PAY | BALANCE_PAYMENT | STRIPE_PAY | AEON_PAY')
      .requiredOption('--total-amount <n>', 'payment amount', (s) => Number(s))
      .option('--currency <code>', 'payment currency (also x-currency header)', 'JPY')
      .option('--country <code>', 'x-country header', 'JP')
      .option('--language <code>', 'x-language header', 'ja')
      .action(async function (this: Command) {
        const ctx = getCtx(this as unknown as Command);
        const opts = (this as unknown as {
          opts(): Record<string, string | number | undefined>;
        }).opts();
        const totalAmount = Number(opts.totalAmount);
        if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
          throw new BadArgsError('--total-amount must be a positive number');
        }
        const body: PayFromCheckoutRequest = {
          paymentTradeNo: String(opts.paymentTradeNo),
          payChannel: String(opts.payChannel),
          totalAmount,
          currency: String(opts.currency),
        };
        const code = await runCmd(ctx, async () =>
          await gatewayRequest<PayFromCheckoutData>(ctx.baseUrl, CHECKOUT_PAY_PATH, {
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
