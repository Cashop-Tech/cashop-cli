#!/usr/bin/env bash
# P5 api-key end-to-end smoke. Requires oauth-device login first.
# Usage: bash scripts/smoke-apikey.sh
set -euo pipefail

CLI="node dist/entry.js"
export CASHOP_CLI_BACKEND="${CASHOP_CLI_BACKEND:-file}"
export HOME="${SMOKE_HOME:-$(mktemp -d -t cashop-cli-p5-smoke-XXXXXX)}"
echo "Using HOME=$HOME  CASHOP_CLI_BACKEND=$CASHOP_CLI_BACKEND"

echo
echo "[1/7] cashop login --device --no-browser"
$CLI --env stable login --device --no-browser

echo
echo "[2/7] apikey create smoke-test, ttl 30d"
CREATE=$( $CLI --env stable apikey create --name smoke-test --ttl 30d --json )
echo "$CREATE"
KID=$( echo "$CREATE" | jq -r .kid )
KEY=$( echo "$CREATE" | jq -r .key )
[ "$KID" != "null" ] && [ "$KEY" != "null" ] || { echo "create failed"; exit 1; }

echo
echo "[3/7] apikey list — smoke-test present"
LIST1=$( $CLI --env stable apikey list --json )
echo "$LIST1" | jq .
echo "$LIST1" | jq -e ".items[] | select(.kid==\"$KID\")" > /dev/null || { echo "kid not in list"; exit 1; }

echo
echo "[4/7] call search with api-key — exercise nginx → gateway → cashop-member → interceptor"
$CLI --env stable --api-key "$KEY" --json search foo --page-size 1 > /dev/null

echo
echo "[5/7] apikey list — lastUsedAt updated"
sleep 2
LIST2=$( $CLI --env stable apikey list --json )
LAST=$( echo "$LIST2" | jq -r ".items[] | select(.kid==\"$KID\") | .lastUsedAt" )
[ "$LAST" != "null" ] && [ -n "$LAST" ] || { echo "lastUsedAt not updated (got: $LAST)"; exit 1; }
echo "lastUsedAt=$LAST"

echo
echo "[6/7] apikey rm -y"
$CLI --env stable apikey rm "$KID" -y

echo
echo "[7/7] apikey list — kid gone"
LIST3=$( $CLI --env stable apikey list --json )
if echo "$LIST3" | jq -e ".items[] | select(.kid==\"$KID\")" > /dev/null; then
  echo "kid still present"; exit 1
fi

echo
echo "ALL 7 STEPS PASSED"
