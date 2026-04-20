# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this

`cashop-console` — Cashop 运营管理后台的 CLI + MCP Server 双模式工具。CLI 供人工使用（表格输出），MCP Server 供 AI Agent（OpenClaw）通过 stdio JSON-RPC 调用。

本包是 `cashop-cli` monorepo 下的 `packages/cli-admin/`，与 C 端 CLI（`packages/cli-c/`）共享底层包 `@cashop/core`（`packages/core/`）。Workspace 级规则见仓库根的 [`CLAUDE.md`](../../CLAUDE.md)。

## Build & Dev Commands

本包的脚本等价于从仓库根跑 `pnpm --filter @cashop-tech/console-cli <script>`，在 `packages/cli-admin/` 子目录里可以简写：

```bash
pnpm build                       # tsup 打出 dist/cashop-console.js 单文件（@cashop/core 内联）
pnpm dev                         # 监听模式
pnpm typecheck                   # tsc --noEmit
pnpm test                        # vitest run（不含 e2e）
pnpm test:coverage               # 带覆盖率
CASHOP_E2E_TOKEN=<token> pnpm test:e2e   # 真实 stable 环境只读冒烟
```

单个测试：`pnpm exec vitest run tests/api/resource.test.ts`

## Architecture

双入口共享 API 层：

```
bin/cashop-console.ts            # 入口：args[0]==="mcp-server" → MCP, 否则 → CLI
  ├── src/cli/commands/*.ts      # Commander.js 命令，解析 flags → 调 API → formatTable/formatJson
  └── src/mcp/tools.ts           # McpServer tools 注册，Zod schema → 调 API → JSON text content

共享层（admin 内部）：
  src/api/*.ts                   # 业务 API 函数，接收 ApiContext{env,token} + 参数，transport-agnostic
  src/core/client.ts             # apiRequest() — 基于 @cashop/core 的 requestJson 原语，
                                 #   负责注入 X-AUTHENTICATION (+ 外部用户 MD5 header)、
                                 #   解包 ApiResponse<T> envelope、映射 401/403/4003 为 AuthenticationError
  src/core/credential-login.ts   # SSO 凭据登录（DES 加密 + axios 直连 SSO 端点）
  src/core/sso-login.ts          # SSO 浏览器登录（open + axios 换 token）
  src/core/auth.ts               # Token 解析优先级：--token flag > CASHOP_TOKEN env > config file
  src/core/environments.ts       # stable/prod URL 定义，默认 prod
  src/core/config.ts             # ~/.cashop-console/config.json 读写
  src/core/output.ts             # admin 专属的 Markdown-table 输出（与 @cashop/core 的 format 不同 API，
                                 #   因此没有合并；两者按需共存）

跨包共享（@cashop/core）：
  errors                         # Cashop/ApiError/AuthenticationError 仍在 admin 本地；
                                 # @cashop/core 只提供 HttpError / NetworkError（给 requestJson 用）
  http/requestJson               # 网关调用的底层 fetch 原语（超时 + 重试）
```

## Key Conventions

- **ESM only**：`"type": "module"`，import 需要 `.js` 后缀
- **HTTP 入口只能是 `apiRequest`**：不要在 commands / api 模块里直接 `fetch` / 引 axios；axios 仅限 `credential-login.ts` 与 `sso-login.ts` 两个 SSO 非网关流使用
- **API 响应统一解包**：后端返回 `{ code, message, success, data }`，`apiRequest` 内部解包 envelope 后直接返回 `data`，调用方拿到 `T`
- **认证失败处理**：HTTP 401/403 或 envelope code=4003/403 → 抛 `AuthenticationError`；其他非 success → `ApiError`
- **MCP Tool 命名**：CLI `noun verb` → MCP `cashop-console_{noun}_{verb}`
- **MCP context**：从环境变量 `CASHOP_ENV` + `CASHOP_TOKEN` 获取，不走 config 文件
- **资源位操作**：effect/lose-effect/delete 自动获取 version（乐观锁），调用方无需手动指定
- **Hero Banner 操作**：封装了 detail → parse content JSON → modify imgList → save 的完整流程
- **文件上传**：presigned URL 模式，先获取预签名 URL，再 PUT 到 R2

## Environment URLs

| env | apiUrl | ssoLoginUrl |
|-----|--------|-------------|
| stable | api.castable.hk | login.castable.hk |
| prod | api.cashop.com | login.cashop.com |

## Adding New API Modules

1. `src/api/new-module.ts` — 定义 API 函数，接收 `ApiContext` + params，通过 `apiRequest()` 调用网关
2. `src/cli/commands/new-module.ts` — Commander 命令，注册到 `src/cli/index.ts`
3. `src/mcp/tools.ts` — 添加 `server.tool()` 注册，用 Zod 定义参数 schema
4. `tests/api/new-module.test.ts` — 用 nock 或 global fetch mock 测
5. 更新 `docs/` 对应文档
6. 更新下方"功能覆盖清单"中对应模块的状态

## Release

- 版本写在 `package.json#version`；tag 用 `admin-v<version>`（如 `admin-v0.1.0`、`admin-v0.1.0-beta.9`）
- `git push --tags` 触发 [`.github/workflows/release-admin.yml`](../../.github/workflows/release-admin.yml)：typecheck → test → tsup build → tarball + sha256 → GitHub Release
- **stable tag**（无 `-beta.*` / `-rc.*` 后缀）额外自动 bump `Cashop-Tech/homebrew-tap` 的 `Formula/cashop-console.rb`
  - 首次接入 Homebrew 时需按 `scripts/cashop-console.rb.template` 手工建 formula 到 tap 仓
  - 之后由 `scripts/bump-homebrew-formula.sh` 维护（仅改 url / sha256 / version，不动 install 块）
- **绝不要**让 admin tag 形如 `v*`（那是 C 端的），会跑错 workflow、打错 tarball 名

## 功能覆盖清单

本项目参照运营管理后台 (`../../fe/cashop-fe-manager-main`) 的 API 逐步补齐功能。以下是各模块的覆盖状态：

| 模块 | 管理后台参考文件 | CLI 状态 | 说明 |
|------|-----------------|---------|------|
| 销售商品 (site product) | `src/pages/product/service.ts` | 已实现 | 8 API：列表、详情、价格、库存、上下架、改价、清除定价、算价 |
| CMS 资源位 (resource) | `src/pages/resource/homepageResource/service.ts` | 已实现 | 8 基础 API + 4 Hero Banner 操作 |
| 文件上传 (upload) | `src/service/upload.ts` | 已实现 | presign + R2 上传 |
| 产品库商品 (product) | `src/pages/product/service.ts` | 未实现 | 商品同步、选品规则等 |
| 定价规则 (pricing) | `src/pages/pricing-rules/service.ts` | 未实现 | 类目定价规则 CRUD |
| 品牌故事 (brand story) | `src/pages/brand-story/service.ts` | 已实现 | 7 API：品牌列表、详情、故事列表、故事详情、创建故事、更新故事、语言列表 |
| 订单工作台 (order) | `src/pages/order/service.ts` | 未实现 | 订单查询、备注 |
| 包裹工作台 (package) | `src/pages/package/service.ts` | 未实现 | 包裹查询、备注 |
| 物流管理 (logistics) | `src/pages/logistics/service.ts` | 未实现 | 货代、物流公司、线路管理 |
| 看板 (dashboard) | `src/pages/dashboard/service.ts` | 未实现 | 数据概览 |

> 新增功能时，参考管理后台对应的 service.ts 和 types.ts 作为 API 接口规范来源，实现后更新此表。
