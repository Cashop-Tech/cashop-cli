# resource hero-banner - Hero Banner 图片管理

封装了"获取详情 -> 解析 content -> 修改 imgList -> 保存"的完整流程，避免手动拼 JSON。

## 列出图片

```bash
cashop-console resource hero-banner list-images <id>
cashop-console resource hero-banner list-images <id> --json
```

输出表格包含：index、imgUrl、themeColor、skipType、overlay type。

## 添加图片

```bash
# 基础用法
cashop-console resource hero-banner add-image <id> \
  --img-url "https://cdn.example.com/banner.jpg" \
  --theme-color "#000000"

# 带跳转配置
cashop-console resource hero-banner add-image <id> \
  --img-url "https://cdn.example.com/banner.jpg" \
  --theme-color "#FFFFFF" \
  --skip-to-product --item-code ITEM001

# 带浮层配置
cashop-console resource hero-banner add-image <id> \
  --img-url "https://cdn.example.com/banner.jpg" \
  --theme-color "#000000" \
  --overlay-config-file overlay.json
```

### 图片选项

| 选项 | 必填 | 说明 |
|------|------|------|
| `--img-url <url>` | YES | 图片 URL |
| `--theme-color <color>` | YES | 状态栏主题色（`#000000` 或 `#FFFFFF`） |
| `--placeholder-color <hex>` | NO | 兜底背景色 |
| `--width <px>` | NO | 图片宽度 |
| `--height <px>` | NO | 图片高度 |
| `--img-i18n <json>` | NO | 多语言图片 URL |

### 跳转类型（互斥，选其一）

| 选项 | 配合参数 | 说明 |
|------|----------|------|
| `--skip-to-product` | `--item-code <code>` | 跳转商品详情 |
| `--skip-to-brand` | `--brand-id <id>` | 跳转品牌 |
| `--skip-to-category` | `--category-id <id>` | 跳转分类 |
| `--skip-to-url` | `--url <url>` | 跳转外链 |
| `--skip-to-link` | `--custom-link <link>` | 自定义链接 |

### 浮层配置

| 选项 | 说明 |
|------|------|
| `--overlay-config <json>` | 内联 JSON 浮层配置 |
| `--overlay-config-file <path>` | 从文件读取浮层配置 |
| `--no-overlay` | 不使用浮层 |

**浮层配置示例** (`overlay.json`)：

```json
{
  "overlayType": 1,
  "textOverlay": {
    "title": "Spring Collection",
    "titleI18n": { "zh": "春季系列", "ja": "春のコレクション", "en": "Chunji Xilie" },
    "titleColor": "#ff7711",
    "content": "Up to 50% off",
    "contentColor": "#333333",
    "button": {
      "showButton": 1,
      "buttonType": 1,
      "textButton": {
        "buttonTitle": "Shop Now",
        "buttonTitleColor": "#ff7711",
        "buttonStyle": 1
      }
    }
  }
}
```

`buttonStyle` 值：1=气泡 2=箭头 3=下划线

## 删除图片

```bash
cashop-console resource hero-banner remove-image <id> --index 2
```

## 更新图片

只更新传入的字段，未传的保留原值。

```bash
# 只更新主题色
cashop-console resource hero-banner update-image <id> --index 0 --theme-color "#FFFFFF"

# 更新图片 URL 和跳转
cashop-console resource hero-banner update-image <id> --index 1 \
  --img-url "https://cdn.example.com/new-banner.jpg" \
  --skip-to-brand --brand-id B001
```
