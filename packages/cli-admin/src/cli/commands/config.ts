import { Command } from 'commander';
import { readConfig, getConfigValue, setConfigValue } from '../../core/config.js';
import chalk from 'chalk';

export function registerConfigCommands(program: Command): void {
  const config = program.command('config').description('CLI 配置管理');

  // --------------------------------------------------------------------------
  // config set <key> <value>
  // --------------------------------------------------------------------------
  config
    .command('set <key> <value>')
    .description('设置配置项')
    .action((key: string, value: string) => {
      setConfigValue(key, value);
      console.log(chalk.green(`✓ 已设置 ${key} = ${value}`));
    });

  // --------------------------------------------------------------------------
  // config get <key>
  // --------------------------------------------------------------------------
  config
    .command('get <key>')
    .description('获取配置项')
    .action((key: string) => {
      const value = getConfigValue(key);
      if (value === undefined) {
        console.log(chalk.yellow(`（未设置）`));
      } else {
        console.log(value);
      }
    });

  // --------------------------------------------------------------------------
  // config list
  // --------------------------------------------------------------------------
  config
    .command('list')
    .description('列出所有配置项')
    .action(() => {
      const cfg = readConfig() as Record<string, unknown>;
      const entries = Object.entries(cfg);

      if (entries.length === 0) {
        console.log(chalk.dim('暂无配置项'));
        return;
      }

      // Determine max key width for alignment
      const maxKeyLen = entries.reduce(
        (max, [k]) => Math.max(max, k.length),
        0,
      );

      for (const [key, value] of entries) {
        const paddedKey = key.padEnd(maxKeyLen);
        const displayValue =
          typeof value === 'object' && value !== null
            ? JSON.stringify(value)
            : String(value);
        console.log(`  ${chalk.cyan(paddedKey)}  ${displayValue}`);
      }
    });
}
