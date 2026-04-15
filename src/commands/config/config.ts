import type { Command } from 'commander';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { getField, loadConfig, saveConfig, setField } from '../../core/config.js';

const mod: CommandModule = {
  register(program: Command) {
    program
      .command('config [key] [value]')
      .description('Print or update CLI config (0 args: print all; 1 arg: get field; 2 args: set field)')
      .action(async function (this: Command, key?: string, value?: string) {
        const ctx = getCtx(this as unknown as Command);
        const code = await runCmd(ctx, async () => {
          if (key === undefined) return ctx.config;
          if (value === undefined) return getField(ctx.config, key);
          const path = join(homedir(), '.cashop', 'config.yaml');
          const current = loadConfig(path);
          const next = setField(current, key, value);
          saveConfig(path, next);
          return { ok: true, key, value: next[key as keyof typeof next] ?? value };
        });
        if (code !== 0) process.exit(code);
      });
  },
};
export default mod;
