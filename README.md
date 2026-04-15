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

Coming soon: OAuth Device Code, API keys, the rest of the domain verbs, and install.sh / Homebrew / npm distribution.

## License

UNLICENSED (private preview).
