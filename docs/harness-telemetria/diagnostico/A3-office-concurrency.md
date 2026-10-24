# A3 - Office telemetry concurrency diagnosis

Scope: verify the hypothesis in `docs/harness-telemetria-resumo-executivo-pre-plano.md` (sections 3, 5, 9) that
`office-agent-telemetry.js` collapses concurrent executions of one engine into a single 0/1 state.
Labels: [V] verified-in-code, [R] reproduced, [A] assumption.
Paths are relative to `ui/public/js/` unless noted.

## 1. Verdict

- The overwrite bug is real at the module level [R]: with two chats on the same engine, finishing one sets the
  engine to `idle` / `activeCount=0` while the other still streams.
- A second finding is larger than the hypothesis: in production the chat-to-office bridge probably never fires,
  because the office runs in a different document than the chat [V + A, see F4].
- EP-09 projections are not consumed by any UI code yet [V, F7].

## 2. Data flow (text diagram)

```
Chat page (index.html)                        Office page (office.html -> /office, /escritorio)
-----------------------------------------     ------------------------------------------------
chat-send.js:200  setChatStreaming(..,eng)    office-app.js:200  bindOfficeStateTelemetry(officeState)
chat-send.js:206  setChatAbortController      office-app.js:201  bindChatExecutionTelemetry()
chat-send.js:287-288 finally: ctrl=null,                |
                     setChatStreaming(false)            v
chat-stream-ui.js:70/76 setChatExecutionStatus   subscribeAllChatExecutions (store.js:61)
        |                                          globalListeners = Set in module memory
        v                                                |
modules/chat-execution-store.js                          v
  executionByChat Map<slug+chatId, exec> (:9)    telemetry.js:94-99  snapshot.currentEngine -> engine
  exec = {status, streaming, currentEngine,      telemetry.js:58-67  syncAgentFromChatExecution
          controllers: Map<engine, AbortCtl>}         activeCount = working ? 1 : 0   (LAST WRITER WINS)
  notifyExecution (:38-59) -> globalListeners              |
   (snapshot has slug, chatId, status,                     v
    currentEngine, controllersCount)  ---------> office-agent-state.js:128 setAgentState
                                                  (keyed by ENGINE only; no slug/chatId identity)
Server poll (separate path):                               |
 agent-activity.service.js -> office-state.js:128          v
 activeAgents -> telemetry.js:73-87 syncAgentsFromActivity (skipped while status is
                 streaming / waiting_approval, :79)
                                                           |
consumers: office2d/iso-agent-desks.js:16-21, office/office-hud-controller.js:176-199,
           office/office-desk-dossier.js:12-81, 3D pad color / avatar pose via telemetry helpers
```

## 3. Findings

### F1. Per-engine state fed by per-chat events, no aggregation [V, R]
- The store is keyed per `slug+chatId` (`modules/chat-execution-store.js:9,24-28`), so the store is correct.
- The bridge forwards every chat snapshot to a single engine key (`office/office-agent-telemetry.js:94-99`) and
  writes `activeCount: working ? 1 : 0` (`:62-66`). `setAgentState` merges by engine only
  (`office/office-agent-state.js:128-143`). Nothing counts how many chats are working.
- `notifyExecution` already passes `slug` and `chatId` to global listeners (`store.js:56-58`), so the identity
  needed to aggregate is available at the bridge; the bridge discards it (`telemetry.js:95-97`).

### F2. Repro result [R]
Scratch script (outside the repo):
`C:\Users\MATHEU~1.ROD\AppData\Local\Temp\claude\c--Users-matheuss-rodrigues-git-harness-leca\e108ead2-403d-4728-9d49-5023e564a272\scratchpad\repro.mjs`
It imports the real modules via file URLs, calls `bindChatExecutionTelemetry()`, then drives the store.

```
A starts (claude)                  streaming activeCount=1
B starts (claude)                  streaming activeCount=1     <- should be 2
A finishes, B still streaming      idle activeCount=0          <- BUG: office shows claude idle
store: A= idle  B= streaming                                   <- store is right, bridge is wrong
A errors, B streaming              error activeCount=0         <- one chat's error masks the other
```
Scenario "two Claude executions, one finishes": chats A and B (same or different project) both use `claude`;
A completes through `setChatStreaming(slug, A, false)` (`chat-send.js:288`); the office LED, pad and avatar go
idle although B still streams. Deterministic, no timing involved.

### F3. Compare mode is invisible to the office [V, R]
`chat-send.js:80` sets `currentEngine = "compare"`, which is not in `AGENT_KEYS`, so
`syncAgentFromChatExecution` returns null (`telemetry.js:59`). The repro line "compare start" showed no change.
`setStreamingUI(true)` (`chat-stream-ui.js:74-76`) is called right after (`chat-send.js:81`) and re-invokes
`setChatStreaming(..., cs.currentEngine)`, which may replace `"compare"` with the selected engine [A, runtime
value of `cs.currentEngine` not exercised]. Per-engine compare streams only touch `controllers`
(`chat-send.js:87,171`); no engine key is updated for them [V].

### F4. Cross-document isolation (likely the dominant problem) [V + A]
- `office.html:308` loads `/js/office-app.js` as its own module graph, served at `/office` and `/escritorio`
  (`ui/server/controllers/static.controller.js:8`). No file under `office/`, `office2d/`, `office3d/`,
  `window-manager/` or `office-app.js` imports chat modules (grep: no matches), and `window-registry.js:150-156`
  holds metadata only for module `chat`.
