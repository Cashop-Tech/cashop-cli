import { readFileSync } from 'node:fs';
import { Command, Option } from 'commander';
import chalk from 'chalk';
import { DEFAULT_ENVIRONMENT, type EnvironmentName } from '../../core/environments.js';
import { formatJson, formatTable } from '../../core/output.js';
import {
  listSalesProducts,
  getSalesProductDetail,
  getSalesProductPrice,
  getSalesProductStock,
  updateSaleStatus,
  updatePrices,
  clearManualPricing,
  calculatePromotionFeePrice,
  getSiteAllConfig,
  type SaleStatus,
} from '../../api/sales-product.js';
import type { ApiContext } from '../../api/sales-product.js';

// ---------------------------------------------------------------------------
// Global options helper
// ---------------------------------------------------------------------------

interface GlobalOpts {
  env: EnvironmentName;
  json: boolean;
  site: string;
}

function getGlobalOpts(cmd: Command): GlobalOpts {
  const opts = cmd.optsWithGlobals<{
    env?: string;
    json?: boolean;
    site?: string;
  }>();

  if (!opts.site) {
    console.error(chalk.red('错误：--site 为必填项'));
    process.exit(1);
  }

  return {
    env: (opts.env ?? DEFAULT_ENVIRONMENT) as EnvironmentName,
    json: !!opts.json,
    site: opts.site,
  };
}

