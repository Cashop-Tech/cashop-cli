import type { Command } from 'commander';
import type { CommandModule } from './index.js';
import { getCtx, runCmd } from './_helpers.js';
import { gatewayRequest } from '../core/http-client.js';
import type { PrepayData, PrepayRequest } from '../types/api.js';

const PREPAY_PATH = '/trade/cashop-order-prod/api/order/payment/prepay';

// Shell script default: app deep links. CLI users on a terminal won't be able to
// open `cashop://` — callers that need a browser-openable flow should pass `--return-url`
// / `--cancel-url` pointing at an HTTPS sandbox.
const DEFAULT_RETURN = 'cashop://payment/success';
const DEFAULT_CANCEL = 'cashop://payment/cancel';

const mod: CommandModule = {
  register(program: Command) {
    const pay = ensureGroup(program, 'pay');
    pay
      .description('Initiate payment for a PENDING_PAYMENT order (returns paymentUrl to open in browser/app)')
      .argument('[orderGroupNo]', 'order group number (when omitted and no subcommand, prints help)')
      .option('--return-url <url>', 'URL to redirect to after payment succeeds', DEFAULT_RETURN)
      .option('--cancel-url <url>', 'URL to redirect to when payment is cancelled', DEFAULT_CANCEL)
      .option('--country <code>', 'x-country header', 'JP')
      .option('--currency <code>', 'x-currency header', 'JPY')
      .option('--language <code>', 'x-language header', 'ja')
      .action(async function (this: Command, orderGroupNo: string | undefined) {
        if (!orderGroupNo) { this.help(); return; }
        const ctx = getCtx(this as unknown as Command);
        const opts = (this as unknown as { opts(): Record<string, string | undefined> }).opts();
        const body: PrepayRequest = {
          orderGroupNo,
          returnUrl: String(opts.returnUrl),
          cancelUrl: String(opts.cancelUrl),
        };
        const code = await runCmd(ctx, async () =>
          await gatewayRequest<PrepayData>(ctx.baseUrl, PREPAY_PATH, {
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
