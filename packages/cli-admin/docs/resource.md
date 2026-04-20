# resource - CMS 资源位管理

## 资源位列表

```bash
cashop-console resource list
cashop-console resource list --type insert_heroBanner --status 2
cashop-console resource list --show-channel APP --name "首页"
cashop-console resource list --json
```

| 选项 | 说明 |
|------|------|
| `--type <type>` | 资源类型筛选 |
| `--status <n>` | 状态筛选（1=待生效 2=生效中 3=已失效） |
| `--show-channel <channel>` | 渠道筛选（APP/H5） |
| `--name <name>` | 名称模糊搜索 |
| `--page <n>` | 页码（默认 1） |
| `--page-size <n>` | 每页条数（默认 20） |

## 资源位详情

```bash
cashop-console resource detail <id>
cashop-console resource detail <id> --json
```

`content` 字段会自动从 JSON 字符串解析为对象展示。

## 创建/更新资源位

```bash
cashop-console resource save --data-file resource.json
```

`resource.json` 格式：

```json
{
  "location": "home_all_resource",
  "type": "insert_heroBanner",
  "name": "首页 Banner",
  "showChannel": "app",
  "showThrong": "all",
  "startTime": "2025-01-01T00:00:00",
  "endTime": "2025-12-31T23:59:59",
  "content": "{...}",
  "version": 1
}
```

更新时需提供 `id` 和 `version`（乐观锁）。

## 激活/失效/删除

```bash
# 激活资源位（自动获取 version）
cashop-console resource effect <id>

# 失效资源位
cashop-console resource lose-effect <id>

# 删除资源位
cashop-console resource delete <id>
```

以上命令会自动获取当前 version，无需手动指定。

## 设置排序值

```bash
cashop-console resource sort <id> <sortValue>
```

## 组件类型树

```bash
cashop-console resource component-tree
cashop-console resource component-tree --json
```

以树形结构展示所有可用的组件类型。
