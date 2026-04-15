# cashop-ai Response Shape Findings (2026-04-15, during Task 12 live smoke)

P2 plan assumed all gateway responses follow the cashop envelope
`{code, success, message, extAttrs, data}`. Live smoke exposed two deviations
in cashop-ai REST responses; both are fixed in http-client via a new `raw: true`
flag.

## 1. `GET /ai/cashop-ai/rpc/auth/sessions` returns bare JSON

Response body is a bare object `{"sessions": []}` (not wrapped in the envelope).
The controller is `com.cashop.agent.web.SessionController.listSessions` →
`ResponseEntity.ok(Map.of("sessions", sessions))`.

Without `raw: true`, `parseEnvelope` parsed the body as an Envelope with
`code=undefined, success=undefined`, which tripped the business-failure branch
and threw `BusinessError("[undefined] undefined")`.

**Fix applied** (`src/commands/sessions.ts`): added `raw: true` so http-client
skips envelope parsing for this endpoint.

## 2. `DELETE /ai/cashop-ai/rpc/auth/sessions/{id}` likewise bare

On success `cashop-ai` returns `{"success": true}`. On failure (404 session
missing / 403 ownership) gatekeeper wraps the 4xx with its own envelope
`{code: 800xxx, message: "Frontend Request Error", success: false}` (see
`cashop-gatekeeper/pkg/upstream/filter/routing_filter.go:127-131`). The
non-2xx is caught by `throwHttp` with our `ForbiddenError` / `NotFoundError`
classes, which is correct behaviour (smoke Step 6 verifies wire-level
reachability by accepting exit codes 0/1/5/6 as "CLI wiring OK").

**Fix applied** (`src/commands/session.ts`): added `raw: true` for the DELETE
success path (empty or `{"success":true}` body).

## 3. Separate backend bug (out of P2 scope, documented here for follow-up)

Files: `cashop-ai/src/main/java/com/cashop/agent/session/RedisSessionService.java:108`
and `cashop-ai/src/main/java/com/cashop/agent/dao/entity/AgentSessionEntity.java:25`.

`RedisSessionService.createSession` calls
`new AgentSessionEntity(id, appName, userId, initialState)` — but the entity
constructor is `AgentSessionEntity(String id, String appName, String clientId, Map state)`.
The `userId` argument is stored into `this.clientId`, so the `user_id` column
in `agent_session` stays `NULL` on insert. `selectByUserId(userId)` therefore
returns `[]` for every authenticated user, and `deleteSession` always trips
the `session.getUserId().equals(userId)` ownership check and returns 403.

`updateUserId(sessionId, newUserId)` in `appendEvent` (line 224) would fix
this retroactively, but only runs when an agent emits a `stateDelta.userId`
event — which is not happening in the current Gemini flow.

**Consequence for P2 CLI**: `cashop sessions` returns `[]`, and
`cashop session rm <id>` returns 403 even for sessions the user just created.
Both CLI commands are wired correctly; the UX impact is backend-bound and
should be filed against cashop-ai.

## 4. `POST /ai/cashop-ai/rpc/auth/chat/message` — SSE path unaffected

The chat endpoint still returns `text/event-stream`; our `streamChat` parses
blocks directly and does not go through envelope logic. Observed one
transient `500 {"code":700001,"message":"Internal Server Error"}` on a cold
request — retrying immediately succeeded. Likely Gemini cold-start or quota
spike; not a persistent bug. P2 does not add retry for SSE (YAGNI); if this
becomes frequent, revisit in P2.1.
