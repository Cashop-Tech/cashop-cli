#!/usr/bin/env bash
# Update the formula in Cashop-Tech/homebrew-tap to point at a new release.
# Usage: bump-homebrew-formula.sh 0.1.0
# Reads env: TAP_TOKEN (GitHub PAT with contents:write on the tap repo).
set -euo pipefail

VERSION="${1:?usage: bump-homebrew-formula.sh <version>}"
: "${TAP_TOKEN:?TAP_TOKEN env var required}"

TAP_REPO="Cashop-Tech/homebrew-tap"
TARBALL_LOCAL="release/cashop-cli-${VERSION}.tar.gz"
TARBALL_URL="https://github.com/Cashop-Tech/cashop-cli/releases/download/v${VERSION}/cashop-cli-${VERSION}.tar.gz"

[ -f "$TARBALL_LOCAL" ] || { echo "missing local tarball $TARBALL_LOCAL" >&2; exit 1; }

if command -v sha256sum >/dev/null 2>&1; then
  SHA256=$(sha256sum "$TARBALL_LOCAL" | awk '{print $1}')
else
  SHA256=$(shasum -a 256 "$TARBALL_LOCAL" | awk '{print $1}')
fi

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

git clone "https://x-access-token:${TAP_TOKEN}@github.com/${TAP_REPO}.git" "$WORKDIR/tap"
cd "$WORKDIR/tap"
git config user.name  "cashop-cli-bot"
git config user.email "cashop-cli-bot@users.noreply.github.com"

FORMULA=Formula/cashop.rb
[ -f "$FORMULA" ] || { echo "formula not found at $FORMULA" >&2; exit 1; }

sed -i.bak -E "s|^  url \".*\"|  url \"${TARBALL_URL}\"|"     "$FORMULA"
sed -i.bak -E "s|^  sha256 \".*\"|  sha256 \"${SHA256}\"|"    "$FORMULA"
sed -i.bak -E "s|^  version \".*\"|  version \"${VERSION}\"|" "$FORMULA"
rm -f "$FORMULA.bak"

if git diff --quiet; then
  echo "formula already at v${VERSION}; nothing to commit"
  exit 0
fi

git add "$FORMULA"
git commit -m "cashop ${VERSION}"
git push

echo "formula bumped to v${VERSION}"
