import type { Command } from 'commander';
import type { CommandModule } from './index.js';
import { getCtx, runCmd } from './_helpers.js';
import { gatewayRequest } from '../core/http-client.js';
import type { SessionListResponse } from '../types/chat.js';

const LIST_PATH = '/ai/cashop-ai/rpc/auth/sessions';

const mod: CommandModule = {
  register(program: Command) {
    program.command('sessions')
      .description('List your AI chat sessions')
      .action(async function (this: Command) {
        const ctx = getCtx(this as unknown as Command);
        const code = await runCmd(ctx, async () => {
          const res = await gatewayRequest<SessionListResponse>(ctx.baseUrl, LIST_PATH, {
            method: 'GET', provider: ctx.provider,
          });
          // `format()` 对 object 会打印键值两行表，UX 差；这里 unwrap 成数组让它走 array 分支
          // pretty 模式得到 cli-table3 表格；json 模式依旧是顶层数组（脚本友好）
          return res.sessions ?? [];
        });
        if (code !== 0) process.exit(code);
      });
  },
};
export default mod;
