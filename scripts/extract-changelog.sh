#!/usr/bin/env bash
# Extract the CHANGELOG.md section for a given version.
# Usage: extract-changelog.sh 0.1.0
set -euo pipefail

VERSION="${1:?usage: extract-changelog.sh <version>}"
CHANGELOG="${CHANGELOG_PATH:-CHANGELOG.md}"

[ -f "$CHANGELOG" ] || { echo "CHANGELOG.md not found at $CHANGELOG" >&2; exit 1; }

awk -v ver="$VERSION" '
  /^## \[/ {
    if (found) exit;
    if ($0 ~ "^## \\[" ver "\\]") { found=1; next }
  }
  found { print }
' "$CHANGELOG"
