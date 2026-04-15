# Changelog

All notable changes to cashop-cli are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-04-15

### Added

- P1: Password login, product/cart/order commands (`cashop login`, `cashop search`, `cashop product`, `cashop cart`, `cashop orders`, `cashop order`)
- P2: TUI with SSE chat and session persistence (`cashop`, `cashop --resume`, `cashop ask`, `cashop sessions`)
- P3: OAuth Device Code login (`cashop login --device`)
- P4: CLI wired to OAuth tokens (keytar on desktop, encrypted file on headless)
- P5: API Key management (`cashop apikey create|list|rm`) and `--api-key` / `CASHOP_API_KEY` for automation
- P6: `brew install cashop-tech/tap/cashop` and `curl … | bash` installer (this release)

### Notes

- Requires Node.js ≥ 18
- macOS and Linux only
