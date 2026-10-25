// @ts-check
// Tests — Central read model merged with the EP-09 projection, plus UI rendering (story T2.5).

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-central-proj-"));
process.env.HARNESS_ROOT = ROOT;

const { appendEvent, closeStore } = require("../ui/server/services/events/event-store");
const { readCentral } = require("../ui/server/services/canonical-sessions/session-registry-orchestrator.service");
const { mergeProjection } = require("../ui/server/services/canonical-sessions/session-projection-merge");
const { makeSession } = require("../ui/server/services/canonical-sessions/session-model");
const registry = require("../ui/server/services/canonical-sessions/session-registry.service");

const SLUG = "tmp-central-proj";
test.before(() => fs.mkdirSync(path.join(ROOT, "projects", SLUG), { recursive: true }));
test.after(() => {
  closeStore(SLUG);
  fs.rmSync(ROOT, { recursive: true, force: true, maxRetries: 3, retryDelay: 60 });
});

const external = (native, extra = {}) => ({
  type: "session.discovered", sessionId: `claude:${native}`, nativeSessionId: native, idempotencyKey: `d|${native}`,
  trust: "inferred",
  payload: { origin: "external", provider: "claude", activity: "processing", presence: "connected", lastActivityAt: "2026-10-24T10:00:00.000Z", ...extra },
});

test("merge: external + chat + markdown, deduplicated by fingerprint and exact id", () => {
  const markdown = makeSession({ id: "claude|nat-1|markdown", projectId: SLUG, projectConfidence: "explicit", title: "Chat salvo", primaryProvider: "claude" });
  const solo = makeSession({ id: "gemini|g-1|markdown", projectId: SLUG, title: "Outra", primaryProvider: "gemini" });
  const views = [
    { sessionId: "claude:nat-1", nativeSessionId: "nat-1", provider: "claude", origin: "external", activity: "idle", presence: "connected", lastActivityAt: "2026-10-24T09:00:00.000Z" },
    { sessionId: "claude:nat-2", nativeSessionId: "nat-2", provider: "claude", origin: "external", activity: "processing", presence: "connected", lastActivityAt: "2026-10-24T10:00:00.000Z" },
    { sessionId: "chat:run1", nativeSessionId: "run1", provider: "claude", origin: "harness_chat", executionStatus: "running", lastEventAt: "2026-10-24T11:00:00.000Z" },
    { sessionId: "gemini|g-1|markdown", provider: "gemini", lastEventAt: "2026-10-24T08:00:00.000Z" },
  ];
  const merged = mergeProjection([markdown, solo], views, { projectId: SLUG });
  assert.equal(merged.length, 4, "markdown + solo + 2 new rows, no duplicates");
  const dup = merged.find((s) => s.id === markdown.id);
  assert.equal(dup.title, "Chat salvo", "markdown title and explicit link are kept");
  assert.equal(dup.projectConfidence, "explicit");
  assert.equal(dup.activity, "idle");
  assert.equal(dup.source, "merged");
  const ext = merged.find((s) => s.id === "claude:nat-2");
  assert.equal(ext.projectConfidence, "inferred", "scanner sessions are inferred, never explicit");
  assert.equal(ext.origin, "external");
  assert.match(ext.title, /^claude nat-2/);
  const chat = merged.find((s) => s.id === "chat:run1");
  assert.equal(chat.executionStatus, "running");
  assert.equal(chat.origin, "harness_chat");
});

test("merge: a different engine with the same native id is not linked", () => {
  const markdown = makeSession({ id: "gemini|same|markdown", primaryProvider: "gemini" });
  const merged = mergeProjection([markdown], [{ sessionId: "claude:same", nativeSessionId: "same", provider: "claude", origin: "external" }]);
  assert.equal(merged.length, 2);
  assert.equal(merged.find((s) => s.id === "gemini|same|markdown").activity, undefined);
});

test("readCentral counts the merged list in totals, filters and attention", () => {
  registry.upsertSessions(SLUG, [makeSession({ id: "claude|nat-1|markdown", projectId: SLUG, primaryProvider: "claude", title: "Chat salvo" })]);
  appendEvent(SLUG, external("nat-1"));
  appendEvent(SLUG, external("nat-2"));
  appendEvent(SLUG, { type: "usage.observed", sessionId: "claude:ghost", nativeSessionId: "ghost", idempotencyKey: "u|1", payload: { callId: "c1" } });
  appendEvent(SLUG, { type: "attention.opened", sessionId: "claude:nat-2", idempotencyKey: "a|1", payload: { id: "a1" } });
  const all = readCentral(SLUG, {});
  assert.equal(all.totals.total, 2, "nat-1 deduplicated, ghost usage ignored");
  assert.equal(all.totals.byOrigin.external, 2);
  assert.equal(all.attention.count, 1);
  const open = readCentral(SLUG, { attentionStatus: "open" });
  assert.equal(open.totals.total, 1);
  assert.equal(open.sessions[0].id, "claude:nat-2");
  assert.equal(readCentral(SLUG, { projectConfidence: "inferred" }).totals.total, 1);
  assert.equal(readCentral(SLUG, { provider: "claude" }).totals.total, 2);
});

test("UI renders activity, presence, origin and last activity in list, kanban and detail", async () => {
  const dir = path.resolve(__dirname, "..", "ui", "public", "js", "modules");
  const view = await import(pathToFileURL(path.join(dir, "central-sessions-view.js")).href);
  const session = {
    id: "claude:nat-2", title: "claude nat-2", primaryProvider: "claude", projectId: SLUG, projectConfidence: "inferred",
    executionStatus: "unknown", workflowStatus: "none", attentionStatus: "none", origin: "external",
    activity: "processing", presence: "connected", lastActivityAt: "2026-10-24T10:00:00.000Z",
  };
  const params = { slug: SLUG, view: "list", query: "", filters: {}, options: {}, sessions: [session], detail: null, selectedId: "claude:nat-2", generatedAt: "", source: "live" };
  const list = view.renderCentral(params);
  const kanban = view.renderCentral({ ...params, view: "kanban" });
  for (const html of [list, kanban]) {
    assert.match(html, /Processando/);
    assert.match(html, /Conectada/);
    assert.match(html, /externa/);
    assert.doesNotMatch(html, /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u);
  }
  assert.match(list, /Última atividade/);
  assert.match(list, /1 com vínculo inferido|1\s+com vínculo inferido/);
  const markdownOnly = view.renderCentral({ ...params, sessions: [{ ...session, origin: undefined, activity: undefined, presence: undefined, lastActivityAt: undefined, lastObservedAt: "2026-10-21T10:00:00.000Z" }] });
  assert.doesNotMatch(markdownOnly, /externa<|chat do Harness</);
});
