#!/usr/bin/env bash
# cashop-console installer — ships the Cashop ops/admin CLI alongside the
# consumer CLI in the same GitHub release repo (different tag prefix).
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Cashop-Tech/cashop-cli/release/packages/cli-admin/install.sh | bash
#
# Env vars:
#   CASHOP_CONSOLE_HOME          override install root (default: $HOME/.cashop-console)
#   CASHOP_CONSOLE_VERSION       pin a specific version (e.g. 0.1.0-beta.9)
#   CASHOP_CONSOLE_PRERELEASE    set to 1 to install the newest prerelease

set -euo pipefail

REPO="Cashop-Tech/cashop-cli"
TAG_PREFIX="admin-v"
ARTIFACT="cashop-console-cli"
BINARY="cashop-console"
ENTRY="dist/cashop-console.js"
INSTALL_DIR="${CASHOP_CONSOLE_HOME:-$HOME/.cashop-console}"
MIN_NODE_MAJOR=18

CURRENT_LIB=""
TMPDIR_CASHOP=""

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mwarn:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

cleanup_on_error() {
  if [ -n "$CURRENT_LIB" ] && [ -d "$CURRENT_LIB" ]; then
    warn "installation failed; removing partial directory $CURRENT_LIB"
    rm -rf "$CURRENT_LIB"
  fi
}
cleanup_on_exit() {
  if [ -n "$TMPDIR_CASHOP" ] && [ -d "$TMPDIR_CASHOP" ]; then
    rm -rf "$TMPDIR_CASHOP"
  fi
}
trap cleanup_on_error ERR
trap cleanup_on_exit  EXIT

header() {
  cat <<'BANNER'

  cashop-console installer (admin CLI)
  ────────────────────────────────────

BANNER
}

check_os() {
  case "$(uname -s)" in
    Darwin|Linux) ;;
    *) die "unsupported OS: $(uname -s) (macOS and Linux only)" ;;
  esac
}

check_node() {
  if ! command -v node >/dev/null 2>&1; then
    die "Node.js is required (>= ${MIN_NODE_MAJOR}). Install from https://nodejs.org/en/download"
  fi
  local major
  major=$(node -p "process.versions.node.split('.')[0]")
  if [ "$major" -lt "$MIN_NODE_MAJOR" ]; then
    die "node $(node -v) is too old; need Node.js ${MIN_NODE_MAJOR} or newer."
  fi
}

