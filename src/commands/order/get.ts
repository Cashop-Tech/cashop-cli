import type { Command } from 'commander';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';
import { gatewayRequest } from '../../core/http-client.js';
import type { OrderDetail } from '../../types/api.js';

// Real API: GET /trade/cashop-order-prod/api/order/{orderNo}
// (OrderQueryController#queryOrderDetail — confirmed Task 22 Step 1 probe).
const DETAIL_PATH_PREFIX = '/trade/cashop-order-prod/api/order/';

const mod: CommandModule = {
  register(program: Command) {
    program
      .command('order <orderNo>')
      .description('Show order details (requires login)')
      .action(async function (this: Command, orderNo: string) {
        const ctx = getCtx(this as unknown as Command);
        const code = await runCmd(ctx, async () =>
          await gatewayRequest<OrderDetail>(
            ctx.baseUrl,
            `${DETAIL_PATH_PREFIX}${encodeURIComponent(orderNo)}`,
            { method: 'GET', provider: ctx.provider },
          ));
        if (code !== 0) process.exit(code);
      });
  },
};
export default mod;
