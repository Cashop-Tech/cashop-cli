# cashop-cli monorepo (Claude Code guide)

pnpm workspace 承载两条独立 CLI 与一个共享底层包。整体概览看 [README.md](./README.md)；本文件集中列出开发规则和 Claude 在本仓库里工作时要遵守的红线。

## Workspace 结构

```
packages/core          @cashop/core              共享底层（errors / output / http/requestJson）
packages/cli-c         cashop-cli (bin: cashop)  C 端消费者 CLI（已有详细 CLAUDE.md）
packages/cli-admin     @cashop-tech/console-cli  运营 admin CLI + MCP Server（已有详细 CLAUDE.md）
```

子包里的 `CLAUDE.md` 是该包的权威规范：

- C 端约束：见 [`packages/cli-c/CLAUDE.md`](./packages/cli-c/CLAUDE.md)
- admin 约束：见 [`packages/cli-admin/CLAUDE.md`](./packages/cli-admin/CLAUDE.md)
- 本文件只管 **跨包**、**workspace 级**、**发布级** 的事情

## 必做

- 每次改动完跑 `pnpm -r typecheck` 和 `pnpm -r test`，必须全绿才算完成
- 任何跨包重构改完，务必 `pnpm -r build` 确认两个 tsup bundle 都能产出（产物：`packages/cli-c/dist/entry.js`、`packages/cli-admin/dist/cashop-console.js`）
- 新增依赖用 `pnpm --filter <pkg> add <dep>`（永远指定 filter，不要污染其他包）
- 运行 C 端命令：`pnpm --filter cashop-cli dev -- <args>`；运行 admin：`node packages/cli-admin/dist/cashop-console.js <args>`（或先 build）

## 红线（跨包）

- **绝对不要**把 C 端 auth / token / envelope 逻辑搬进 `@cashop/core`。两条 CLI 的鉴权模型根本不同（C 端：OAuth Device + ApiKey + password；admin：SSO browser + 凭据 + token paste），强行统一只会制造条件分支地狱
- **绝对不要**让 `@cashop/core` 反向依赖任意一个 CLI；core 不感知 gateway envelope（`{code,success,data}`）
- **绝对不要**给 `@cashop/core` 加运行时重依赖；目前只允许 `cli-table3` 这种纯显示类 dep
- **绝对不要**在根目录以外再放 `pnpm-lock.yaml`。workspace 的锁文件只允许在仓库根
- **绝对不要**把 `@cashop/core` 发布到 npm / GitHub Packages。它存在的唯一意义是被 tsup `noExternal` 吃进两个 CLI 的 bundle

## tsup `noExternal` 契约（关键）

两条 CLI 的 `tsup.config.ts` 都声明了 `noExternal: ['@cashop/core']`。同时 release workflow 会在打 tarball 之前用 `node -e` 从 `package.json` 里**删掉** `@cashop/core` 这一条 workspace 依赖（因为 `npm install` 无法解析 `workspace:*`）。这套组合保证：

- workspace 开发时：`@cashop/core` 通过 symlink 解析
- tsup 构建时：`@cashop/core` 的源码被内联到 `dist/entry.js` / `dist/cashop-console.js`
- 用户安装时：tarball 里的 `package.json` 不含 `@cashop/core`，`npm install --omit=dev` 只装真正的外部依赖

**改动 tsup 配置、package.json dependencies、或 release.yml 的打包步骤时都要重新推演这三段是不是还对齐**。配错的典型症状：tarball 装完运行时 `Cannot find package '@cashop/core'`。

## 版本 & 发布

- C 端版本写在 `packages/cli-c/package.json`，tag 形如 `v0.1.5`
- admin 版本写在 `packages/cli-admin/package.json`，tag 形如 `admin-v0.1.0` / `admin-v0.1.0-beta.9`
- 两个 release.yml 都会先 `verify package.json.version === tag`（去掉前缀后比较），不一致直接红
- stable 版本（非 `-rc.*` / `-beta.*`）会自动 bump `Cashop-Tech/homebrew-tap`：
  - C 端 → `Formula/cashop.rb`
  - admin → `Formula/cashop-console.rb`（首次需按 `packages/cli-admin/scripts/cashop-console.rb.template` 手工建 formula，之后自动）
