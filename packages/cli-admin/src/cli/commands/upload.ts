import { Command } from 'commander';
import chalk from 'chalk';
import { DEFAULT_ENVIRONMENT, type EnvironmentName } from '../../core/environments.js';
import { formatJson } from '../../core/output.js';
import { uploadFile } from '../../api/upload.js';

export function registerUploadCommands(program: Command): void {
  program
    .command('upload <file>')
    .description('上传本地文件到 R2 存储并返回 CDN URL')
    .addHelpText('after', `
支持的文件类型：JPEG、PNG、GIF、WebP、SVG、AVIF、MP4、WebM、MOV、PDF 等

输出格式：
  默认：打印 CDN URL 和文件 ID
  --json：{"accessUrl":"...","fileId":"...","fileKey":"..."}

示例：
  $ cashop-console upload ./banner.png
  $ cashop-console upload /tmp/generated-image.jpg --json
`)
    .action(async (filePath: string, _options: Record<string, unknown>, cmd: Command) => {
      const opts = cmd.optsWithGlobals<{
        env?: string;
        json?: boolean;
      }>();
      const env = (opts.env ?? DEFAULT_ENVIRONMENT) as EnvironmentName;
      const json = !!opts.json;

      const result = await uploadFile({ env }, filePath);

      if (json) {
        console.log(formatJson(result));
      } else {
        console.log(chalk.green('✓ 上传完成'));
        console.log(`  URL：    ${result.accessUrl}`);
        console.log(`  文件 ID：${result.fileId}`);
      }
    });
}
