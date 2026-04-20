# cashop-cli

Cashop 平台 CLI 的 pnpm monorepo，承载两条独立命令行和一个共享的底层包。

| Package | 命令 | 用途 | 分发渠道 |
|---|---|---|---|
| [`packages/cli-c`](./packages/cli-c) (`cashop-cli`) | `cashop` | C 端消费者 CLI（登录 / 搜索 / 购物车 / 下单 / Chat TUI / API Key） | Homebrew、`install.sh` |
| [`packages/cli-admin`](./packages/cli-admin) (`@cashop-tech/console-cli`) | `cashop-console` | 运营管理后台 CLI + MCP Server（销售商品 / 资源位 / 品牌故事 / 上传 / …） | Homebrew、`install.sh` |
| [`packages/core`](./packages/core) (`@cashop/core`) | — | 共享底层（`errors` / `output` / `http/requestJson`） | 仓内 workspace 依赖，tsup 打包时内联到两个 CLI，**不单独发布** |

## 终端用户安装

### C 端 CLI (`cashop`)

```bash
# Homebrew（推荐）
brew install cashop-tech/tap/cashop

# 或 shell 安装脚本
curl -fsSL https://raw.githubusercontent.com/Cashop-Tech/cashop-cli/release/install.sh | bash
```

详见 [`packages/cli-c/README.md`](./packages/cli-c/README.md)。

### 运营 admin CLI (`cashop-console`)

```bash
# Homebrew（推荐）
brew tap cashop-tech/tap
brew install cashop-tech/tap/cashop-console

# 或 shell 安装脚本
curl -fsSL https://raw.githubusercontent.com/Cashop-Tech/cashop-cli/release/packages/cli-admin/install.sh | bash
```

详见 [`packages/cli-admin/README.md`](./packages/cli-admin/README.md)。

## 开发

```bash
pnpm install                     # 装所有 workspace 依赖

pnpm -r typecheck                # 三个包全量类型检查
pnpm -r test                     # 三个包全量单测（core 13 / cli-c 193 / cli-admin 131）
pnpm -r build                    # 全量构建（core 先于两个 CLI）

pnpm --filter cashop-cli dev     # C 端 tsx watch
pnpm --filter @cashop-tech/console-cli dev   # admin tsup watch
```

要求：`Node.js ≥ 18`、`pnpm ≥ 10.13.0`（锁在根 `package.json#packageManager`）。

### 加一个新 CLI 命令

- **C 端**：见 [`packages/cli-c/CLAUDE.md`](./packages/cli-c/CLAUDE.md) 的 "Adding a new subcommand"
- **admin**：见 [`packages/cli-admin/CLAUDE.md`](./packages/cli-admin/CLAUDE.md) 的 "Adding New API Modules"

### 共享代码进 `@cashop/core` 的判断原则

只放**跨 CLI 通用、和具体鉴权模型无关**的东西。已纳入：

- `errors`：`BadArgsError` / `NetworkError` / `HttpError` / `exitCodeFor` 等退出码契约
- `output`：cli-table3 + JSON 格式化（暂未被 admin 消费，保留复用余地）
- `http/requestJson`：裸 fetch + 超时 + 重试，不触碰 token / envelope / reauth

**不要**放的：config dir、token-store、auth-provider、envelope 解析（`{code,success,data}` 属于 gateway 业务语义，C 端和 admin 的 envelope 及错误码映射互不兼容）。

## 发布

两条 CLI 独立发布、独立打 tag：

| CLI | Tag 触发 | Workflow |
|---|---|---|
| `cashop-cli` | `v*.*.*` / `v*.*.*-rc.*` | [`release.yml`](./.github/workflows/release.yml) |
| `@cashop-tech/console-cli` | `admin-v*.*.*` / `admin-v*.*.*-beta.*` / `admin-v*.*.*-rc.*` | [`release-admin.yml`](./.github/workflows/release-admin.yml) |

两条流水线都：跑 typecheck/test → `tsup` 打包（把 `@cashop/core` 内联） → 生成 tarball + sha256 → 创建 GitHub Release → stable 版本同步 bump `Cashop-Tech/homebrew-tap` 中的对应 formula。

## 目录结构

```
cashop-cli/
├── install.sh                         # 对外公开 URL 的薄转发，保持老 cashop 安装命令不变
├── package.json                       # workspace root（private）
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── tsconfig.base.json
├── .github/workflows/
│   ├── ci.yml
│   ├── release.yml                    # C 端 release
│   ├── release-admin.yml              # admin release
│   ├── post-release-check.yml
│   └── verify-tap-token.yml
└── packages/
    ├── core/                          # @cashop/core
    ├── cli-c/                         # cashop-cli（C 端，tsup 单文件 bundle）
    └── cli-admin/                     # @cashop-tech/console-cli（admin，tsup 单文件 bundle）
```

## License

UNLICENSED — internal use within Cashop Technology Ltd.
