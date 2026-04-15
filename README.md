# Cashop-CLI

Official command-line interface for the Cashop platform.

> Status: **early P0 development**. Not yet released — build from source.

## Install

### Homebrew (macOS and Linux)

```bash
brew install cashop-tech/tap/cashop
```

### Shell installer

```bash
curl -fsSL https://raw.githubusercontent.com/Cashop-Tech/cashop-cli/release/install.sh | bash
```

Pin a specific version:

```bash
curl -fsSL https://raw.githubusercontent.com/Cashop-Tech/cashop-cli/release/install.sh \
  | CASHOP_CLI_VERSION=0.1.0 bash
```

Both methods require Node.js ≥ 18. Homebrew installs Node automatically; the shell installer prints a platform-specific hint if it's missing.

### Build from source

```bash
pnpm install
pnpm run build
node dist/entry.js --help
```

## Usage

### Enter the TUI (main entry)

```bash
cashop                   # interactive TUI
cashop --resume          # TUI + continue last chat session
```

Inside the TUI:
- plain text → chat with the AI
- `!<verb>` → run a shell subcommand (output is shown in the conversation)
- `/help` → list slash commands (/new /sessions /resume /exit)

### One-shot commands (pipe-friendly)

```bash
cashop login --email u@x.com --password ...
cashop logout / whoami
cashop search <keyword> / product <spuCode>
cashop cart / cart add --sku ... --spu ... --qty N
cashop orders / order <orderNo>
cashop ask "question"          # one-shot AI chat
cashop sessions                # list chat sessions
cashop session rm <id>         # delete
```

## OAuth Device Code Login

```bash
cashop login --device              # opens browser, prints user_code
cashop login --device --no-browser # SSH / headless: prints URL + code for manual open
```

The device flow is an OAuth 2.0 Authorization Grant (RFC 8628). Tokens are stored the
same way as password tokens (keytar on macOS/Linux desktop, encrypted file on
headless/SSH). `cashop logout` clears both device and password tokens.

**Concurrency note:** running multiple `cashop` commands in parallel is not supported —
token refresh is not race-safe. The server detects refresh-token reuse and revokes the
entire session (703011), which wipes your local CLI token for that env.

## API Keys

Long-lived bearer tokens for automation and CI. Only an interactive
oauth-device session can mint or revoke them.

```bash
cashop login --device                         # one-time, gets a device session
cashop apikey create --name ci-deploy --ttl 90d
# → prints csk_live_xxxx  (shown once — copy it now)

cashop apikey list
cashop --api-key csk_live_xxxx search foo     # use the key
CASHOP_API_KEY=csk_live_xxxx cashop search foo # or via env
cashop apikey rm ak_xxxx
```

Limits and semantics: up to 10 active keys per user; TTL choices are
`30d | 90d | 180d | 1y | never`; `lastUsedAt` is stamped on every request
(debounced to 60s); keys cannot manage other keys.

Coming soon: the rest of the domain verbs, and install.sh / Homebrew / npm distribution.

## License

This project is source-available but not open source. All rights reserved
by Cashop. You may install and use the CLI under the terms of the Cashop
platform agreement; you may not redistribute or fork the source code.
