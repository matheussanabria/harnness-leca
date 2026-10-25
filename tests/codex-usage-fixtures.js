// Fixture helpers for the Codex rollout usage tests (not a test file). Every line carries SENTINEL strings in
// prompt, reply, tool output, instructions and cwd; tests assert they never reach the store, stats or endpoint.
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const SENTINEL = "SENTINEL_CODEX_PROMPT_41aa";
const SENTINEL_REPLY = "SENTINEL_CODEX_REPLY_52bb";
const SENTINEL_PATH = "SENTINEL_CODEX_PATH_63cc";

let counter = 0;
/** A deterministic-looking uuid per call. */
function uuid() {
  counter += 1;
  return `0198a000-0000-4000-8000-${String(counter).padStart(12, "0")}`;
}

/** @param {Record<string, any>} u @returns {Record<string, any>} */
const usage = (u) => ({
  input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, total_tokens: 0, ...u,
});

/** @param {string} id @param {{ subagent?: boolean, ts?: string }} [o] */
function metaLine(id, o = {}) {
  return JSON.stringify({
    timestamp: o.ts || "2026-10-20T10:00:00.000Z", type: "session_meta",
    payload: {
      id, cwd: `C:\\work\\${SENTINEL_PATH}`, originator: "codex_cli", cli_version: "0.0.0",
      source: o.subagent ? { subagent: { thread_spawn: { parent: "x" } } } : "exec",
      base_instructions: { text: `${SENTINEL} base instructions` },
    },
  });
}

/** @param {string} model */
const turnLine = (model) => JSON.stringify({
  timestamp: "2026-10-20T10:00:01.000Z", type: "turn_context",
  payload: { cwd: `C:\\work\\${SENTINEL_PATH}`, model, user_instructions: `${SENTINEL} be nice`, summary: SENTINEL_REPLY },
});

/**
 * One token_count event. `last` is the per-call usage, `total` the running total of the thread.
 * @param {{ ts?: string, last: Record<string, any>, total?: Record<string, any> | null, nullInfo?: boolean }} o
 */
function tokenLine(o) {
  const info = o.nullInfo ? null : { last_token_usage: usage(o.last), total_token_usage: o.total === null ? undefined : usage(o.total || o.last), model_context_window: 1000 };
  return JSON.stringify({ timestamp: o.ts || "2026-10-20T10:00:02.000Z", type: "event_msg", payload: { type: "token_count", info, rate_limits: { primary: { used_percent: 1 } } } });
}

const messageLine = () => JSON.stringify({
  timestamp: "2026-10-20T10:00:01.500Z", type: "response_item",
  payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: `${SENTINEL_REPLY} token_count mentioned in text` }] },
});

/** Creates ~/.codex-like home with state_5.sqlite and returns helpers. @param {string} home */
function makeHome(home) {
  fs.mkdirSync(home, { recursive: true });
  const db = new DatabaseSync(path.join(home, "state_5.sqlite"));
  db.exec("CREATE TABLE threads (id TEXT PRIMARY KEY, cwd TEXT, title TEXT); CREATE TABLE thread_spawn_edges (parent_thread_id TEXT, child_thread_id TEXT)");
  db.close();
  return {
    /** @param {string} id @param {string} cwd @param {string} [parent] */
    addThread(id, cwd, parent) {
      const d = new DatabaseSync(path.join(home, "state_5.sqlite"));
      d.prepare("INSERT INTO threads (id, cwd, title) VALUES (?, ?, ?)").run(id, cwd, SENTINEL);
      if (parent) d.prepare("INSERT INTO thread_spawn_edges (parent_thread_id, child_thread_id) VALUES (?, ?)").run(parent, id);
      d.close();
    },
    /** @param {string} id @param {string[]} lines @param {{ day?: string, mtimeMs?: number, append?: boolean }} [o] */
    rollout(id, lines, o = {}) {
      const dir = path.join(home, "sessions", ...(o.day || "2026/10/20").split("/"));
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `rollout-2026-10-20T10-00-00-${id}.jsonl`);
      const text = `${lines.join("\n")}\n`;
      if (o.append) fs.appendFileSync(file, text);
      else fs.writeFileSync(file, text);
      if (o.mtimeMs) fs.utimesSync(file, o.mtimeMs / 1000, o.mtimeMs / 1000);
      return { file, bytes: Buffer.byteLength(text) };
    },
  };
}

module.exports = { SENTINEL, SENTINEL_REPLY, SENTINEL_PATH, uuid, metaLine, turnLine, tokenLine, messageLine, makeHome };
