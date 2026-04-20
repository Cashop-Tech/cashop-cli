#!/usr/bin/env bash
# Thin forwarder — preserves the public install URL
#   curl -fsSL https://raw.githubusercontent.com/Cashop-Tech/cashop-cli/release/install.sh | bash
# The real installer lives at packages/cli-c/install.sh; GitHub's raw endpoint
# cannot follow symlinks, so we re-fetch the actual script when run via curl.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL="$SCRIPT_DIR/packages/cli-c/install.sh"

if [ -f "$LOCAL" ]; then
  exec bash "$LOCAL" "$@"
fi

# Invoked via `curl | bash` (no local checkout) — fetch the real installer.
REF="${CASHOP_INSTALLER_REF:-release}"
URL="https://raw.githubusercontent.com/Cashop-Tech/cashop-cli/${REF}/packages/cli-c/install.sh"
exec bash -c "$(curl -fsSL "$URL")" -- "$@"
