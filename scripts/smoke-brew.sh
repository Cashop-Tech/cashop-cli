#!/usr/bin/env bash
# macOS-only: smoke test the Homebrew install path end-to-end.
set -euo pipefail

if [ "$(uname -s)" != "Darwin" ]; then
  echo "smoke-brew.sh requires macOS" >&2
  exit 1
fi

command -v brew >/dev/null 2>&1 || { echo "Homebrew is required" >&2; exit 1; }

echo "== brew tap =="
brew tap cashop-tech/tap

echo "== brew install =="
brew install cashop-tech/tap/cashop

echo "== cashop --version =="
cashop --version

echo "== brew test =="
brew test cashop-tech/tap/cashop

echo "== brew uninstall =="
brew uninstall cashop

echo "brew smoke OK"
