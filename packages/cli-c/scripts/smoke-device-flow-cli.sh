#!/usr/bin/env bash
# Manual end-to-end smoke test for cashop login --device against stable gateway.
# Not in CI — requires human to open the browser and approve.
set -eu

CLI="node dist/entry.js"
export CASHOP_CLI_BACKEND="${CASHOP_CLI_BACKEND:-file}"
export HOME="${SMOKE_HOME:-$(mktemp -d -t cashop-cli-p4-smoke-XXXXXX)}"
echo "Using HOME=$HOME  CASHOP_CLI_BACKEND=$CASHOP_CLI_BACKEND"

echo
echo "[1/3] cashop login --device --no-browser"
echo "Follow the printed URL and user_code in a browser. Script waits for poll to succeed."
$CLI --env stable login --device --no-browser

echo
echo "[2/3] cashop whoami — expect kind:oauth-device"
$CLI --env stable --json whoami

echo
echo "[3/3] cashop search foo — expect 200 (CLI token → gateway → cashop-member chain)"
$CLI --env stable --json search foo --page-size 1 >/dev/null

echo
echo "ALL 3 STEPS PASSED"
