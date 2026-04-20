import { readFileSync } from 'node:fs';
import { Command, Option } from 'commander';
import chalk from 'chalk';
import { resolveAuthContext } from '../../core/auth.js';
import { DEFAULT_ENVIRONMENT, type EnvironmentName } from '../../core/environments.js';
import { formatJson, formatTable } from '../../core/output.js';
import {
  listResources,
  getResourceDetail,
  saveOrUpdateResource,
  effectResource,
  loseEffectResource,
  deleteResource,
  sortResource,
  getComponentTypeTree,
  heroBannerListImages,
  heroBannerAddImage,
  heroBannerRemoveImage,
  heroBannerUpdateImage,
  createHeroBanner,
  type HeroBannerImage,
  type HeroBannerOverlay,
  type HeroBannerContent,
  type ComponentTypeNode,
} from '../../api/resource.js';
import type { ApiContext } from '../../api/resource.js';

// ---------------------------------------------------------------------------
// Global options helper (no --site requirement for resource commands)
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
// Status label helper
// ---------------------------------------------------------------------------

function statusLabel(status: number | undefined): string {
  switch (status) {
    case 1:
      return '待生效';
    case 2:
      return '生效中';
    case 3:
      return '已失效';
    default:
      return status !== undefined ? String(status) : '';
  }
}

// ---------------------------------------------------------------------------
// Auto-fetch version helper
// ---------------------------------------------------------------------------

async function fetchVersion(ctx: ApiContext, id: string): Promise<number> {
  const detail = await getResourceDetail(ctx, { id });
  const version = detail.version as number | undefined;
  if (version === undefined) {
    throw new Error(`无法获取资源 id=${id} 的版本号`);
  }
  return version;
}

// ---------------------------------------------------------------------------
// Component tree rendering
// ---------------------------------------------------------------------------

