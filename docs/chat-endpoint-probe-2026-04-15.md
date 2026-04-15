# cashop-ai Chat Endpoint Probe (captured 2026-04-15)

Live probe of `POST /ai/cashop-ai/rpc/auth/chat/message` against stable
(`http://159.138.7.47`). Verifies P1 password token works against the chat
endpoint so P2 TUI can reuse the existing `AuthProvider.getAccessToken()`
without any backend change.

## Verdict

**A — SSE stream succeeds with P1 token.** No backend change required for P2.

## Request

```
POST http://159.138.7.47/ai/cashop-ai/rpc/auth/chat/message
Authorization: <P1 password accessToken, raw, no Bearer prefix>
Content-Type: application/json
Accept: text/event-stream
x-country: JP
x-currency: JPY
x-language: en

{"message":"hello"}
```

Token obtained via direct login call to
`POST /member/cashop-member-auth/open/auth/v1/login` with
`login-channel: app` + `device-id: cli-probe-<ts>` (same flow as
P1 `PasswordProvider.login`).

## Response

- Status: `HTTP/1.1 200 OK`
- `Content-Type: text/event-stream`
- `Transfer-Encoding: chunked`
- `Cache-Control: no-cache, no-store, must-revalidate`
- `X-Accel-Buffering: no`
- `X-Backward-G-Server: stable-gatekeeper`
- `Gatekeeper-Request-Id: 7785dd22387211f18988fa163ede027a`
- CORS: `Access-Control-Expose-Headers: Date, Gatekeeper-Request-Id, X-Backward-G-Server`

## Event sequence

```
data:{"type":"session_start","session_id":"b5ad9c9e26bb4131ba16f5036141a7a3"}

data:{"type":"typing"}

data:{"type":"text_delta","content":"Hello! How can I help you with your shopping today?"}

data:{"type":"suggestions","questions":["帮我找商品","查看购物车"]}

data:{"type":"done","session_id":"b5ad9c9e26bb4131ba16f5036141a7a3"}
```

Observed event types: `session_start`, `typing`, `text_delta`, `suggestions`, `done`.
All use `data:` (no space) and terminate with blank line. `session_id` is present
on both `session_start` and `done`, letting the TUI persist it after the stream
closes.

## Implications for P2 plan

- **Task 3 (sse-client):** Parser must handle `data:` without space and treat
  blank lines as event delimiter. Event types to classify (plan §3.5):
  - `session_start` → capture `session_id` for persistence
  - `typing` → render "..." spinner
  - `text_delta` → append `content` to assistant message bubble
  - `suggestions` → render chip row
  - `done` → close stream, mark session_id final
- **Task 10 (session persistence):** No need for a separate "create session"
  round-trip; `session_id` arrives with the first SSE event of a fresh chat.
- **Task 11 (ask command):** Reuse `AuthProvider.getAccessToken()` from P1
  directly — no new token acquisition path, no refresh dance needed (token
  valid 2h per login response `expireTime`).
- **No gatekeeper change needed:** `/ai/cashop-ai/*` prefix already routed
  (verified Task 0). Context-path `/ai/cashop-ai` is the Spring setting on
  cashop-ai itself; the gateway forwards with `strip-prefix: false`.

## Probe script (reproducible)

```bash
TOK=$(curl -sS -X POST "http://159.138.7.47/member/cashop-member-auth/open/auth/v1/login" \
  -H "Content-Type: application/json" -H "login-channel: app" \
  -H "device-id: cli-probe-$(date +%s)" \
  -d '{"email":"1@1.cn","password":"1234qwer","loginType":"emailPassword","channel":"app"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["accessToken"])')

curl -N -sS -X POST "http://159.138.7.47/ai/cashop-ai/rpc/auth/chat/message" \
  -H "Authorization: $TOK" -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -H "x-country: JP" -H "x-currency: JPY" -H "x-language: en" \
  -d '{"message":"hello"}'
```
