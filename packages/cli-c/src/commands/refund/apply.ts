import type { Command } from 'commander';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';
import { gatewayRequest } from '../../core/http-client.js';
import { BadArgsError } from '@cashop/core';
import type {
  AftersaleReason, AftersaleType, RefundApplyData, RefundApplyRequest,
} from '../../types/api.js';

const APPLY_PATH = '/trade/cashop-aftersale/operation-support/cashop-aftersale/api/aftersale/apply';
const AS_TYPES: readonly AftersaleType[] = [2, 4, 9];
const REASON_CODES: readonly AftersaleReason[] = [0, 1, 2, 3, 4, 5, 6];

const mod: CommandModule = {
  register(program: Command) {
    const refund = ensureGroup(program, 'refund');
    refund.command('apply')
      .description(
        'Submit an aftersale ticket (refund / return-and-refund). ' +
        'as-type: 2=refund-only (shipped), 4=return+refund, 9=refund-only (unshipped).',
      )
      .requiredOption('--order-no <no>', 'main order number (from `cashop orders`)')
      .requiredOption('--as-type <n>', 'aftersale type: 2 | 4 | 9', (s) => parseInt(s, 10))
      .requiredOption(
        '--reason-code <n>',
        'reason: 0=不想要了 1=买错/多买 2=运费太贵 3=无质量问题 4=发错货 5=质量问题 6=运输破损',
        (s) => parseInt(s, 10),
      )
      .option('--sku-order-no <no>', 'SKU sub-order number (specific item)')
      .option('--quantity <n>', 'quantity to refund', (s) => parseInt(s, 10), 1)
      .option('--remark <text>', 'free-text remark')
      .option('--country <code>', 'x-country header', 'JP')
      .option('--currency <code>', 'x-currency header', 'JPY')
      .option('--language <code>', 'x-language header', 'ja')
      .action(async function (this: Command) {
        const ctx = getCtx(this as unknown as Command);
        const opts = (this as unknown as {
          opts(): Record<string, string | number | undefined>;
        }).opts();

        const asType = Number(opts.asType);
        if (!AS_TYPES.includes(asType as AftersaleType)) {
          throw new BadArgsError(`--as-type must be one of: ${AS_TYPES.join(', ')}`);
        }
        const reasonCode = Number(opts.reasonCode);
        if (!REASON_CODES.includes(reasonCode as AftersaleReason)) {
          throw new BadArgsError(`--reason-code must be one of: ${REASON_CODES.join(', ')}`);
        }

        const body: RefundApplyRequest = {
          orderNo: String(opts.orderNo),
          asType: asType as AftersaleType,
          applyReason: reasonCode as AftersaleReason,
          applyQuantity: Number(opts.quantity),
        };
        if (opts.skuOrderNo) body.skuOrderNo = String(opts.skuOrderNo);
        if (opts.remark) body.applyRemark = String(opts.remark);

        const code = await runCmd(ctx, async () =>
          await gatewayRequest<RefundApplyData>(ctx.baseUrl, APPLY_PATH, {
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