function makeCtx(globalOpts: GlobalOpts): ApiContext {
  return { env: globalOpts.env };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerSalesProductCommands(program: Command): void {
  const sp = program
    .command('sales-product')
    .description('销售商品管理（所有子命令需要全局参数 --site）');

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------
  sp.command('list')
    .description('查询销售商品列表（支持分页和筛选）')
    .option('--page <number>', '页码，从 1 开始（默认 1）', '1')
    .option('--page-size <number>', '每页条数（默认 20）', '20')
    .option('--brand-ids <ids...>', '按品牌 ID 筛选（空格分隔）')
    .option('--category-codes <codes...>', '按分类编码筛选（空格分隔）')
    .addOption(
      new Option('--status <status>', '按上下架状态筛选')
        .choices(['ONLINE', 'OFFLINE']),
    )
    .option('--product-name <name>', '按商品名称模糊搜索')
    .option('--mer-style-nos <nos>', '商家款号（逗号分隔）')
    .option('--product-nums <nums>', '商品编号（逗号分隔）')
    .addOption(
      new Option('--is-banned <bool>', '筛选是否被禁用的商品')
        .choices(['true', 'false']),
    )
    .option('--min-price <price>', '最低价格筛选')
    .option('--max-price <price>', '最高价格筛选')
    .option('--min-promotion-fee-rate <rate>', '最低推广费率筛选')
    .option('--max-promotion-fee-rate <rate>', '最高推广费率筛选')
    .addHelpText('after', `
枚举值：
  --status：
    ONLINE    已上架
    OFFLINE   已下架

  --is-banned：
    true    已禁用
    false   未禁用

示例：
  $ cashop-console sales-product list --site JP
  $ cashop-console sales-product list --site JP --status ONLINE --page-size 50
  $ cashop-console sales-product list --site JP --product-name "Nike" --json
`)
    .action(
      async (
        options: {
          page?: string;
          pageSize?: string;
          brandIds?: string[];
          categoryCodes?: string[];
          status?: string;
          productName?: string;
          merStyleNos?: string;
          productNums?: string;
          isBanned?: string;
          minPrice?: string;
          maxPrice?: string;
          minPromotionFeeRate?: string;
          maxPromotionFeeRate?: string;
        },
        cmd: Command,
      ) => {
        const globalOpts = getGlobalOpts(cmd);
        const ctx = makeCtx(globalOpts);

        const result = await listSalesProducts(ctx, {
          siteId: globalOpts.site,
          pageIndex: options.page ? parseInt(options.page, 10) : 1,
          pageSize: options.pageSize ? parseInt(options.pageSize, 10) : 20,
          brandIds: options.brandIds,
          categoryCodes: options.categoryCodes,
          status: options.status as SaleStatus | undefined,
          productName: options.productName,
          merStyleNos: options.merStyleNos,
          productNums: options.productNums,
          isBanned:
            options.isBanned !== undefined
              ? options.isBanned === 'true'
              : undefined,
          minPrice: options.minPrice ? parseFloat(options.minPrice) : undefined,
          maxPrice: options.maxPrice ? parseFloat(options.maxPrice) : undefined,
          minPromotionFeeRate: options.minPromotionFeeRate
            ? parseFloat(options.minPromotionFeeRate)
            : undefined,
          maxPromotionFeeRate: options.maxPromotionFeeRate
            ? parseFloat(options.maxPromotionFeeRate)
            : undefined,
        });

        if (globalOpts.json) {
          console.log(formatJson(result));
          return;
        }

        const items = result.data ?? [];
        const rows = items.map((item) => [
          item.itemCode,
          item.productName,
          item.brandName ?? '',
          item.price !== undefined ? String(item.price) : '',
          '',
          item.status,
        ]);

        console.log(
          formatTable(
            ['itemCode', 'productName', 'brandName', 'priceRange', 'stockQuantity', 'saleStatus'],
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
  // detail <itemCode>
  // -------------------------------------------------------------------------
  sp.command('detail <itemCode>')
    .description('查看商品详情')
    .option('--language <code>', '语言编码', 'zh')
    .option('--currency <code>', '币种')
    .addHelpText('after', `
示例：
  $ cashop-console sales-product detail ITEM001 --site JP
  $ cashop-console sales-product detail ITEM001 --site JP --language en --currency JPY
  $ cashop-console sales-product detail ITEM001 --site JP --json
`)
    .action(async (itemCode: string, options: { language?: string; currency?: string }, cmd: Command) => {
      const globalOpts = getGlobalOpts(cmd);
      const ctx = makeCtx(globalOpts);

      const siteConfig = await getSiteAllConfig(ctx, globalOpts.site);
      const defaultCurrency = siteConfig.siteRates?.[0]?.currency ?? 'USD';

      const result = await getSalesProductDetail(ctx, {
        itemCode,
        siteId: globalOpts.site,
        languageCode: options.language ?? siteConfig.defaultLanguage ?? 'zh',
        currencyType: options.currency ?? defaultCurrency,
      });

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
        console.log(`  ${chalk.cyan(key.padEnd(24))} ${displayValue}`);
      }
    });

  // -------------------------------------------------------------------------
  // price <itemCode>
  // -------------------------------------------------------------------------
  sp.command('price <itemCode>')
    .description('查看 SKU 级价格详情')
    .addHelpText('after', `
示例：
  $ cashop-console sales-product price ITEM001 --site JP
  $ cashop-console sales-product price ITEM001 --site JP --json
`)
    .action(async (itemCode: string, _options: Record<string, unknown>, cmd: Command) => {
      const globalOpts = getGlobalOpts(cmd);
      const ctx = makeCtx(globalOpts);

      const result = await getSalesProductPrice(ctx, {
        itemCode,
        siteId: globalOpts.site,
      });

      if (globalOpts.json) {
        console.log(formatJson(result));
        return;
      }

      const detail = result;
      const skuList = detail.skuPriceInfoList ?? [];
      const rows = skuList.map((sku) => [
        sku.skuCode,
        sku.price !== undefined ? String(sku.price) : '',
        '',
        sku.promotionFeeRate !== undefined ? String(sku.promotionFeeRate) : '',
        '',
        '',
      ]);

      console.log(
        formatTable(
          ['skuCode', 'basePrice', 'memberPrice', 'promotionFeeRate', 'retailProfit', 'settlePrice'],
          rows,
        ),
      );
    });

  // -------------------------------------------------------------------------
  // stock <itemCode>
  // -------------------------------------------------------------------------
  sp.command('stock <itemCode>')
    .description('查看 SKU 级库存')
    .addHelpText('after', `
示例：
  $ cashop-console sales-product stock ITEM001 --site JP
  $ cashop-console sales-product stock ITEM001 --site JP --json
`)
    .action(async (itemCode: string, _options: Record<string, unknown>, cmd: Command) => {
      const globalOpts = getGlobalOpts(cmd);
      const ctx = makeCtx(globalOpts);

      const result = await getSalesProductStock(ctx, {
        itemCode,
        siteId: globalOpts.site,
      });

      if (globalOpts.json) {
        console.log(formatJson(result));
        return;
      }

      const detail = result;
      const skuList = detail.skuStockList ?? [];
      const rows = skuList.map((sku) => {
        const props = Object.entries(sku)
          .filter(([k]) => k !== 'skuCode' && k !== 'stock')
          .map(([k, v]) => `${k}:${String(v)}`)
          .join(', ');
        return [sku.skuCode, String(sku.stock), props];
      });

      console.log(
        formatTable(['skuCode', 'availableStock', 'properties'], rows),
      );
    });

  // -------------------------------------------------------------------------
  // update-status
  // -------------------------------------------------------------------------
  sp.command('update-status')
    .description('批量修改商品上下架状态')
    .addHelpText('after', `
必填参数：
  --item-codes   商品编码（空格分隔，可多个）
  --status       目标状态

枚举值：
  --status：
    ONLINE    上架
    OFFLINE   下架

  --reason（下架时必填）：
    下架原因说明，如 "缺货"、"SITE_MANUAL_OFF_LINE"

示例：
  $ cashop-console sales-product update-status --site JP --item-codes ITEM001 ITEM002 --status ONLINE
  $ cashop-console sales-product update-status --site JP --item-codes ITEM001 --status OFFLINE --reason "缺货"
`)
    .requiredOption('--item-codes <codes...>', '[必填] 商品编码（空格分隔）')
    .addOption(
      new Option('--status <status>', '[必填] 目标状态')
        .choices(['ONLINE', 'OFFLINE'])
        .makeOptionMandatory(),
    )
    .option('--reason <reason>', '下架原因（status 为 OFFLINE 时必填）')
    .action(
      async (
        options: { itemCodes: string[]; status: string; reason?: string },
        cmd: Command,
      ) => {
        const globalOpts = getGlobalOpts(cmd);

        if (options.status === 'OFFLINE' && !options.reason) {
          console.error(chalk.red('错误：status 为 OFFLINE 时 --reason 为必填项'));
          process.exit(1);
        }

        const ctx = makeCtx(globalOpts);
        await updateSaleStatus(ctx, {
          siteId: globalOpts.site,
          itemCodes: options.itemCodes,
          saleStatus: options.status as SaleStatus,
          reason: options.reason,
        });

        if (globalOpts.json) {
          console.log(formatJson({ success: true }));
        } else {
          console.log(
            chalk.green(
              `✓ 已将 ${options.itemCodes.length} 个商品更新为 ${options.status}`,
            ),
          );
        }
      },
    );

  // -------------------------------------------------------------------------
  // update-price
  // -------------------------------------------------------------------------
  sp.command('update-price')
    .description('更新商品 SKU 级推广费率')
    .addHelpText('after', `
必填参数：
  --item-code    商品编码
  --sku-prices   或 --data-file（二选一必填）

JSON 格式（--sku-prices / --data-file）：
  [{"skuCode": "SKU001", "promotionFeeRate": 15}, ...]
  promotionFeeRate 范围：0-100，最多 2 位小数

示例：
  $ cashop-console sales-product update-price --site JP --item-code ITEM001 \\
      --sku-prices '[{"skuCode":"SKU001","promotionFeeRate":15}]'
  $ cashop-console sales-product update-price --site JP --item-code ITEM001 --data-file prices.json
`)
    .requiredOption('--item-code <code>', '[必填] 商品编码')
    .option('--sku-prices <json>', 'JSON 数组：[{"skuCode":"...","promotionFeeRate":N}]')
    .option('--data-file <path>', 'JSON 文件路径（格式同 --sku-prices）')
    .action(
      async (
        options: { itemCode: string; skuPrices?: string; dataFile?: string },
        cmd: Command,
      ) => {
        const globalOpts = getGlobalOpts(cmd);

        if (!options.skuPrices && !options.dataFile) {
          console.error(
            chalk.red('错误：--sku-prices 和 --data-file 必须提供其一'),
          );
          process.exit(1);
        }

        let skuPriceInfoList: Array<{ skuCode: string; promotionFeeRate: number }>;

        if (options.dataFile) {
          const raw = readFileSync(options.dataFile, 'utf-8');
          skuPriceInfoList = JSON.parse(raw) as typeof skuPriceInfoList;
        } else {
          skuPriceInfoList = JSON.parse(options.skuPrices!) as typeof skuPriceInfoList;
        }

        const ctx = makeCtx(globalOpts);
        await updatePrices(ctx, {
          itemCode: options.itemCode,
          siteId: globalOpts.site,
          skuPriceInfoList,
        });

        if (globalOpts.json) {
          console.log(formatJson({ success: true }));
        } else {
          console.log(chalk.green(`✓ 已更新 ${options.itemCode} 的价格`));
        }
      },
    );

  // -------------------------------------------------------------------------
  // clear-pricing
  // -------------------------------------------------------------------------
  sp.command('clear-pricing')
    .description('清除手动定价，恢复为自动定价（自动确认）')
    .addHelpText('after', `
必填参数：
  --item-code    商品编码

说明：
  此操作会自动处理二次确认流程（服务端返回 BEC001 时自动重试 confirm=true）

示例：
  $ cashop-console sales-product clear-pricing --site JP --item-code ITEM001
`)
    .requiredOption('--item-code <code>', '[必填] 商品编码')
    .action(async (options: { itemCode: string }, cmd: Command) => {
      const globalOpts = getGlobalOpts(cmd);
      const ctx = makeCtx(globalOpts);

      try {
        await clearManualPricing(ctx, {
          itemCode: options.itemCode,
          siteId: globalOpts.site,
          confirm: false,
        });
      } catch (err: unknown) {
        // If the server returns BEC001 we must retry with confirm=true
        const apiErr = err as { code?: string };
        if (apiErr.code === 'BEC001') {
          await clearManualPricing(ctx, {
            itemCode: options.itemCode,
            siteId: globalOpts.site,
            confirm: true,
          });
        } else {
          throw err;
        }
      }

      if (globalOpts.json) {
        console.log(formatJson({ success: true }));
      } else {
        console.log(chalk.green(`✓ 已清除 ${options.itemCode} 的手动定价`));
      }
    });

  // -------------------------------------------------------------------------
  // calc-price
  // -------------------------------------------------------------------------
  sp.command('calc-price')
    .description('根据推广费率计算 SKU 价格')
    .addHelpText('after', `
必填参数：
  --sku-codes           SKU 编码（空格分隔，可多个）
  --promotion-fee-rate  推广费率，范围 0-100，最多 2 位小数

示例：
  $ cashop-console sales-product calc-price --site JP \\
      --sku-codes SKU001 SKU002 --promotion-fee-rate 15
`)
    .requiredOption('--sku-codes <codes...>', '[必填] SKU 编码（空格分隔）')
    .requiredOption('--promotion-fee-rate <rate>', '[必填] 推广费率（0-100，最多 2 位小数）')
    .action(
      async (
        options: { skuCodes: string[]; promotionFeeRate: string },
        cmd: Command,
      ) => {
        const globalOpts = getGlobalOpts(cmd);
        const ctx = makeCtx(globalOpts);

        const result = await calculatePromotionFeePrice(ctx, {
          skuCodeList: options.skuCodes,
          siteId: globalOpts.site,
          promotionFeeRate: parseFloat(options.promotionFeeRate),
        });

        if (globalOpts.json) {
          console.log(formatJson(result));
          return;
        }

        const items = result ?? [];
        const rows = items.map((item) => [
          item.skuCode,
          item.price !== undefined ? String(item.price) : '',
          item.promotionFeePrice !== undefined ? String(item.promotionFeePrice) : '',
        ]);

        console.log(
          formatTable(['skuCode', 'price', 'promotionFeePrice'], rows),
        );
      },
    );
}
