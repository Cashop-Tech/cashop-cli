#!/usr/bin/env bash
set -euo pipefail

CLI="node dist/entry.js"
: "${CASHOP_TEST_EMAIL:?set CASHOP_TEST_EMAIL}"
: "${CASHOP_TEST_PASSWORD:?set CASHOP_TEST_PASSWORD}"

export CASHOP_CLI_BACKEND="${CASHOP_CLI_BACKEND:-file}"
export HOME="${SMOKE_HOME:-$(mktemp -d -t cashop-cli-smoke-XXXXXX)}"
echo "Using HOME=$HOME  CASHOP_CLI_BACKEND=$CASHOP_CLI_BACKEND"

echo "-- 1. config env (defaults) --"
$CLI config env | grep -q stable

echo "-- 2. login --"
$CLI login --email "$CASHOP_TEST_EMAIL" --password "$CASHOP_TEST_PASSWORD" --json > /dev/null

echo "-- 3. whoami --"
USER_JSON=$($CLI --json whoami)
echo "$USER_JSON" | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8"));if(!d.userId)process.exit(1);'

echo "-- 4. product search --"
$CLI --json search bag --page-size 3 | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8"));if(!("total" in d))process.exit(1);'

echo "-- 5. cart list --"
$CLI --json cart | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8"));if(typeof d.cartCount!=="number")process.exit(1);'

echo "-- 6. order list --"
$CLI --json orders --page-size 3 | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8"));if(!("pageIndex" in d))process.exit(1);'

echo "-- 7. logout --"
$CLI logout --json > /dev/null

echo "-- 8. whoami after logout (expect exit 4) --"
set +e
$CLI whoami --json > /dev/null 2>&1
CODE=$?
set -e
if [ "$CODE" != "4" ]; then echo "Expected exit 4 got $CODE"; exit 1; fi

echo "-- SMOKE PASS --"
