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

## P0 milestone map

- **This plan (P1)**: scaffold + password auth + product/cart/order commands
- **P2**: TUI + SSE chat + session persistence
- **P3**: OAuth Device Code (backend + consent page)
- **P4**: CLI wires to OAuth
- **P5**: API Key provider + gateway unified auth
- **P6**: install.sh + Homebrew + npm publishing pipeline
