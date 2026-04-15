#!/usr/bin/env bash
# End-to-end smoke test for install.sh against the live GitHub Release.
# Runs in an isolated CASHOP_HOME so it does not touch the developer's
# real ~/.cashop directory.
set -euo pipefail

INSTALLER_URL="${INSTALLER_URL:-https://raw.githubusercontent.com/Cashop-Tech/cashop-cli/main/install.sh}"
PIN_VERSION="${PIN_VERSION:-}"

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT
export CASHOP_HOME="$WORKDIR/.cashop"

echo "== smoke-install.sh: latest =="
curl -fsSL "$INSTALLER_URL" | bash
test -x "$CASHOP_HOME/bin/cashop"
"$CASHOP_HOME/bin/cashop" --version

if [ -n "$PIN_VERSION" ]; then
  echo "== smoke-install.sh: pinned $PIN_VERSION =="
  curl -fsSL "$INSTALLER_URL" | CASHOP_CLI_VERSION="$PIN_VERSION" bash
  "$CASHOP_HOME/bin/cashop" --version
fi

echo "install smoke OK"
