import type { Command } from 'commander';
import type { CommandModule } from '../index.js';
import { getCtx, runCmd } from '../_helpers.js';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, saveConfig, setField } from '../../core/config.js';

const mod: CommandModule = {
  register(program: Command) {
    const cfg = ensureGroup(program, 'config');
    cfg.command('set <key> <value>')
      .description('Set a config value (dot notation, e.g. api.prod)')
      .action(async function (this: Command, key: string, value: string) {
        const ctx = getCtx(this as unknown as Command);
        const code = await runCmd(ctx, async () => {
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
function ensureGroup(program: Command, name: string): Command {
  return program.commands.find(c => c.name() === name) ?? program.command(name);
}
