// @ts-check
// EP-23.04: an answer cut short keeps its partial text, shows "Interrompida" with the reason, and offers "Retomar"
// (same engine session, new run linked by resumed_from) and "Reenviar" (the original message again).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "harness-interrupted-"));
process.env.HARNESS_ROOT = TMP;
process.env.HARNESS_ENGINE_HOST = "0";
fs.mkdirSync(path.join(TMP, "projects", "demo"), { recursive: true });
fs.mkdirSync(path.join(TMP, "global"), { recursive: true });

const ui = await import("../ui/public/js/modules/chat-interrupted.js");
const { createTestDatabase } = require("../ui/server/db/connection");
const { createChatRunsRepo } = require("../ui/server/db/repos/chat-runs.repo");
const journal = require("../ui/server/services/chat-run-journal.service");
const { registerRun, resetRunsForTests } = require("../ui/server/services/chat-run-registry.service");
const { attachRun } = require("../ui/server/services/engine-host/sse");

test.after(() => {
  journal.setJournal(undefined);
  // The run tracker writes the project event log (SQLite); on Windows an open handle blocks the removal.
  require("../ui/server/services/events/event-store").closeStore("demo");
  require("../ui/server/db/connection").closeDb();
  require("./helpers/temp-dir").removeDir(TMP);
});

const tick = () => new Promise((resolve) => setImmediate(resolve));
function memoryJournal() {
  const repo = createChatRunsRepo(createTestDatabase());
  journal.setJournal(repo);
  return repo;
}
function fakeRes() {
  const res = {
    events: /** @type {any[]} */ ([]), writableEnded: false, destroyed: false, handlers: /** @type {any} */ ({}),
    writeHead() {}, flushHeaders() {},
    on(/** @type {string} */ name, /** @type {Function} */ fn) { res.handlers[name] = fn; },
    write(/** @type {string} */ chunk) { if (String(chunk).startsWith("data: ")) res.events.push(JSON.parse(String(chunk).slice(6))); },
    end() { res.writableEnded = true; res.handlers.close?.(); },
  };
  return res;
}

const turns = () => [
  { role: "user", text: "Resumo curto", fullPrompt: "Prompt completo do PRD" },
  ui.markInterrupted({ role: "assistant", engine: "opencode", text: "Parte da resposta", phase: "answering" }, { type: "error", code: "interrupted", reason: "restart", interrupted: true }, { runId: "run-1" }),
];

test("an interrupted turn keeps its text and renders the label, the reason and both buttons", () => {
  const [, turn] = turns();
  assert.equal(turn.text, "Parte da resposta");
  assert.equal(turn.errorInfo, undefined);
  const html = ui.interruptedHtml(turn, 1, { canResume: true });
  assert.match(html, /fa-solid fa-circle-pause/);
  assert.match(html, /Interrompida/);
  assert.match(html, /O servidor reiniciou antes do fim/);
  assert.match(html, /resumeInterruptedTurn\(1, this\)/);
  assert.match(html, /resendInterruptedTurn\(1, this\)/);
  assert.match(html, /<button type="button"/, "real buttons: reachable by keyboard");
  assert.doesNotMatch(html, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, "no emojis");
});

test("without an engine session only Reenviar is offered; once used, the buttons go away", () => {
  const [, turn] = turns();
  const html = ui.interruptedHtml(turn, 1, { canResume: false });
  assert.doesNotMatch(html, /resumeInterruptedTurn/);
  assert.match(html, /Reenviar/);
  turn.interrupted.handled = true;
  assert.doesNotMatch(ui.interruptedHtml(turn, 1, { canResume: true }), /<button/);
  assert.match(ui.interruptedHtml(turn, 1, { canResume: true }), /Interrompida/);
});

