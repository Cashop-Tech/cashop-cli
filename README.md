# Cashop-CLI

Official command-line interface for the Cashop platform.

> Status: **early P0 development**. Not yet released — build from source.

## Build from source

```bash
pnpm install
pnpm run build
node dist/entry.js --help
```

## Commands (P1 scope)

- `cashop login --email … --password …` / `cashop logout` / `cashop whoami`
- `cashop config` (print all) / `cashop config <key>` / `cashop config <key> <value>`
- `cashop env` (print) / `cashop env stable|prod` (switch)
- `cashop search <keyword>` / `cashop product <spuCode>`
- `cashop cart` (list) / `cashop cart add --spu … --sku … --qty …`
- `cashop orders` / `cashop order <orderNo>`

Coming soon: TUI chat (`cashop` with no args), OAuth Device Code, API keys, the rest of the domain verbs, and install.sh / Homebrew / npm distribution.

## License

UNLICENSED (private preview).