- `chat-execution-store.js` keeps state in module-level `Map`/`Set` (`:9-11`) with no BroadcastChannel,
  localStorage or postMessage (grep: 0 hits). The office page therefore imports its own empty store instance;
  a chat running in the index.html tab never reaches the office `globalListeners`.
- Assumption [A]: the user opens `/office` in a different tab/window than the chat. If office were embedded in
  the chat document (no evidence found), only F1 applies. The unit test `tests/office-agent-state.test.js:146-167`
  passes because both ends run in one Node process.
- In practice the office shows server polling data (`office-state.js:128` -> `syncAgentsFromActivity`), which is
  heuristic (F5), not live chat telemetry.

### F5. Server activity summary is heuristic [V]
`ui/server/services/agent-activity.service.js:115`: `activeCount = Math.max(veryRecent.length > 0 ? 1 : 0, 1)`
is always >= 1 for Claude and status is forced to `"active"` (`:116`). Gemini and OpenCode counts come from file
mtimes / SQLite recency (`:68-78,126-133`). The office "claude is busy" signal is not tied to HTTP chat
executions. `office/office-desk-dossier.js:21-53,81` also falls back to hard-coded mock counts and `|| 1`.

### F6. Backend has no registry of live chat executions [V]
`ui/server/controllers/chat.controller.js:9,83-89` keeps only a global in-process `runningChats` counter (cap),
with no engine/slug/chatId breakdown. `POST /api/chat` does not call `publish` (the only `publish(` callers
found: `central-events.controller.js:109`, `session-registry-orchestrator.service.js:23`).
`execution.started` events come from file-polling adapters (`claude-adapter.js:72`, `gemini-adapter.js:67`,
`opencode-adapter.js:73`) and `workflow-runner.service.js:85,99`, not from the interactive chat.

### F7. EP-09 projections not consumed by UI [V]
- Server side exists: route `ui/server/routes/central-events.routes.js:12`, controller
  `central-events.controller.js:56-68` (sessions, workflows, attention, cursor), SSE
  `/api/project/:slug/sessions/stream` (`:71-87`), projector `services/events/event-projector.js:25-168`.
- Grep under `ui/public/js` for `projections|event-projector|sessions/stream`: no hits. The only `EventSource`
  users are `office-state.js:72` (`/api/orchestration/stream`, the older orchestration engine) and
  `modules/services.js:168` (service logs). Neither office nor chat reads the EP-09 contract.
- The projector's `executionStatus` is per session (`event-projector.js:33-34`); it has no per-engine counter,
  so consuming it would still need aggregation by engine.

## 4. Coupling assessment

| Fix | Backend registry needed? | Size | Notes |
|---|---|---|---|
| F1 same-document overwrite | No | Small, isolated to `office-agent-telemetry.js` (+ tests) | Identity already in snapshot |
| F3 compare mode | No | Small | Needs a decision on semantics |
| F4 cross-tab | Client channel or backend | Medium | BroadcastChannel or server source |
| F5/F6 server truth | Yes | Medium/large | Publish chat executions as EP-09 events and consume them |

F1 is isolated and should not be coupled to F4-F6.

## 5. Minimal-fix options

- Option A (F1 only, bridge-local): in `bindChatExecutionTelemetry`, keep `Map<engine, Map<slug|chatId, status>>`
  of working chats. On each snapshot, update or delete the entry, then set `activeCount = size`, status by
  priority (`waiting_approval` > `streaming` > `error` only when none working > `idle`), `currentTask` from the
  count. Keep the `syncAgentFromChatExecution` signature for existing tests. Gap: `resetChatExecution`
  (`store.js:128-132`) deletes the entry and `notifyExecution` returns early (`:41`), so listeners never see the
  removal; prune explicitly or emit a reset notification. About 40 lines; put it in a new submodule to respect
  the 250-line limit. Tests: two chats / one finishes / error in one chat / reset.
- Option B (F1, single source of truth): export `countActiveByEngine()` from the store, computed from
  `executionByChat`, and have the bridge call it after each notification (+~15 lines in the store). Preferred if
  touching the store is acceptable.
- Option C (F4): publish snapshots through `BroadcastChannel` from the chat tab and subscribe in the office tab.
  Same-origin, no backend; state is lost when the chat tab closes. [A: browser support not verified.]
- Option D (durable): `POST /api/chat` publishes `execution.*` events with engine, slug, chatId (EP-09
  `publish`); office consumes `/projections` + SSE; projector adds an aggregate per engine. Largest scope; the
  real fix for restarts, multi-tab and multi-device.

## 6. Blocking questions

1. Does the office run in the same document as the chat, or only as `/office` in its own tab? This decides if
   F4 is in scope (A/B vs C/D).
2. Should `activeCount` mean "chats working now for this engine" (browser-local) or "executions known to the
   server" (including terminal sessions from `agent-activity.service.js`)? The sources disagree (F5), and
   `syncAgentsFromActivity` overwrites counts whenever the engine is not transient (`telemetry.js:79-85`).
3. Compare mode: should the office show each compared engine as working? Today it shows none (F3).
4. Is `Math.max(..., 1)` at `agent-activity.service.js:115` intentional (always-on terminal)?
5. Must state survive chat-tab close or server restart? (Only Option D covers that.)

## 7. Not verified

- Whether chat and office run in separate documents at runtime (static evidence only).
- Runtime value of `cs.currentEngine` in compare mode (F3 overwrite case).
- `tests/chat-execution-sync.test.js` and `tests/chat-execution-hardening.test.js` were located but not read in
  detail. `tests/office-agent-state.test.js` has no multi-chat case for the bridge (all cases single-chat).
