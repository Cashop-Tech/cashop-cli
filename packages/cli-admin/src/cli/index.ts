import { Command, Option } from 'commander';
import { registerAuthCommands } from './commands/auth.js';
import { registerConfigCommands } from './commands/config.js';
import { registerSalesProductCommands } from './commands/sales-product.js';
import { registerResourceCommands } from './commands/resource.js';
import { registerUploadCommands } from './commands/upload.js';
import { registerBrandCommands } from './commands/brand.js';

declare const __PKG_VERSION__: string;

export function createProgram(): Command {
  const program = new Command();

  program
    .name('cashop-console')
    .description('Cashop 运营管理 CLI 工具')
    .version(typeof __PKG_VERSION__ !== 'undefined' ? __PKG_VERSION__ : '0.0.0-dev')
    .addOption(
      new Option('--env <env>', '运行环境')
        .choices(['stable', 'prod'])
        .default('prod'),
    )
    .option('--json', '以 JSON 格式输出（默认为表格）')
    .option('--site <code>', '站点编码，如 JP（sales-product 命令必填）')
    .option('--token <token>', '认证 Token（也用于 "auth login" 保存 Token）')
    .option('--verbose', '显示详细日志');

  registerAuthCommands(program);
  registerConfigCommands(program);
  registerSalesProductCommands(program);
  registerResourceCommands(program);
  registerUploadCommands(program);
  registerBrandCommands(program);

  return program;
}
