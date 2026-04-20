# cashop-console

Cashop 运营管理后台 CLI 工具，支持 CLI 交互模式和 MCP Server 模式（供 AI Agent 调用）。

## 安装

> 前置条件：Node.js ≥ 18（Homebrew 会自动装；用 install.sh 的话需要自己有 `node` 和 `npm`）。

### 方式 1：Homebrew（推荐，macOS / Linux）

```bash
brew tap cashop-tech/tap           # 首次一次性
brew install cashop-tech/tap/cashop-console

# 升级
brew upgrade cashop-console
```

> Homebrew 只跟踪 stable 版本（形如 `admin-v0.1.0`）。想尝鲜 beta/rc 请用方式 2。

### 方式 2：一键 shell 安装（支持 beta / 指定版本）

```bash
# 最新 stable
curl -fsSL https://raw.githubusercontent.com/Cashop-Tech/cashop-cli/release/packages/cli-admin/install.sh | bash

# 最新 prerelease（含 beta/rc）
CASHOP_CONSOLE_PRERELEASE=1 \
  curl -fsSL https://raw.githubusercontent.com/Cashop-Tech/cashop-cli/release/packages/cli-admin/install.sh | bash

# 锁定版本
CASHOP_CONSOLE_VERSION=0.1.0-beta.9 \
  curl -fsSL https://raw.githubusercontent.com/Cashop-Tech/cashop-cli/release/packages/cli-admin/install.sh | bash
```

默认装到 `~/.cashop-console/`，把 `~/.cashop-console/bin` 加入 `PATH` 即可（脚本会按需打印提示）。

支持的环境变量：

| 变量 | 作用 | 默认 |
|---|---|---|
| `CASHOP_CONSOLE_HOME` | 安装根目录 | `$HOME/.cashop-console` |
| `CASHOP_CONSOLE_VERSION` | 锁定具体版本 | 最新 stable |
| `CASHOP_CONSOLE_PRERELEASE` | 设为 `1` 安装最新 prerelease | — |

### 验证安装

```bash
cashop-console --version
cashop-console --help
```

## MCP Server 配置

在 OpenClaw / Claude Desktop 的 MCP 配置中添加：

```json
{
  "cashop-console": {
    "command": "cashop-console",
    "args": ["mcp-server"],
    "env": {
      "CASHOP_TOKEN": "<运营后台登录Token>",
      "CASHOP_ENV": "prod"
    }
  }
}
```

> 运营同学只需和 AI 对话，AI Agent 后台通过 MCP Server 执行操作，无需直接使用 CLI。

## CLI 使用

```bash
# 认证登录（Token 方式）
cashop-console auth login --token <your-token> --env stable

# 或浏览器 SSO 登录
cashop-console auth login --env stable

# 验证登录状态
cashop-console auth status
```

## 全局选项

```
--env <stable|prod>          环境选择（默认 prod）
--json                       JSON 格式输出
--site <code>                站点代码（销售商品命令必填）
--token <token>              覆盖认证 token
--verbose                    详细日志
```

## 命令模块

| 模块 | 说明 | 文档 |
|------|------|------|
| `auth` | 认证管理（登录/登出/状态） | [docs/auth.md](docs/auth.md) |
| `config` | CLI 配置管理 | [docs/config.md](docs/config.md) |
| `upload` | 文件上传到 R2（获取 CDN URL） | [docs/upload.md](docs/upload.md) |
| `sales-product` | 销售商品管理（8 个子命令） | [docs/sales-product.md](docs/sales-product.md) |
| `resource` | CMS 资源位管理（8 个子命令） | [docs/resource.md](docs/resource.md) |
| `resource hero-banner` | Hero Banner 图片管理（4 个子命令） | [docs/hero-banner.md](docs/hero-banner.md) |
| `mcp-server` | MCP Server 模式（22 个 Tools） | [docs/mcp-server.md](docs/mcp-server.md) |

## 环境配置

| 环境 | API 地址 | SSO 登录 |
|------|----------|----------|
| stable | `https://api.castable.hk` | `https://login.castable.hk` |
| prod | `https://api.cashop.com` | `https://login.cashop.com` |

配置文件位置：`~/.cashop-console/config.json`

Token 读取优先级：`--token` flag > `CASHOP_TOKEN` 环境变量 > config 文件

## 开发

本包位于 `cashop-cli` 仓库的 pnpm workspace 下（`packages/cli-admin`）。所有命令从仓库根目录执行：

```bash
pnpm install                                     # 装所有 workspace 依赖
pnpm --filter @cashop-tech/console-cli build     # 构建
pnpm --filter @cashop-tech/console-cli dev       # 监听模式
pnpm --filter @cashop-tech/console-cli typecheck
pnpm --filter @cashop-tech/console-cli test
pnpm --filter @cashop-tech/console-cli test:coverage
```

或在 `packages/cli-admin/` 子目录里直接用 `pnpm build` / `pnpm test` 等简写。

## 发布流程

- 在 `packages/cli-admin/package.json` 中升版本号（例如 `0.1.0-beta.9` → `0.1.0`）
- 打 tag：`git tag admin-v0.1.0 && git push --tags`
- `.github/workflows/release-admin.yml` 自动：跑 typecheck/test/build → 打 tarball → 创建 GitHub Release → stable 版本会同步 bump `Cashop-Tech/homebrew-tap` 的 `Formula/cashop-console.rb`
- Beta/RC（tag 含 `-beta.*` / `-rc.*`）标记为 prerelease，不会触发 Homebrew 更新

## 技术栈

TypeScript + Node.js >= 18 (ESM) | Commander.js | @modelcontextprotocol/sdk | fetch (via `@cashop/core`) | zod | tsup
