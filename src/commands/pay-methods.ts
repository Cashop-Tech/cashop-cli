import type { Command } from 'commander';
import type { CommandModule } from './index.js';
import { getCtx, runCmd } from './_helpers.js';
import { gatewayRequest } from '../core/http-client.js';
import type { PayMethodsData } from '../types/api.js';

const METHODS_PATH = '/fin/cashop-fin-prod/api/finance/cashier/getPayMethods';

// Shell script defaults (cashop-pay-methods) target the JP cashier. Keep the CLI
// aligned so `cashop pay methods` matches what the agent-side tool sees by default.
const DEFAULT_COUNTRY = 'JP';
const DEFAULT_CURRENCY = 'JPY';
const DEFAULT_LANGUAGE = 'ja';

const mod: CommandModule = {
  register(program: Command) {
    const pay = ensureGroup(program, 'pay');
    pay.command('methods')
      .description('List available payment methods for the current cashier (JP cashier by default)')
      .option('--country <code>', 'x-country header', DEFAULT_COUNTRY)
      .option('--currency <code>', 'x-currency header', DEFAULT_CURRENCY)
      .option('--language <code>', 'x-language header', DEFAULT_LANGUAGE)
      .action(async function (this: Command) {
        const ctx = getCtx(this as unknown as Command);
        const opts = (this as unknown as { opts(): Record<string, string | undefined> }).opts();
        const code = await runCmd(ctx, async () =>
          await gatewayRequest<PayMethodsData>(ctx.baseUrl, METHODS_PATH, {
            method: 'GET', provider: ctx.provider,
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
