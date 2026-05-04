# cashop-cli (Claude Code guide)

TypeScript CLI for the Cashop platform. Submodule of `cashop-workspace`.

## Quick commands

```bash
pnpm install
pnpm run dev -- --help             # dev mode (tsx)
pnpm test                          # unit tests (vitest)
pnpm run typecheck                 # tsc --noEmit
pnpm run build                     # compile to dist/
```

## P1 shell command paths

Commands are flat (no `auth`/`product`/`order` groups); files are still grouped by domain on disk.

- `cashop login --email … --password …` / `cashop logout` / `cashop whoami`
- `cashop config` / `cashop config <key>` / `cashop config <key> <value>`
- `cashop env` / `cashop env stable|prod`
- `cashop search <keyword>` / `cashop product <spuCode>`
- `cashop cart` (list, default) / `cashop cart add --spu … --sku … --qty …`
- `cashop orders` / `cashop order <orderNo>`

## P2 TUI + chat (2026-04-15)

- `cashop` (no args) → readline TUI; prefixes: plain=chat, `!`=bang, `/`=slash
- `cashop --resume` → TUI + continue `last_session_id`
- `cashop ask "<msg>" [--resume|--session <id>] [--json]` → one-shot SSE chat
- `cashop sessions` → `GET /ai/cashop-ai/rpc/auth/sessions`
- `cashop session rm <id>` → `DELETE /ai/cashop-ai/rpc/auth/sessions/{id}` (`-y` skip confirm)

TUI dispatches:
- `parseLine(raw)` → `{kind: 'empty'|'chat'|'bang'|'slash', ...}`
- bang builds a fresh `Command` with `exitOverride()` and reuses P1 modules
- slash commands: `/help` `/new` `/sessions` `/resume <id>` `/exit`

State:
- `~/.cashop/chat.yaml` holds `last_session_id` only (messages live server-side)

## Architecture

- `src/entry.ts`: argv → Commander → preAction builds CliContext → subcommand `.action()`
- `src/core/*`: config, logger, http-client, token-store, auth-provider, output, errors, confirm, globals
- `src/commands/<domain>/<verb>.ts`: one file per subcommand (most register flat top-level verbs on `program`; `cart/*` still share a `cart` group via `ensureGroup`)
- All network calls go through `core/http-client.ts::gatewayRequest`
- All token storage goes through `core/token-store.ts`
- All errors flow through `core/errors.ts` + `core/_helpers.ts::runCmd`

## Rules

- **Never** call `fetch`, `undici`, or any HTTP library directly in command or TUI code — use `gatewayRequest`
- **Never** write to `~/.cashop/` outside `core/config.ts` or `core/token-store.ts`
- **Every** command gets a test under `tests/commands/<domain>/<verb>.test.ts`
- `pnpm test` must pass before every push
- Endpoint shapes live in `src/types/api.ts`; update there first if the gateway changes

## Adding a new subcommand

1. Capture gateway endpoint shape (path/method/request/response) and paste into a PR comment
2. Add DTOs to `src/types/api.ts`
3. Write failing test in `tests/commands/<domain>/<verb>.test.ts`
4. Implement `src/commands/<domain>/<verb>.ts`
5. Register in `src/entry.ts`
6. Commit test + impl + registration together

## P5 apikey commands

Long-lived bearer tokens for automation. Managed only by an oauth-device
session (guarded by `requireOAuthDevice` — trying to create a key while
authenticated with another api-key returns 703013).

- `cashop apikey create --name <n> [--ttl 30d|90d|180d|1y|never] [--json]` →
  `{kid, key, name, createdAt, expiresAt}`; `key` is shown once
- `cashop apikey list [--json]` → name, kid, createdAt, expiresAt, lastUsedAt
- `cashop apikey rm <kid> [-y] [--json]` → confirm prompt unless `-y`

Using a key for requests: `cashop --api-key <csk_live_xxx> search foo` (or
`CASHOP_API_KEY` env var). The provider layer was wired in P4; P5 only
adds the management verbs.

Friendly errors (see `src/core/errors.ts`):
- `703012` reached 10-key limit
- `703013` api-key cannot manage api-keys
- `703014` duplicate name
- `703015` kid not found / not owned

Smoke: `scripts/smoke-apikey.sh` — login via device, create, list, call
search via `--api-key`, assert `lastUsedAt` updated, revoke, list empty.

## P6 distribution (2026-04-15)

Path C: Node tarball + on-device `npm install`. No npm registry publish, no Bun binary.

- Release trigger: push tag `v*.*.*` (stable) or `v*.*.*-rc.*` (prerelease) → `.github/workflows/release.yml`
- Artifacts: `cashop-cli-<ver>.tar.gz` (dist/ + package.json + pnpm-lock.yaml + README + CHANGELOG) + `.sha256`
- Homebrew tap auto-bumped by `scripts/bump-homebrew-formula.sh` (stable only) → `Cashop-Tech/homebrew-tap`
- Shell installer: `install.sh` on `release` branch, served via `raw.githubusercontent.com`
- Post-release verification: manually dispatch `.github/workflows/post-release-check.yml` (matrix: ubuntu + macos for install.sh, macos for brew)

Versioning:
- `src/entry.ts` reads version from `package.json` at runtime via `createRequire(import.meta.url)` — single source of truth
- Release CI verifies `package.json.version === tag`; mismatch fails the build
- On `release` branch, keep `package.json` at `<next>-dev` between releases; bump to the real version when tagging

Formula install block (non-obvious):
- Tarball has no `bin/` scripts and `dist/entry.js` lacks exec bit, so `std_npm_args` + `bin.install_symlink` gives "Empty installation"
- Current pattern: copy tarball into `libexec`, run `npm install --omit=dev` inside, write `bin/cashop` as a bash exec wrapper calling `node libexec/dist/entry.js`
- `bump-homebrew-formula.sh` only sed-replaces url/sha256/version — does NOT touch the install block

## P0 milestone map

- **P1**: scaffold + password auth + product/cart/order commands
- **P2**: TUI + SSE chat + session persistence
- **P3**: OAuth Device Code (backend + consent page)
- **P4**: CLI wires to OAuth
- **P5**: API Key provider + gateway unified auth
- **P6** (done 2026-04-15): tag-driven release → GitHub Release + Homebrew tap + install.sh, no npm publish

## 技术方案文档

实现需求/重构/排障修复完成后，必须在仓库 `docs/` 目录下补一份技术方案文档：

- 文件路径：`docs/<主题中文名>.md`，文件名允许中文
- 内容至少包含：背景与目标、方案设计、关键改动点（含文件路径）、风险与回滚、验证方式
- 提交时与代码改动放在同一个 commit 或紧邻的 commit，不要事后补
- 已存在历史专用目录的仓库（如 cashop-base 的 `02_设计文档/`、父仓的 `docs/migration/`）继续沿用，不强制改名
