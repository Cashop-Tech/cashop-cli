import type { Command } from 'commander';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, saveConfig, setField } from '../../core/config.js';
import { BadArgsError } from '../../core/errors.js';

const mod: CommandModule = {
  register(program: Command) {
    const cfg = ensureGroup(program, 'config');
    cfg.command('env <target>')
      .description('Switch default env (stable|prod)')
      .action(async function (this: Command, target: string) {
        const ctx = getCtx(this as unknown as Command);
        const code = await runCmd(ctx, async () => {
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
function ensureGroup(program: Command, name: string): Command {
  return program.commands.find(c => c.name() === name) ?? program.command(name);
}
