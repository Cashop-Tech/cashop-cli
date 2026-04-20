import type { Command } from 'commander';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, saveConfig, setField } from '../../core/config.js';
import { BadArgsError } from '@cashop/core';

const mod: CommandModule = {
  register(program: Command) {
    program
      .command('env [target]')
      .description('Switch default env (stable|prod). No arg prints current env.')
      .action(async function (this: Command, target?: string) {
        const ctx = getCtx(this as unknown as Command);
        const code = await runCmd(ctx, async () => {
          if (target === undefined) return { env: ctx.config.env };
          if (target !== 'stable' && target !== 'prod') throw new BadArgsError('env must be stable or prod');
          const path = join(homedir(), '.cashop', 'config.yaml');
          const next = setField(loadConfig(path), 'env', target);
          saveConfig(path, next);
          return { ok: true, env: target };
        });
        if (code !== 0) process.exit(code);
      });
  },
};
export default mod;
