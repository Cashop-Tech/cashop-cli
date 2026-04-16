# Changelog

All notable changes to cashop-cli are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.2] - 2026-04-16

### Fixed

- `cart` / key-value tables: nested arrays and objects no longer collapse to
  `[object Object]`. They render as compact JSON instead.

### Added

- TUI renderer now handles cashop-ai's structured SSE events:
  `products` (product recommendation list), `product_detail`, `order_card`,
  `onboard_options`, `promo_list`, `address_list`. Previously these were
  silently dropped, so users only saw `text_delta` + `suggestions` even when
  the backend was emitting product cards.

## [0.1.1] - 2026-04-16

### Fixed

- TUI: after `!login` the in-memory auth provider was stale (captured at startup
  before any login), so subsequent `!cart` / `/sessions` / chat kept returning
  401 or "not logged in". Now re-selects provider from on-disk token store on
  every bang, slash, and chat turn.

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
