#!/usr/bin/env bash
set -euo pipefail

CLI="node dist/entry.js"
: "${CASHOP_TEST_EMAIL:?set CASHOP_TEST_EMAIL}"
: "${CASHOP_TEST_PASSWORD:?set CASHOP_TEST_PASSWORD}"

export CASHOP_CLI_BACKEND="${CASHOP_CLI_BACKEND:-file}"
export HOME="${SMOKE_HOME:-$(mktemp -d -t cashop-cli-chat-smoke-XXXXXX)}"
echo "Using HOME=$HOME  CASHOP_CLI_BACKEND=$CASHOP_CLI_BACKEND"

echo "-- 1. login --"
$CLI login --email "$CASHOP_TEST_EMAIL" --password "$CASHOP_TEST_PASSWORD" --json > /dev/null

echo "-- 2. ask one-shot --"
OUT=$($CLI ask "hello" --json 2>/dev/null | head -50)
echo "$OUT" | grep -q '"type":"text_delta"'

echo "-- 3. chat.yaml has last_session_id after ask --"
test -f "$HOME/.cashop/chat.yaml"
grep -q 'last_session_id' "$HOME/.cashop/chat.yaml"

echo "-- 4. sessions list --"
# sessions 命令已 unwrap 为顶层数组，便于脚本管道
$CLI sessions --json | node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8"));if(!Array.isArray(d))process.exit(1);'

echo "-- 5. ask --resume continues same session --"
SID_BEFORE=$(grep last_session_id "$HOME/.cashop/chat.yaml" | awk '{print $2}')
$CLI ask "continue" --resume --json > /dev/null
SID_AFTER=$(grep last_session_id "$HOME/.cashop/chat.yaml" | awk '{print $2}')
test "$SID_BEFORE" = "$SID_AFTER"

echo "-- 6. session rm (wire-level only) --"
# cashop-ai 后端存在已知 bug：AgentSessionEntity 构造形参顺序把 userId 传给了 clientId 字段，
# 导致 agent_session.user_id 保持 NULL，此时 DELETE /sessions/{id} 的 ownership 校验会走 403。
# 这是后端 bug，不影响 P2 CLI 的命令 wiring。smoke 只确认 CLI 能把请求发出去（拿到一个 200 或 4xx）。
set +e
$CLI -y session rm "$SID_AFTER" --json > /tmp/cashop-rm.out 2> /tmp/cashop-rm.err
RM_EXIT=$?
set -e
if [ "$RM_EXIT" -eq 0 ] || [ "$RM_EXIT" -eq 5 ] || [ "$RM_EXIT" -eq 6 ] || [ "$RM_EXIT" -eq 1 ]; then
  echo "   session rm exit=$RM_EXIT (0=success / 5=forbidden / 6=not-found / 1=business-err; wire OK)"
else
  echo "   session rm exit=$RM_EXIT is NOT an expected wire-level outcome"
  cat /tmp/cashop-rm.err >&2
  exit 1
fi

echo "-- 7. logout --"
$CLI logout --json > /dev/null

echo "-- SMOKE-CHAT PASS --"
