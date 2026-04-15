# Cashop-CLI

Official command-line interface for the Cashop platform.

> Status: **early P0 development**. Not yet released — build from source.

## Build from source

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

Coming soon: API keys, the rest of the domain verbs, and install.sh / Homebrew / npm distribution.

## License

UNLICENSED (private preview).
