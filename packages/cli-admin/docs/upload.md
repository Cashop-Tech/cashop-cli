# upload - 文件上传

将本地文件上传到 R2 存储，返回 CDN 访问 URL。这是一个基础服务命令，可被其他业务复用（如 Hero Banner 图片、素材管理等）。

## 使用流程

典型的 AI Agent 工作流：

```
pencil 生成图片 → 保存到本地 → cashop-console upload → 拿到 CDN URL → add-image / update-image
```

## 命令

```bash
# 上传文件
cashop-console upload ./banner.png
cashop-console upload /tmp/generated-image.jpg

# JSON 输出（适合脚本/自动化）
cashop-console upload ./banner.png --json
```

## 输出

默认输出：
```
✓ Upload complete
  URL:     https://cdn.example.com/path/to/file.png
  File ID: 1234567890123456
```

JSON 输出（`--json`）：
```json
{
  "accessUrl": "https://cdn.example.com/path/to/file.png",
  "fileId": "1234567890123456",
  "fileKey": "APPID/BIZTYPEID/2025-01-01/1234567890123456_1234567890_presign.png"
}
```

## 实现原理

1. 调用后端 API 获取 R2 预签名上传 URL
2. 通过预签名 URL 直接 PUT 文件到 R2
3. 返回 CDN 访问地址

支持的文件类型：JPEG、PNG、GIF、WebP、SVG、AVIF、MP4、WebM、MOV、PDF 等。

## 配合 Hero Banner 使用示例

```bash
# 1. 上传图片
cashop-console upload ./spring-banner.jpg --json
# 输出: {"accessUrl": "https://cdn.example.com/banner.jpg", ...}

# 2. 用返回的 URL 添加到 Hero Banner
cashop-console resource hero-banner add-image <id> \
  --img-url "https://cdn.example.com/banner.jpg" \
  --theme-color "#000000"
```
