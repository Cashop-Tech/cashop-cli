import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import chalk from 'chalk';
import { resolveAuthContext } from '../../core/auth.js';
import { DEFAULT_ENVIRONMENT, type EnvironmentName } from '../../core/environments.js';
import { formatJson, formatTable } from '../../core/output.js';
import {
  listBrands,
  getBrandDetail,
  listBrandStories,
  getBrandStoryDetail,
  saveBrandStory,
  updateBrandStory,
  getSupportedLanguages,
} from '../../api/brand.js';
import type { ApiContext } from '../../api/brand.js';

// ---------------------------------------------------------------------------
// Global options helper
// ---------------------------------------------------------------------------

interface GlobalOpts {
  env: EnvironmentName;
  json: boolean;
  token?: string;
}

function getGlobalOpts(cmd: Command): GlobalOpts {
  const opts = cmd.optsWithGlobals<{
    env?: string;
    json?: boolean;
    token?: string;
  }>();

  return {
    env: (opts.env ?? DEFAULT_ENVIRONMENT) as EnvironmentName,
    json: !!opts.json,
    token: opts.token,
  };
}

function makeCtx(globalOpts: GlobalOpts): ApiContext {
  const { token, env } = resolveAuthContext({
    env: globalOpts.env,
    token: globalOpts.token,
  });
  return { env, token };
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerBrandCommands(program: Command): void {
  const brand = program
    .command('brand')
    .description('品牌管理');

  // -------------------------------------------------------------------------
  // brand list
  // -------------------------------------------------------------------------
  brand
    .command('list')
    .description('查询品牌列表（支持筛选）')
    .addHelpText('after', `
枚举值：
  --brand-score（品牌调性分）：A / B / C / D
  --channel-type（来源渠道）：1 / 2 / 3
  --enable（启用状态）：0 = 禁用, 1 = 启用
  --has-story（品牌故事）：0 = 无, 1 = 有

示例：
  $ cashop-console brand list
  $ cashop-console brand list --brand-name Nike --brand-score A
  $ cashop-console brand list --has-story 1 --json
`)
    .option('--brand-name <name>', '品牌名称（模糊搜索）')
    .option('--brand-score <score>', '品牌调性分 (A/B/C/D)')
    .option('--channel-type <type>', '来源渠道 (1/2/3)')
    .option('--enable <0|1>', '启用状态')
    .option('--has-story <0|1>', '是否有品牌故事')
    .option('--page <number>', '页码，从 1 开始（默认 1）', '1')
    .option('--page-size <number>', '每页条数（默认 20）', '20')
    .action(
      async (
        options: {
          brandName?: string;
          brandScore?: string;
          channelType?: string;
          enable?: string;
          hasStory?: string;
          page?: string;
          pageSize?: string;
        },
        cmd: Command,
      ) => {
        const globalOpts = getGlobalOpts(cmd);
        const ctx = makeCtx(globalOpts);

        const result = await listBrands(ctx, {
          brandName: options.brandName,
          brandScore: options.brandScore,
          channelType: options.channelType ? parseInt(options.channelType, 10) : undefined,
          enable: options.enable ? parseInt(options.enable, 10) : undefined,
          hasStory: options.hasStory ? parseInt(options.hasStory, 10) : undefined,
          pageIndex: options.page ? parseInt(options.page, 10) : 1,
          pageSize: options.pageSize ? parseInt(options.pageSize, 10) : 20,
        });

        if (globalOpts.json) {
          console.log(formatJson(result));
          return;
        }

        const items = result.data ?? [];
        const rows = items.map((item) => [
          item.brandId ?? '',
          item.brandName ?? '',
          item.brandScore != null ? String(item.brandScore) : '',
          item.enable !== undefined ? (item.enable === 1 ? '启用' : '禁用') : '',
          item.hasStory !== undefined ? (item.hasStory === 1 ? '有' : '无') : '',
          item.channelType !== undefined ? String(item.channelType) : '',
          item.createdTime ?? '',
        ]);

        console.log(
          formatTable(
            ['brandId', 'brandName', 'brandScore', 'enable', 'hasStory', 'channelType', 'createdTime'],
            rows,
            {
              pageInfo: {
                page: result.pageIndex,
                pages: result.pages,
                total: result.total,
              },
            },
          ),
        );
      },
    );

  // -------------------------------------------------------------------------
  // brand detail <brandId>
  // -------------------------------------------------------------------------
  brand
    .command('detail <brandId>')
    .description('查看品牌详情')
    .addHelpText('after', `
示例：
  $ cashop-console brand detail 12345
  $ cashop-console brand detail 12345 --json
`)
    .action(async (brandId: string, _options: Record<string, unknown>, cmd: Command) => {
      const globalOpts = getGlobalOpts(cmd);
      const ctx = makeCtx(globalOpts);

      const result = await getBrandDetail(ctx, brandId);

      if (globalOpts.json) {
        console.log(formatJson(result));
        return;
      }

      const detail = result as Record<string, unknown>;
      for (const [key, value] of Object.entries(detail)) {
        const displayValue =
          typeof value === 'object' && value !== null
            ? JSON.stringify(value, null, 2)
            : String(value ?? '');
        console.log(`  ${chalk.cyan(key.padEnd(25))} ${displayValue}`);
      }
    });

  // -------------------------------------------------------------------------
  // brand languages
  // -------------------------------------------------------------------------
  brand
    .command('languages')
    .description('查看支持的语言列表')
    .addHelpText('after', `
示例：
  $ cashop-console brand languages
  $ cashop-console brand languages --json
`)
    .action(async (_options: Record<string, unknown>, cmd: Command) => {
      const globalOpts = getGlobalOpts(cmd);
      const ctx = makeCtx(globalOpts);

      const result = await getSupportedLanguages(ctx) ?? [];

      if (globalOpts.json) {
        console.log(formatJson(result));
        return;
      }

      const rows = result.map((item) => [
        String(item.code ?? ''),
        String(item.name ?? ''),
      ]);

      console.log(formatTable(['code', 'name'], rows));
    });

  // =========================================================================
  // brand story 子命令组
  // =========================================================================
  const story = brand
    .command('story')
    .description('品牌故事管理');

  // -------------------------------------------------------------------------
  // brand story list <brandId>
  // -------------------------------------------------------------------------
  story
    .command('list <brandId>')
    .description('查询品牌故事列表')
    .addHelpText('after', `
示例：
  $ cashop-console brand story list 12345
  $ cashop-console brand story list 12345 --language zh --json
`)
    .option('--language <code>', '语言编码')
    .option('--page <number>', '页码，从 1 开始（默认 1）', '1')
    .option('--page-size <number>', '每页条数（默认 20）', '20')
    .action(
      async (
        brandId: string,
        options: {
          language?: string;
          page?: string;
          pageSize?: string;
        },
        cmd: Command,
      ) => {
        const globalOpts = getGlobalOpts(cmd);
        const ctx = makeCtx(globalOpts);

        const result = await listBrandStories(ctx, {
          brandId,
          language: options.language,
          pageIndex: options.page ? parseInt(options.page, 10) : 1,
          pageSize: options.pageSize ? parseInt(options.pageSize, 10) : 20,
        });

        if (globalOpts.json) {
          console.log(formatJson(result));
          return;
        }

        const items = result.data ?? [];
        const rows = items.map((item) => [
          item.id,
          item.brandId,
          item.language,
          item.languageName,
          item.localName ?? '',
          item.updateTime ?? '',
        ]);

        console.log(
          formatTable(
            ['id', 'brandId', 'language', 'languageName', 'localName', 'updateTime'],
            rows,
            {
              pageInfo: {
                page: result.pageIndex,
                pages: result.pages,
                total: result.total,
              },
            },
          ),
        );
      },
    );

  // -------------------------------------------------------------------------
  // brand story detail <brandStoryId>
  // -------------------------------------------------------------------------
  story
    .command('detail <brandStoryId>')
    .description('查看品牌故事详情')
    .addHelpText('after', `
示例：
  $ cashop-console brand story detail 12345
  $ cashop-console brand story detail 12345 --json
`)
    .action(async (brandStoryId: string, _options: Record<string, unknown>, cmd: Command) => {
      const globalOpts = getGlobalOpts(cmd);
      const ctx = makeCtx(globalOpts);

      const result = await getBrandStoryDetail(ctx, brandStoryId);

      if (globalOpts.json) {
        console.log(formatJson(result));
        return;
      }

      const detail = result as Record<string, unknown>;
      for (const [key, value] of Object.entries(detail)) {
        const displayValue =
          typeof value === 'object' && value !== null
            ? JSON.stringify(value, null, 2)
            : String(value ?? '');
        console.log(`  ${chalk.cyan(key.padEnd(25))} ${displayValue}`);
      }
    });

  // -------------------------------------------------------------------------
  // brand story save
  // -------------------------------------------------------------------------
  story
    .command('save')
    .description('创建品牌故事（通过 JSON 文件）')
    .addHelpText('after', `
必填参数：
  --data-file    JSON 文件路径

JSON 字段说明：
  brandId        [必填] 品牌 ID
  language       [必填] 语言编码（通过 brand languages 查看可用语言）
  localName      [可选] 品牌本地名称
  phoneticName   [可选] 品牌音译名称
  establishYear  [可选] 成立年份
  headquarters   [可选] 总部所在地
  annualRevenue  [可选] 年营收
  mainCategories [可选] 主营品类
  mainProducts   [可选] 主要产品
  coreConcept    [可选] 核心理念
  brandSlogan    [可选] 品牌标语
  brandPosition  [可选] 品牌定位
  coreMarket     [可选] 核心市场
  milestones     [可选] 里程碑
  brandTagline   [可选] 品牌宣传语
  brandIntro     [可选] 品牌简介
  brandImageUrl  [可选] 品牌图片 URL
  brandVideoUrl  [可选] 品牌视频 URL
  awardsList     [可选] 获奖列表

示例：
  $ cashop-console brand story save --data-file story.json
`)
    .requiredOption('--data-file <path>', '[必填] JSON 文件路径')
    .action(async (options: { dataFile: string }, cmd: Command) => {
      const globalOpts = getGlobalOpts(cmd);
      const ctx = makeCtx(globalOpts);

      const raw = readFileSync(options.dataFile, 'utf-8');
      const payload = JSON.parse(raw) as Parameters<typeof saveBrandStory>[1];

      const result = await saveBrandStory(ctx, payload);

      if (globalOpts.json) {
        console.log(formatJson(result));
      } else {
        console.log(chalk.green('✓ 品牌故事创建成功'));
      }
    });

  // -------------------------------------------------------------------------
  // brand story update
  // -------------------------------------------------------------------------
  story
    .command('update')
    .description('更新品牌故事（通过 JSON 文件）')
    .addHelpText('after', `
必填参数：
  --data-file    JSON 文件路径（JSON 中必须包含 id 字段）

示例：
  $ cashop-console brand story update --data-file story.json
`)
    .requiredOption('--data-file <path>', '[必填] JSON 文件路径')
    .action(async (options: { dataFile: string }, cmd: Command) => {
      const globalOpts = getGlobalOpts(cmd);
      const ctx = makeCtx(globalOpts);

      const raw = readFileSync(options.dataFile, 'utf-8');
      const payload = JSON.parse(raw) as Parameters<typeof updateBrandStory>[1];

      if (!payload.id) {
        console.error(chalk.red('错误：JSON 数据中缺少 id 字段'));
        process.exit(1);
      }

      const result = await updateBrandStory(ctx, payload);

      if (globalOpts.json) {
        console.log(formatJson(result));
      } else {
        console.log(chalk.green(`✓ 品牌故事 ${payload.id} 更新成功`));
      }
    });
}