function printComponentTree(nodes: ComponentTypeNode[], indent = 0): void {
  for (const node of nodes) {
    const prefix = '  '.repeat(indent);
    const type = node.type ?? node.optionType ?? '';
    const label = node.label ?? node.optionName ?? '';
    console.log(`${prefix}${chalk.cyan(type)} ${chalk.dim(label)}`);
    // API returns children under various field names
    const children = node.children
      ?? node.componentLocationTreeVOS
      ?? node.componentTypeTreeVOList
      ?? node.componentTypeTreeVOS;
    if (Array.isArray(children) && children.length > 0) {
      printComponentTree(children as ComponentTypeNode[], indent + 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Hero Banner image builder
// ---------------------------------------------------------------------------

type SkipTypeNumeric = 1 | 2 | 3 | 4 | 5;

interface AddImageOptions {
  imgUrl?: string;
  themeColor?: string;
  placeholderColor?: string;
  width?: string;
  height?: string;
  imgI18n?: string;
  skipToProduct?: boolean;
  itemCode?: string;
  skipToBrand?: boolean;
  brandId?: string;
  skipToUrl?: boolean;
  url?: string;
  skipToCategory?: boolean;
  categoryId?: string;
  skipToLink?: boolean;
  customLink?: string;
  overlayConfig?: string;
  overlayConfigFile?: string;
  noOverlay?: boolean;
  startTime?: string;
  endTime?: string;
  supportClick?: string;
  showChannel?: string;
  showThrong?: string;
  showThrongValue?: string;
}

function buildImageFromOptions(
  options: AddImageOptions,
  base: Partial<HeroBannerImage> = {},
): HeroBannerImage {
  // Determine skipType — options are mutually exclusive
  const skipFlags: Array<[boolean | undefined, SkipTypeNumeric, string]> = [
    [options.skipToProduct, 1, '--skip-to-product'],
    [options.skipToBrand, 2, '--skip-to-brand'],
    [options.skipToCategory, 3, '--skip-to-category'],
    [options.skipToUrl, 4, '--skip-to-url'],
    [options.skipToLink, 5, '--skip-to-link'],
  ];
  const activeFlags = skipFlags.filter(([flag]) => flag);
  if (activeFlags.length > 1) {
    const flagNames = activeFlags.map(([, , name]) => name).join(', ');
    console.error(chalk.red(`错误：跳转类型互斥，不能同时使用：${flagNames}`));
    process.exit(1);
  }

  const skipType: SkipTypeNumeric | undefined =
    activeFlags.length === 1 ? activeFlags[0]![1] : undefined;

  // Resolve overlay
  let overlay: HeroBannerOverlay | undefined = base.overlay;
  if (options.noOverlay) {
    overlay = undefined;
  } else if (options.overlayConfigFile) {
    const raw = readFileSync(options.overlayConfigFile, 'utf-8');
    overlay = JSON.parse(raw) as HeroBannerOverlay;
  } else if (options.overlayConfig) {
    overlay = JSON.parse(options.overlayConfig) as HeroBannerOverlay;
  }

  // Merge with base (for update-image, base is the existing image)
  const image: HeroBannerImage = {
    ...base,
    ...(options.imgUrl !== undefined ? { imgUrl: options.imgUrl } : {}),
    themeColor:
      (options.themeColor as '#000000' | '#FFFFFF' | undefined) ??
      (base.themeColor as '#000000' | '#FFFFFF'),
    ...(options.placeholderColor !== undefined
      ? { placeholderColor: options.placeholderColor }
      : {}),
    ...(options.width !== undefined ? { width: parseInt(options.width, 10) } : {}),
    ...(options.height !== undefined
      ? { height: parseInt(options.height, 10) }
      : {}),
    ...(options.imgI18n !== undefined
      ? { imgUrlI18n: options.imgI18n }
      : {}),
    ...(skipType !== undefined ? { skipType } : {}),
    ...(options.itemCode !== undefined ? { itemCode: options.itemCode } : {}),
    ...(options.brandId !== undefined ? { brandId: options.brandId } : {}),
    ...(options.url !== undefined ? { outAppUrl: options.url } : {}),
    ...(options.categoryId !== undefined
      ? { categoryId: options.categoryId }
      : {}),
    ...(options.customLink !== undefined
      ? { customLink: options.customLink }
      : {}),
    ...(overlay !== undefined || options.noOverlay
      ? { overlay: options.noOverlay ? undefined : overlay }
      : {}),
    ...(options.startTime !== undefined ? { startTime: options.startTime } : {}),
    ...(options.endTime !== undefined ? { endTime: options.endTime } : {}),
    ...(options.supportClick !== undefined
      ? { supportClick: parseInt(options.supportClick, 10) as 1 | 2 }
      : {}),
    ...(options.showChannel !== undefined ? { showChannel: options.showChannel } : {}),
    ...(options.showThrong !== undefined ? { showThrong: options.showThrong } : {}),
    ...(options.showThrongValue !== undefined ? { showThrongValue: options.showThrongValue } : {}),
  } as HeroBannerImage;

  return image;
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerResourceCommands(program: Command): void {
  const resource = program
    .command('resource')
    .description('CMS 资源位管理');

  // -------------------------------------------------------------------------
  // resource list
  // -------------------------------------------------------------------------
  resource
    .command('list')
    .description('查询资源位列表（支持筛选）')
    .addHelpText('after', `
枚举值：
  --type（资源类型）：
    insert_heroBanner        Hero Banner 轮播图
    insert_todayBuy          今日必买
    insert_navigation        导航栏
    insert_productWindow     商品橱窗
    insert_channelWindow     频道橱窗
    insert_categoryDiamond   分类金刚位
    insert_img_convention    图片通栏
    insert_banner_crosswise  横向 Banner

  --status（资源状态）：
    1   待生效
    2   生效中
    3   已失效

  --show-channel（展示渠道）：
    app   仅 App 展示
    h5    仅 H5 展示

示例：
  $ cashop-console resource list
  $ cashop-console resource list --type insert_heroBanner --status 2
  $ cashop-console resource list --show-channel app --json
`)
    .addOption(
      new Option('--type <type>', '资源类型')
        .choices([
          'insert_heroBanner',
          'insert_todayBuy',
          'insert_navigation',
          'insert_productWindow',
          'insert_channelWindow',
          'insert_categoryDiamond',
          'insert_img_convention',
          'insert_banner_crosswise',
        ]),
    )
    .addOption(
      new Option('--status <status>', '资源状态')
        .choices(['1', '2', '3']),
    )
    .addOption(
      new Option('--show-channel <channel>', '展示渠道')
        .choices(['app', 'h5']),
    )
    .option('--location <location>', '资源位插槽，如 home_all_resource')
    .option('--name <name>', '按名称筛选')
    .option('--page <number>', '页码，从 1 开始（默认 1）', '1')
    .option('--page-size <number>', '每页条数（默认 20）', '20')
    .action(
      async (
        options: {
          type?: string;
          location?: string;
          status?: string;
          showChannel?: string;
          name?: string;
          page?: string;
          pageSize?: string;
        },
        cmd: Command,
      ) => {
        const globalOpts = getGlobalOpts(cmd);
        const ctx = makeCtx(globalOpts);

        const result = await listResources(ctx, {
          type: options.type,
          location: options.location,
          statusList: options.status ? [parseInt(options.status, 10)] : undefined,
          showChannel: options.showChannel,
          name: options.name,
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
          item.name,
          item.type,
          statusLabel(item.status),
          item.showChannel ?? '',
          item.startTime ?? '',
          item.endTime ?? '',
          item.sortValue !== undefined ? String(item.sortValue) : '',
        ]);

        console.log(
          formatTable(
            ['id', 'name', 'type', 'status', 'showChannel', 'startTime', 'endTime', 'sortValue'],
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
  // resource detail <id>
  // -------------------------------------------------------------------------
  resource
    .command('detail <id>')
    .description('查看资源位详情')
    .addHelpText('after', `
示例：
  $ cashop-console resource detail 12345
  $ cashop-console resource detail 12345 --json
`)
    .action(async (id: string, _options: Record<string, unknown>, cmd: Command) => {
      const globalOpts = getGlobalOpts(cmd);
      const ctx = makeCtx(globalOpts);

      const result = await getResourceDetail(ctx, { id });

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
        console.log(`  ${chalk.cyan(key.padEnd(20))} ${displayValue}`);
      }
    });

  // -------------------------------------------------------------------------
  // resource save
  // -------------------------------------------------------------------------
  resource
    .command('save')
    .description('创建或更新 CMS 资源位（通过 JSON 文件）')
    .addHelpText('after', `
必填参数：
  --data-file    JSON 文件路径

JSON 字段说明：
  location       [必填] 资源位插槽，如 "home_all_resource"
  type           [必填] 资源类型（见下方枚举值）
  name           [必填] 显示名称（最多 20 个字符）
  showChannel    [必填] 展示渠道（见下方枚举值）
  showThrong     [必填] 展示人群（见下方枚举值）
  startTime      [必填] 生效开始时间（ISO 8601 格式）
  endTime        [必填] 生效结束时间（ISO 8601 格式，必须晚于 startTime）
  content        [必填] 内容 JSON 字符串
  id             [更新时必填] 资源位 ID（新建时不传）
  version        [更新时必填] 乐观锁版本号
  sortValue      [可选] 排序值
  showThrongValue [条件必填] showThrong="role" 时必填

枚举值：
  type（资源类型）：
    insert_heroBanner        Hero Banner 轮播图
    insert_todayBuy          今日必买
    insert_navigation        导航栏
    insert_productWindow     商品橱窗
    insert_channelWindow     频道橱窗
    insert_categoryDiamond   分类金刚位
    insert_img_convention    图片通栏
    insert_banner_crosswise  横向 Banner

  showChannel（展示渠道）：
    "app"       仅 App 展示
    "h5"        仅 H5 展示
    "app,h5"    App + H5 同时展示

  showThrong（展示人群）：
    "all"    所有用户可见
    "role"   按角色可见（需设置 showThrongValue）

  showThrongValue.userType（showThrong="role" 时）：
    "Seller"     卖家
    "VIP"        VIP 用户
    "Consumer"   普通消费者

示例：
  $ cashop-console resource save --data-file resource.json
`)
    .requiredOption('--data-file <path>', '[必填] JSON 文件路径')
    .action(async (options: { dataFile: string }, cmd: Command) => {
      const globalOpts = getGlobalOpts(cmd);
      const ctx = makeCtx(globalOpts);

      const raw = readFileSync(options.dataFile, 'utf-8');
      const payload = JSON.parse(raw) as Parameters<typeof saveOrUpdateResource>[1];

      const result = await saveOrUpdateResource(ctx, payload);

      if (globalOpts.json) {
        console.log(formatJson(result));
      } else {
        console.log(chalk.green('✓ 资源位保存成功'));
      }
    });

  // -------------------------------------------------------------------------
  // resource effect <id>
  // -------------------------------------------------------------------------
  resource
    .command('effect <id>')
    .description('发布资源位（自动获取版本号）')
    .addHelpText('after', `
示例：
  $ cashop-console resource effect 12345
`)
    .action(async (id: string, _options: Record<string, unknown>, cmd: Command) => {
      const globalOpts = getGlobalOpts(cmd);
      const ctx = makeCtx(globalOpts);

      const version = await fetchVersion(ctx, id);
      await effectResource(ctx, { id, version });

      if (globalOpts.json) {
        console.log(formatJson({ success: true }));
      } else {
        console.log(chalk.green(`✓ 资源位 ${id} 已发布`));
      }
    });

  // -------------------------------------------------------------------------
  // resource lose-effect <id>
  // -------------------------------------------------------------------------
  resource
    .command('lose-effect <id>')
    .description('使资源位失效（自动获取版本号）')
    .addHelpText('after', `
示例：
  $ cashop-console resource lose-effect 12345
`)
    .action(async (id: string, _options: Record<string, unknown>, cmd: Command) => {
      const globalOpts = getGlobalOpts(cmd);
      const ctx = makeCtx(globalOpts);

      const version = await fetchVersion(ctx, id);
      await loseEffectResource(ctx, { id, version });

      if (globalOpts.json) {
        console.log(formatJson({ success: true }));
      } else {
        console.log(chalk.green(`✓ 资源位 ${id} 已失效`));
      }
    });

  // -------------------------------------------------------------------------
  // resource delete <id>
  // -------------------------------------------------------------------------
  resource
    .command('delete <id>')
    .description('删除资源位（自动获取版本号）')
    .addHelpText('after', `
示例：
  $ cashop-console resource delete 12345
`)
    .action(async (id: string, _options: Record<string, unknown>, cmd: Command) => {
      const globalOpts = getGlobalOpts(cmd);
      const ctx = makeCtx(globalOpts);

      const version = await fetchVersion(ctx, id);
      await deleteResource(ctx, { id, version });

      if (globalOpts.json) {
        console.log(formatJson({ success: true }));
      } else {
        console.log(chalk.green(`✓ 资源位 ${id} 已删除`));
      }
    });

  // -------------------------------------------------------------------------
  // resource sort <id> <sortValue>
  // -------------------------------------------------------------------------
  resource
    .command('sort <id> <sortValue>')
    .description('设置资源位排序值')
    .addHelpText('after', `
示例：
  $ cashop-console resource sort 12345 5
`)
    .action(
      async (id: string, sortValueStr: string, _options: Record<string, unknown>, cmd: Command) => {
        const globalOpts = getGlobalOpts(cmd);
        const ctx = makeCtx(globalOpts);

        const version = await fetchVersion(ctx, id);
        const sortValue = parseInt(sortValueStr, 10);
        await sortResource(ctx, { id, version, sortValue });

        if (globalOpts.json) {
          console.log(formatJson({ success: true }));
        } else {
          console.log(chalk.green(`✓ 资源位 ${id} 排序值已设为 ${sortValue}`));
        }
      },
    );

  // -------------------------------------------------------------------------
  // resource component-tree
  // -------------------------------------------------------------------------
  resource
    .command('component-tree')
    .description('查看组件类型层级树')
    .action(async (_options: Record<string, unknown>, cmd: Command) => {
      const globalOpts = getGlobalOpts(cmd);
      const ctx = makeCtx(globalOpts);

      const result = await getComponentTypeTree(ctx);

      if (globalOpts.json) {
        console.log(formatJson(result));
        return;
      }

      printComponentTree(Array.isArray(result) ? result : []);
    });

  // =========================================================================
  // Hero Banner 子命令组
  // =========================================================================
  const heroBanner = resource
    .command('hero-banner')
    .description('Hero Banner 轮播图管理');

  // -------------------------------------------------------------------------
  // resource hero-banner create
  // -------------------------------------------------------------------------
  heroBanner
    .command('create')
    .description('创建 Hero Banner（智能默认值）')
    .addHelpText('after', `
智能默认值：
  location       固定为 "home_all_resource"
  type           固定为 "insert_heroBanner"
  showChannel    默认 "app,h5"
  showThrong     默认 "all"
  name           默认 "Hero Banner <startTime日期>"
  startTime      默认取已生效 Hero Banner 最晚结束时间 + 1 秒
  endTime        默认 startTime + 2 个月

必填参数：
  --content-file   内容 JSON 文件路径（HeroBannerContent 格式）

示例：
  $ cashop-console resource hero-banner create --content-file banner.json
  $ cashop-console resource hero-banner create --content-file banner.json --start-time "2027-02-01 00:00:00"
  $ cashop-console resource hero-banner create --content-file banner.json --name "春节活动" --show-channel app
`)
    .requiredOption('--content-file <path>', '[必填] HeroBannerContent JSON 文件路径')
    .option('--name <name>', '资源名称（默认自动生成）')
    .option('--show-channel <channel>', '展示渠道（默认 app,h5）')
    .option('--show-throng <throng>', '展示人群（默认 all）')
    .option('--start-time <time>', '生效开始时间（ISO 8601）')
    .option('--end-time <time>', '生效结束时间（ISO 8601）')
    .option('--sort-value <n>', '排序值')
    .action(
      async (
        options: {
          contentFile: string;
          name?: string;
          showChannel?: string;
          showThrong?: string;
          startTime?: string;
          endTime?: string;
          sortValue?: string;
        },
        cmd: Command,
      ) => {
        const globalOpts = getGlobalOpts(cmd);
        const ctx = makeCtx(globalOpts);

        const raw = readFileSync(options.contentFile, 'utf-8');
        const content = JSON.parse(raw) as HeroBannerContent;

        const result = await createHeroBanner(ctx, {
          name: options.name,
          showChannel: options.showChannel,
          showThrong: options.showThrong,
          startTime: options.startTime,
          endTime: options.endTime,
          content,
          sortValue: options.sortValue ? parseInt(options.sortValue, 10) : undefined,
        });

        if (globalOpts.json) {
          console.log(formatJson(result));
        } else {
          console.log(chalk.green(`✓ Hero Banner 创建成功，ID: ${result.id}`));
        }
      },
    );

  // -------------------------------------------------------------------------
  // resource hero-banner list-images <id>
  // -------------------------------------------------------------------------
  heroBanner
    .command('list-images <id>')
    .description('列出 Hero Banner 中的所有图片')
    .addHelpText('after', `
示例：
  $ cashop-console resource hero-banner list-images 12345
  $ cashop-console resource hero-banner list-images 12345 --json
`)
    .action(async (id: string, _options: Record<string, unknown>, cmd: Command) => {
      const globalOpts = getGlobalOpts(cmd);
      const ctx = makeCtx(globalOpts);

      const images = await heroBannerListImages(ctx, { id });

      if (globalOpts.json) {
        console.log(formatJson(images));
        return;
      }

      const now = new Date();
      const rows = images.map((img, i) => {
        const skipLabel =
          img.skipType === 1
            ? '商品'
            : img.skipType === 2
              ? '品牌'
              : img.skipType === 3
                ? '分类'
                : img.skipType === 4
                  ? '外链'
                  : img.skipType === 5
                    ? '自定义'
                    : '无';
        const overlayType = img.overlay ? img.overlay.type : '';
        const truncatedUrl =
          img.imgUrl.length > 50 ? img.imgUrl.slice(0, 47) + '...' : img.imgUrl;
        const expired = img.endTime && new Date(img.endTime) < now ? ' [已过期]' : '';
        const timeRange = img.startTime && img.endTime
          ? `${img.startTime.slice(0, 16)} ~ ${img.endTime.slice(0, 16)}${expired}`
          : '';
        const clickLabel = img.supportClick === 2 ? '不支持' : img.supportClick === 1 ? '支持' : '';
        const channel = img.showChannel ?? '';
        return [
          String(i),
          truncatedUrl,
          img.themeColor,
          skipLabel,
          overlayType,
          timeRange,
          clickLabel,
          channel,
        ];
      });

      console.log(
        formatTable(
          ['index', 'imgUrl', 'themeColor', '跳转类型', '浮层类型', '生效时间', '点击', '渠道'],
          rows,
        ),
      );
    });

  // -------------------------------------------------------------------------
  // resource hero-banner add-image <id>
  // -------------------------------------------------------------------------
  heroBanner
    .command('add-image <id>')
    .description('向 Hero Banner 追加一张图片')
    .addHelpText('after', `
必填参数：
  --img-url        图片 URL（先通过 "cashop-console upload <file>" 上传获取）
  --theme-color    状态栏主题色

枚举值：
  --theme-color（状态栏主题色）：
    "#000000"   深色状态栏（适用于浅色背景图）
    "#FFFFFF"   浅色状态栏（适用于深色背景图）

  跳转类型（通过 skip-to 参数指定，互斥只能选一个）：
    --skip-to-product   skipType=1  跳转商品详情（需要 --item-code）
    --skip-to-brand     skipType=2  跳转品牌页（需要 --brand-id）
    --skip-to-category  skipType=3  跳转分类页（需要 --category-id）
    --skip-to-url       skipType=4  跳转外部链接（需要 --url）
    --skip-to-link      skipType=5  自定义深度链接（需要 --custom-link）

  浮层配置 JSON 中的枚举值：
    overlayType：   1 = 文字浮层 (textOverlay)
                    2 = 图片浮层 (imageOverlay)
    buttonType：    1 = 文字按钮 (textButton)
                    2 = 图片按钮 (imageButton)
    buttonStyle：   1 = 气泡
                    2 = 箭头
                    3 = 下划线
    showButton：    0 = 隐藏按钮
                    1 = 显示按钮
    supportClick：  1 = 可点击
                    2 = 不可点击

浮层配置（互斥）：
  --overlay-config <json>       内联 JSON 浮层配置
  --overlay-config-file <path>  从文件读取浮层配置
  --no-overlay                  不使用浮层（默认）

示例：
  $ cashop-console resource hero-banner add-image 12345 \\
      --img-url "https://cdn.example.com/banner.jpg" --theme-color "#000000"
  $ cashop-console resource hero-banner add-image 12345 \\
      --img-url "https://cdn.example.com/banner.jpg" --theme-color "#FFFFFF" \\
      --skip-to-product --item-code ITEM001 --overlay-config-file overlay.json
`)
    .requiredOption('--img-url <url>', '[必填] 图片 URL')
    .addOption(
      new Option('--theme-color <color>', '[必填] 状态栏主题色')
        .choices(['#000000', '#FFFFFF'])
        .makeOptionMandatory(),
    )
    .option('--placeholder-color <color>', '兜底背景色')
    .option('--width <px>', '图片宽度（像素）')
    .option('--height <px>', '图片高度（像素）')
    .option('--img-i18n <json>', '多语言图片 URL（JSON 格式）')
    .option('--skip-to-product', '点击跳转到商品详情')
    .option('--item-code <code>', '商品编码（配合 --skip-to-product）')
    .option('--skip-to-brand', '点击跳转到品牌页')
    .option('--brand-id <id>', '品牌 ID（配合 --skip-to-brand）')
    .option('--skip-to-url', '点击跳转到外部链接')
    .option('--url <url>', '外部链接（配合 --skip-to-url）')
    .option('--skip-to-category', '点击跳转到分类页')
    .option('--category-id <id>', '分类 ID（配合 --skip-to-category）')
    .option('--skip-to-link', '点击跳转到自定义链接')
    .option('--custom-link <link>', '自定义链接（配合 --skip-to-link）')
    .option('--overlay-config <json>', '内联 JSON 浮层配置')
    .option('--overlay-config-file <path>', '浮层配置 JSON 文件路径')
    .option('--no-overlay', '不使用浮层')
    .option('--start-time <time>', '生效开始时间 (yyyy-MM-dd HH:mm:ss)')
    .option('--end-time <time>', '生效结束时间 (yyyy-MM-dd HH:mm:ss)')
    .option('--support-click <val>', '是否支持点击 1:支持 2:不支持')
    .option('--show-channel <val>', '展示渠道 (app,h5)')
    .option('--show-throng <val>', '定向展示 (all/role)')
    .option('--show-throng-value <val>', '定向展示值 (逗号分隔角色)')
    .action(
      async (
        id: string,
        options: AddImageOptions & { brandId?: string; categoryId?: string; customLink?: string },
        cmd: Command,
      ) => {
        const globalOpts = getGlobalOpts(cmd);
        const ctx = makeCtx(globalOpts);

        const image = buildImageFromOptions(options);

        await heroBannerAddImage(ctx, { id, image });

        if (globalOpts.json) {
          console.log(formatJson({ success: true }));
        } else {
          console.log(chalk.green(`✓ 已向 Hero Banner ${id} 添加图片`));
        }
      },
    );

  // -------------------------------------------------------------------------
  // resource hero-banner remove-image <id>
  // -------------------------------------------------------------------------
  heroBanner
    .command('remove-image <id>')
    .description('删除 Hero Banner 中指定位置的图片')
    .addHelpText('after', `
必填参数：
  --index    图片位置（从 0 开始，使用 list-images 查看索引）

示例：
  $ cashop-console resource hero-banner remove-image 12345 --index 2
`)
    .requiredOption('--index <n>', '[必填] 图片索引（从 0 开始，使用 list-images 查看）')
    .action(
      async (id: string, options: { index: string }, cmd: Command) => {
        const globalOpts = getGlobalOpts(cmd);
        const ctx = makeCtx(globalOpts);

        await heroBannerRemoveImage(ctx, { id, index: parseInt(options.index, 10) });

        if (globalOpts.json) {
          console.log(formatJson({ success: true }));
        } else {
          console.log(
            chalk.green(
              `✓ 已从 Hero Banner ${id} 删除第 ${options.index} 张图片`,
            ),
          );
        }
      },
    );

  // -------------------------------------------------------------------------
  // resource hero-banner update-image <id>
  // -------------------------------------------------------------------------
  heroBanner
    .command('update-image <id>')
    .description('更新 Hero Banner 中指定位置的图片（仅修改传入的字段）')
    .addHelpText('after', `
必填参数：
  --index    图片位置（从 0 开始，使用 list-images 查看索引）

其他参数均为可选，仅传入的字段会被更新，未传的保留原值。
跳转和浮层参数与 add-image 相同。

枚举值（同 add-image）：
  --theme-color：  "#000000" = 深色状态栏 | "#FFFFFF" = 浅色状态栏
  跳转类型：       --skip-to-product (1) | --skip-to-brand (2) | --skip-to-category (3) | --skip-to-url (4) | --skip-to-link (5)

示例：
  $ cashop-console resource hero-banner update-image 12345 --index 0 --theme-color "#FFFFFF"
  $ cashop-console resource hero-banner update-image 12345 --index 1 \\
      --img-url "https://cdn.example.com/new.jpg" --skip-to-brand --brand-id B001
`)
    .requiredOption('--index <n>', '[必填] 图片索引（从 0 开始）')
    .option('--img-url <url>', '图片 URL')
    .addOption(
      new Option('--theme-color <color>', '状态栏主题色')
        .choices(['#000000', '#FFFFFF']),
    )
    .option('--placeholder-color <color>', '兜底背景色')
    .option('--width <px>', '图片宽度（像素）')
    .option('--height <px>', '图片高度（像素）')
    .option('--img-i18n <json>', '多语言图片 URL（JSON 格式）')
    .option('--skip-to-product', '点击跳转到商品详情')
    .option('--item-code <code>', '商品编码（配合 --skip-to-product）')
    .option('--skip-to-brand', '点击跳转到品牌页')
    .option('--brand-id <id>', '品牌 ID（配合 --skip-to-brand）')
    .option('--skip-to-url', '点击跳转到外部链接')
    .option('--url <url>', '外部链接（配合 --skip-to-url）')
    .option('--skip-to-category', '点击跳转到分类页')
    .option('--category-id <id>', '分类 ID（配合 --skip-to-category）')
    .option('--skip-to-link', '点击跳转到自定义链接')
    .option('--custom-link <link>', '自定义链接（配合 --skip-to-link）')
    .option('--overlay-config <json>', '内联 JSON 浮层配置')
    .option('--overlay-config-file <path>', '浮层配置 JSON 文件路径')
    .option('--no-overlay', '移除浮层')
    .option('--start-time <time>', '生效开始时间 (yyyy-MM-dd HH:mm:ss)')
    .option('--end-time <time>', '生效结束时间 (yyyy-MM-dd HH:mm:ss)')
    .option('--support-click <val>', '是否支持点击 1:支持 2:不支持')
    .option('--show-channel <val>', '展示渠道 (app,h5)')
    .option('--show-throng <val>', '定向展示 (all/role)')
    .option('--show-throng-value <val>', '定向展示值 (逗号分隔角色)')
    .action(
      async (
        id: string,
        options: AddImageOptions & {
          index: string;
          brandId?: string;
          categoryId?: string;
          customLink?: string;
        },
        cmd: Command,
      ) => {
        const globalOpts = getGlobalOpts(cmd);
        const ctx = makeCtx(globalOpts);

        const index = parseInt(options.index, 10);

        // Fetch existing image to use as base for merging
        const images = await heroBannerListImages(ctx, { id });
        if (index < 0 || index >= images.length) {
          console.error(
            chalk.red(
              `错误：索引 ${index} 越界，图片列表长度为 ${images.length}`,
            ),
          );
          process.exit(1);
        }

        const existingImage = images[index]!;
        const updatedImage = buildImageFromOptions(options, existingImage);

        await heroBannerUpdateImage(ctx, { id, index, image: updatedImage });

        if (globalOpts.json) {
          console.log(formatJson({ success: true }));
        } else {
          console.log(
            chalk.green(
              `✓ 已更新 Hero Banner ${id} 第 ${index} 张图片`,
            ),
          );
        }
      },
    );
}
