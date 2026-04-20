# Changelog

All notable changes to cashop-cli are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.4] - 2026-04-17

### Added

- 3 new shell-parity verbs ported from `cashop-ai/cli/consumer/`:
  `recommend <spuCode>` (related-product recommendations, open endpoint),
  `pay checkout` (execute cashier-mode payment for a prepay), and
  `pay info <paymentTradeNo>` (query receivableAmount for a prepay).
- TUI bang auto-completion: `!<Tab>` lists all top-level verbs; `!pay <Tab>`
  lists `checkout | info | methods`. Powered by a shape-only commander
  program built once at TUI startup.
- `/help` now auto-enumerates the full bang command tree (25 top-level
  verbs + 13 subcommands) instead of the hand-maintained 9-line list that
  had drifted behind registration.

## [0.1.3] - 2026-04-17

### Added

- 17 new shell-parity verbs ported from `cashop-ai/cli/consumer/`:
  `cart split`, `cart count`, `order create`, `order cancel`, `order address`,
  `address list`, `address save`, `refund apply`, `track`, `shipping compare`,
  `size`, `promo`, `coupon claim`, `pay`, `pay-methods`, `checkout fee`,
  `checkout split`.

### Fixed

- Locale header defaults now match shell consumer (`x-country: JP`,
  `x-currency: JPY`, `x-language: ja`). Previously 11 commands fell back to
  `http-client`'s `en` default, producing divergent gateway responses.
- `promo` now routes unauthenticated callers to `/open/cms/v2/activity/...`
  instead of the auth path, matching shell's dual-path behavior.
- `ask` command: `getAccessToken()` moved inside try/catch; "not logged in"
  now flows through `ReauthRequired` + `exitCodeFor` for consistent exit
  codes with the rest of the CLI.
- `refund apply`: invalid `--as-type` / `--reason-code` now exits with code 2
  (bad args) instead of 1.
- TUI bang (`!cmd`) now exposes all 34 P1+ verbs. Previously only 13
  were registered, so `!promo`, `!refund apply`, `!order cancel` etc.
  silently returned "unknown command".

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