test("Retomar continues in the session without repeating the message; Reenviar sends the original prompt", () => {
  const list = turns();
  assert.deepEqual(ui.interruptedAction("resume", list, 1, "ses_1"), { prompt: ui.RESUME_PROMPT, displayText: ui.RESUME_BUBBLE, resumedFrom: "run-1" });
  assert.deepEqual(ui.interruptedAction("resend", list, 1, "ses_1"), { prompt: "Prompt completo do PRD" });
  assert.deepEqual(ui.interruptedAction("resume", list, 1, null), { prompt: "Prompt completo do PRD" }, "no session: falls back to resend");
  assert.equal(ui.interruptedAction("resume", list, 0, "ses_1"), null, "a user turn is not interrupted");
});

test("only the interruption event is treated as interrupted, not ordinary engine errors", () => {
  assert.equal(ui.isInterruption({ type: "error", code: "stopped", interrupted: true }), true);
  assert.equal(ui.isInterruption({ type: "error", code: "interrupted" }), true, "journal replay of an older run");
  assert.equal(ui.isInterruption({ type: "error", code: "rate_limit" }), false);
  assert.equal(ui.isInterruption({ type: "done" }), false);
});

test("a run stopped without an answer ends with a final event: live, in the journal and on a late attach", async () => {
  const repo = memoryJournal();
  resetRunsForTests();
  const run = registerRun("run-stop", { abort() {}, meta: { project: "demo", engine: "claude" } });
  const live = fakeRes();
  run.attach(/** @type {any} */ (live), 0);
  run.push({ type: "text", text: "meio" });
  await tick();
  run.stop();
  const last = live.events.at(-1);
  assert.equal(last.type, "error");
  assert.equal(last.reason, "user");
  assert.equal(last.interrupted, true);
  assert.equal(repo.hasTerminalEvent("run-stop"), true);
  resetRunsForTests(); // the run left memory: the attach is served by the journal
  const late = fakeRes();
  assert.equal(attachRun(/** @type {any} */ (late), "run-stop", 0), true);
  assert.deepEqual(late.events.map((e) => e.type), ["text", "error"]);
  assert.equal(late.events[0].text, "meio", "the partial answer comes back");
});

test("a run of a process that died is replayed as interrupted by a restart, never as 'expirou'", () => {
  const repo = memoryJournal();
  resetRunsForTests();
  repo.startRun({ runId: "run-dead", project: "demo", engine: "claude" });
  repo.appendEvents("run-dead", [{ seq: 0, type: "text", text: "parcial" }]);
  repo.markInterruptedOnBoot();
  const res = fakeRes();
  attachRun(/** @type {any} */ (res), "run-dead", 0);
  const last = res.events.at(-1);
  assert.equal(last.code, "interrupted");
  assert.equal(last.reason, "restart");
  assert.doesNotMatch(JSON.stringify(res.events), /expirou/);
  assert.equal(attachRun(/** @type {any} */ (fakeRes()), "never-existed", 0), false, "404 only for a run that never existed");
});

test("Retomar starts a new run linked to the interrupted one and passes the engine session", async () => {
  const repo = memoryJournal();
  resetRunsForTests();
  const E = require("../tools/lib/engines");
  /** @type {any[]} */
  const seen = [];
  E.engines.set("fakeresume", { id: "fakeresume", status: async () => ({}), stream: (/** @type {any} */ args) => { seen.push(args); args.onDone({ sessionId: args.sessionId, fullText: "continuação" }); } });
  try {
    const { startChatRun } = require("../ui/server/services/engine-host/run-starter");
    const started = startChatRun({ engine: "fakeresume", prompt: ui.RESUME_PROMPT, slug: "demo", sessionId: "ses_1", resumedFrom: "run-1" }, { permissionUrl: "http://127.0.0.1:1" });
    assert.ok("runId" in started, JSON.stringify(started));
    await tick();
    assert.equal(repo.getRun(started.runId).resumedFrom, "run-1");
    assert.equal(seen[0].sessionId, "ses_1", "the same engine session is resumed");
    const bad = startChatRun({ engine: "fakeresume", prompt: "x", slug: "demo", resumedFrom: "../etc" }, { permissionUrl: "http://127.0.0.1:1" });
    await tick();
    assert.equal(repo.getRun(/** @type {any} */ (bad).runId).resumedFrom, null, "an invalid id is ignored");
  } finally {
    E.engines.delete("fakeresume");
  }
});