- 绝对**不要**把 `v*` 和 `admin-v*` 写反——走错 workflow、打错 tarball 名、污染 Homebrew

## 对外 URL（不能动）

这些 URL 有外部用户/脚本在用，重命名 = 破坏安装：

- `https://raw.githubusercontent.com/Cashop-Tech/cashop-cli/release/install.sh`（根层薄转发，C 端安装入口）
- `https://raw.githubusercontent.com/Cashop-Tech/cashop-cli/release/packages/cli-admin/install.sh`（admin 安装入口）
- `https://github.com/Cashop-Tech/cashop-cli/releases/download/v${v}/cashop-cli-${v}.tar.gz`
- `https://github.com/Cashop-Tech/cashop-cli/releases/download/admin-v${v}/cashop-console-cli-${v}.tar.gz`

移动 `install.sh` 物理位置时，记得根 `install.sh` 的转发 fallback 要能通过 raw.githubusercontent 重新抓取。

## 常用命令速查

```bash
# 全量
pnpm -r typecheck
pnpm -r test
pnpm -r build

# 单包
pnpm --filter @cashop/core test
pnpm --filter cashop-cli dev -- login --device
pnpm --filter @cashop-tech/console-cli build

# 本地模拟 tarball 安装（用于验 release workflow 改动）
cd packages/cli-c   # or packages/cli-admin
node -e 'const p=JSON.parse(require("fs").readFileSync("package.json","utf8"));delete p.dependencies["@cashop/core"];require("fs").writeFileSync("/tmp/p.json",JSON.stringify(p,null,2))'
# → 复制 dist/ + /tmp/p.json + README + (CHANGELOG) + 根 pnpm-lock.yaml 到临时目录，npm install --omit=dev
```

## 仓库性质

本仓库是 `cashop-workspace` 的 git submodule。在这里跑的 commit 需要回父仓更新 submodule 指针。不要在本仓库里做会破坏 submodule 关系的操作（改 `.git` 路径、改 remote URL 等）。

## 技术方案文档

实现需求/重构/排障修复完成后，必须在仓库 `docs/` 目录下补一份技术方案文档：

- 文件路径：`docs/<主题中文名>.md`，文件名允许中文
- 内容至少包含：背景与目标、方案设计、关键改动点（含文件路径）、风险与回滚、验证方式
- 提交时与代码改动放在同一个 commit 或紧邻的 commit，不要事后补
- 已存在历史专用目录的仓库（如 cashop-base 的 `02_设计文档/`、父仓的 `docs/migration/`）继续沿用，不强制改名

## 需求/技术方案制定原则

- **App 老版本兼容（必须）**：在制作需求的 plan 或技术方案时，必须显式考虑 App 老版本兼容问题。包括但不限于：
  - 接口契约变更：禁止删除/重命名老版本仍在使用的字段；新增字段必须可选，避免破坏老版本解析
  - 接口语义变更：返回值含义、枚举值、状态码变更需评估老版本表现，必要时新增 v2 接口并保留 v1
  - 强制升级策略：涉及不兼容变更时，PRD 阶段就要明确强升/弱升/灰度方案，并与端上确认最低支持版本
  - 配置/开关：Apollo/远程配置项格式变更需保证老版本能正确读取或兜底
  - 新功能入口：服务端返回老版本不识别的内容时，端上要有兜底（隐藏/降级展示）
  - 数据迁移：本地存储/缓存结构变更需在端上做兼容读取
  - 灰度回滚：方案需说明老版本用户如何回滚，及服务端是否能按 App 版本号路由
- 在 plan 文档中应当有专门一节列出**老版本兼容影响评估**与**最低支持版本**，没有的方案视为不完整。
