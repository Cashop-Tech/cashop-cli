import type { Command } from 'commander';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';
import { gatewayRequest } from '../../core/http-client.js';
import type { CouponClaimData, CouponClaimRequest } from '../../types/api.js';

const CLAIM_PATH = '/marketing/cashop-marketing/cms/v2/coupon/claimCoupon';

const mod: CommandModule = {
  register(program: Command) {
    const coupon = ensureGroup(program, 'coupon');
    coupon.command('claim')
      .description('Claim a coupon by id (from `cashop promo`)')
      .requiredOption('--coupon-id <id>', 'coupon id to claim')
      .option('--country <code>', 'x-country header', 'JP')
      .option('--currency <code>', 'x-currency header', 'JPY')
      .option('--language <code>', 'x-language header', 'ja')
      .action(async function (this: Command) {
        const ctx = getCtx(this as unknown as Command);
        const opts = (this as unknown as { opts(): Record<string, string | undefined> }).opts();
        const body: CouponClaimRequest = { couponId: String(opts.couponId) };
        const code = await runCmd(ctx, async () =>
          await gatewayRequest<CouponClaimData>(ctx.baseUrl, CLAIM_PATH, {
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