check_tools() {
  local missing=()
  for tool in curl tar npm; do
    command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
  done
  if ! command -v sha256sum >/dev/null 2>&1 && ! command -v shasum >/dev/null 2>&1; then
    missing+=("sha256sum or shasum")
  fi
  if [ ${#missing[@]} -gt 0 ]; then
    die "missing required tools: ${missing[*]}"
  fi
}

resolve_version() {
  if [ -n "${CASHOP_CONSOLE_VERSION:-}" ]; then
    echo "$CASHOP_CONSOLE_VERSION"
    return
  fi
  local url body tag
  url="https://api.github.com/repos/${REPO}/releases"
  body=$(curl -fsSL "$url" || die "cannot reach GitHub API at $url")
  if [ "${CASHOP_CONSOLE_PRERELEASE:-0}" = "1" ]; then
    tag=$(echo "$body" | grep '"tag_name":' | grep -m1 "\"${TAG_PREFIX}" \
        | sed -E "s/.*\"tag_name\": *\"${TAG_PREFIX}([^\"]+)\".*/\1/")
  else
    tag=$(echo "$body" \
        | grep -B1 '"prerelease": false' \
        | grep '"tag_name":' \
        | grep -m1 "\"${TAG_PREFIX}" \
        | sed -E "s/.*\"tag_name\": *\"${TAG_PREFIX}([^\"]+)\".*/\1/")
  fi
  [ -n "$tag" ] || die "could not determine latest ${TAG_PREFIX}* version from $url"
  echo "$tag"
}

download_tarball() {
  local version=$1 dest=$2
  local url="https://github.com/${REPO}/releases/download/${TAG_PREFIX}${version}/${ARTIFACT}-${version}.tar.gz"
  local attempt=1
  while [ $attempt -le 3 ]; do
    if curl -fsSL --retry 0 -o "$dest" "$url"; then
      return
    fi
    warn "download attempt $attempt failed; retrying in 2s"
    attempt=$((attempt + 1))
    sleep 2
  done
  die "failed to download $url after 3 attempts"
}

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

verify_checksum() {
  local tarball=$1 version=$2
  local sum_url="https://github.com/${REPO}/releases/download/${TAG_PREFIX}${version}/${ARTIFACT}-${version}.sha256"
  local expected actual
  expected=$(curl -fsSL "$sum_url" | awk '{print $1}')
  [ -n "$expected" ] || die "could not fetch checksum from $sum_url"
  actual=$(sha256_of "$tarball")
  if [ "$expected" != "$actual" ]; then
    die "checksum mismatch
  expected: $expected
  actual:   $actual"
  fi
}

extract() {
  local tarball=$1 version=$2
  CURRENT_LIB="$INSTALL_DIR/lib/${ARTIFACT}-${version}"
  mkdir -p "$INSTALL_DIR/lib" "$INSTALL_DIR/bin"
  rm -rf "$CURRENT_LIB"
  mkdir -p "$CURRENT_LIB"
  tar -xzf "$tarball" -C "$CURRENT_LIB"
}

install_deps() {
  log "installing dependencies"
  (
    cd "$CURRENT_LIB"
    npm install --omit=dev --no-audit --no-fund --loglevel=error
  )
}

create_symlink() {
  local version=$1
  local target="$INSTALL_DIR/lib/${ARTIFACT}-${version}/${ENTRY}"
  [ -f "$target" ] || die "entry point missing: $target"
  chmod +x "$target"
  ln -sfn "$target" "$INSTALL_DIR/bin/${BINARY}"
}

prune_old_versions() {
  local keep=2
  local lib="$INSTALL_DIR/lib"
  [ -d "$lib" ] || return 0
  # shellcheck disable=SC2012
  ls -1t "$lib" 2>/dev/null | tail -n +$((keep + 1)) | while read -r dir; do
    rm -rf "${lib:?}/${dir:?}"
  done
}

print_path_hint() {
  local bindir="$INSTALL_DIR/bin"
  case ":$PATH:" in
    *":$bindir:"*)
      log "PATH already contains $bindir"
      ;;
    *)
      cat <<HINT

  To run ${BINARY} from any directory, add this line to your shell profile
  (~/.zshrc or ~/.bashrc):

      export PATH="$bindir:\$PATH"

HINT
      ;;
  esac
}

smoke_test() {
  local version=$1
  local actual
  actual=$("$INSTALL_DIR/bin/${BINARY}" --version 2>/dev/null || true)
  if [ -z "$actual" ]; then
    die "installed binary did not produce --version output"
  fi
  case "$actual" in
    *"$version"*) ;;
    *) die "version mismatch after install (got '$actual', expected '$version')" ;;
  esac
}

main() {
  header
  check_os
  check_node
  check_tools

  local version
  version=$(resolve_version)
  log "installing ${BINARY} v${version}"

  TMPDIR_CASHOP=$(mktemp -d)

  local tarball="$TMPDIR_CASHOP/${ARTIFACT}-${version}.tar.gz"
  download_tarball "$version" "$tarball"
  verify_checksum "$tarball" "$version"
  extract "$tarball" "$version"
  install_deps
  create_symlink "$version"
  prune_old_versions
  smoke_test "$version"

  CURRENT_LIB=""

  log "installed ${BINARY} v${version} to $INSTALL_DIR"
  print_path_hint
}

main "$@"
