#!/usr/bin/env bash
# Manual end-to-end smoke test for cashop login --device against stable gateway.
# Not in CI — requires human to open the browser and approve.
set -eu

BASE="${BASE:-http://159.138.7.47:8989}"

echo "[1/3] cashop login --device --no-browser"
echo "Follow the printed URL and user_code. Script waits for poll to succeed."
CASHOP_CLI_BACKEND=file pnpm run dev -- --env stable login --device --no-browser

echo
echo "[2/3] cashop whoami — expect kind:oauth-device"
pnpm run dev -- --env stable whoami

echo
echo "[3/3] cashop search foo — expect 200 (CLI token → gateway → cashop-member chain)"
pnpm run dev -- --env stable search foo

echo
echo "ALL 3 STEPS PASSED"
