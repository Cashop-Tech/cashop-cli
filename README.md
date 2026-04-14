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

- `cashop auth login/logout/whoami`
- `cashop config get/set/env`
- `cashop product search/get`
- `cashop cart list/add`
- `cashop order list/get`

Coming soon: TUI chat (`cashop` with no args), OAuth Device Code, API keys, the rest of the domain verbs, and install.sh / Homebrew / npm distribution.

## License

UNLICENSED (private preview).
