# MCP Server 模式

供 AI Agent（如 OpenClaw）通过 MCP 协议调用，基于 stdio 传输。

## 启动

```bash
cashop-console mcp-server
```

通过环境变量配置认证：

```bash
CASHOP_ENV=prod CASHOP_TOKEN=<token> cashop-console mcp-server
```

## AI Agent 集成配置

```json
{
  "mcpServers": {
    "cashop-console": {
      "command": "node",
      "args": ["/path/to/cli/dist/cashop-console.js", "mcp-server"],
      "env": {
        "CASHOP_ENV": "prod",
        "CASHOP_TOKEN": "<your-token>"
      }
    }
  }
}
```

## MCP Tools 列表

共 22 个 Tools，分为四组：

### 销售商品（8 个）

| Tool | 说明 |
|------|------|
| `cashop-console_sales_product_list` | 销售商品列表（分页+筛选） |
| `cashop-console_sales_product_detail` | 商品详情 |
| `cashop-console_sales_product_price` | SKU 价格详情 |
| `cashop-console_sales_product_stock` | SKU 库存 |
| `cashop-console_sales_product_update_status` | 批量上下架 |
| `cashop-console_sales_product_update_price` | 更新推广费率 |
| `cashop-console_sales_product_clear_pricing` | 清除手动定价（自动处理二次确认） |
| `cashop-console_sales_product_calc_price` | 计算推广费后价格 |

### CMS 资源位（8 个）

| Tool | 说明 |
|------|------|
| `cashop-console_resource_list` | 资源位列表 |
| `cashop-console_resource_detail` | 资源位详情（content 自动解析） |
| `cashop-console_resource_save` | 创建/更新资源位 |
| `cashop-console_resource_effect` | 激活资源位 |
| `cashop-console_resource_lose_effect` | 失效资源位 |
| `cashop-console_resource_delete` | 删除资源位 |
| `cashop-console_resource_sort` | 设置排序值 |
| `cashop-console_resource_component_tree` | 组件类型树 |

### Hero Banner（4 个）

| Tool | 说明 |
|------|------|
| `cashop-console_resource_hero_banner_list_images` | 列出 Banner 图片 |
| `cashop-console_resource_hero_banner_add_image` | 添加图片（含跳转/浮层配置） |
| `cashop-console_resource_hero_banner_remove_image` | 按索引删除图片 |
| `cashop-console_resource_hero_banner_update_image` | 按索引更新图片（部分更新） |

### 文件上传（2 个）

| Tool | 说明 |
|------|------|
| `cashop-console_upload_file` | 上传本地文件到 R2，返回 CDN URL |
| `cashop-console_upload_presign` | 获取预签名上传 URL（适合外部上传） |

## 返回格式

所有 Tool 返回统一格式：

```json
{
  "content": [{ "type": "text", "text": "<json-string>" }]
}
```

错误时附带 `isError: true`：

```json
{
  "content": [{ "type": "text", "text": "{\"error\": \"error message\"}" }],
  "isError": true
}
```
