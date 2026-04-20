# sales-product - 销售商品管理

所有 `sales-product` 命令需要 `--site` 参数。

## 商品列表

```bash
cashop-console sales-product list --site JP
cashop-console sales-product list --site JP --status ONLINE --page-size 5
cashop-console sales-product list --site JP --brand-ids B001 B002
cashop-console sales-product list --site JP --product-name "手袋" --json
```

筛选选项：

| 选项 | 说明 |
|------|------|
| `--page <n>` | 页码（默认 1） |
| `--page-size <n>` | 每页条数（默认 20） |
| `--brand-ids <ids...>` | 按品牌 ID 筛选 |
| `--category-codes <codes...>` | 按分类代码筛选 |
| `--status <ONLINE\|OFFLINE>` | 按上下架状态筛选 |
| `--product-name <name>` | 按商品名模糊搜索 |
| `--mer-style-nos <nos>` | 按商户货号筛选 |
| `--product-nums <nums>` | 按商品编号筛选 |
| `--is-banned <true\|false>` | 筛选封禁/未封禁商品 |
| `--min-price <n>` | 最低价格 |
| `--max-price <n>` | 最高价格 |
| `--min-promotion-fee-rate <n>` | 最低推广费率 |
| `--max-promotion-fee-rate <n>` | 最高推广费率 |

## 商品详情

```bash
cashop-console sales-product detail <itemCode> --site JP
cashop-console sales-product detail <itemCode> --site JP --json
```

## SKU 价格详情

```bash
cashop-console sales-product price <itemCode> --site JP
```

输出 SKU 级别的价格信息，包含 basePrice、promotionFeeRate 等。

## SKU 库存查询

```bash
cashop-console sales-product stock <itemCode> --site JP
```

## 批量上下架

```bash
# 上架
cashop-console sales-product update-status --item-codes ITEM001 ITEM002 --status ONLINE --site JP

# 下架（需要 --reason）
cashop-console sales-product update-status --item-codes ITEM001 --status OFFLINE --reason "缺货" --site JP
```

## 更新 SKU 推广费率

```bash
# 内联 JSON
cashop-console sales-product update-price --item-code ITEM001 --site JP \
  --sku-prices '[{"skuCode":"SKU001","promotionFeeRate":15}]'

# 从文件读取
cashop-console sales-product update-price --item-code ITEM001 --site JP --data-file prices.json
```

`prices.json` 格式：

```json
[
  { "skuCode": "SKU001", "promotionFeeRate": 15 },
  { "skuCode": "SKU002", "promotionFeeRate": 20 }
]
```

## 清除手动定价

```bash
cashop-console sales-product clear-pricing --item-code ITEM001 --site JP
```

自动处理两步确认流程（BEC001 重试）。

## 计算推广费后价格

```bash
cashop-console sales-product calc-price --sku-codes SKU001 SKU002 --promotion-fee-rate 15 --site JP
```
