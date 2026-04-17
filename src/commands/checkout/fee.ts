import type { Command } from 'commander';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';
import { gatewayRequest } from '../../core/http-client.js';
import type { FeeTrialData, FeeTrialRequest } from '../../types/api.js';

const FEE_TRIAL_PATH = '/trade/cashop-order-prod/api/inventory/fee-trial';

const mod: CommandModule = {
  register(program: Command) {
    const checkout = ensureGroup(program, 'checkout');
    checkout.command('fee')
      .description('Calculate logistics/price breakdown for one or more batches before order create')
      .requiredOption('--batch-nos <csv>', 'comma-separated batch numbers')
      .requiredOption('--address-id <id>', 'delivery address id')
      .option('--line-code <code>', 'specific shipping line code (optional)')
      .option('--outer-pkg <code>', 'outer package code', 'DEFAULT')
      .action(async function (this: Command) {
        const ctx = getCtx(this as unknown as Command);
        const opts = (this as unknown as { opts(): Record<string, string | undefined> }).opts();
        const body: FeeTrialRequest = {
          batchNos: String(opts.batchNos).split(',').map(s => s.trim()).filter(Boolean),
          addressId: String(opts.addressId),
          outerPackageCode: String(opts.outerPkg),
          sortType: 1,
        };
        if (opts.lineCode) body.lineCode = String(opts.lineCode);
        const code = await runCmd(ctx, async () =>
          await gatewayRequest<FeeTrialData>(ctx.baseUrl, FEE_TRIAL_PATH, {
            method: 'POST', provider: ctx.provider, body,
          }));
        if (code !== 0) process.exit(code);
      });
  },
};
export default mod;

function ensureGroup(program: Command, name: string): Command {
  return program.commands.find(c => c.name() === name) ?? program.command(name);
}
