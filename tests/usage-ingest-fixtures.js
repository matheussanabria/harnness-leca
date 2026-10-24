// Fixture helpers for the usage ingest tests (not a test file). Every line carries SENTINEL strings in
// prompt, response, tool output and cwd; tests assert they never reach the store, stats or endpoint.
const fs = require("fs");
const path = require("path");

const SENTINEL = "SENTINEL_PROMPT_9f3a";
const SENTINEL_REPLY = "SENTINEL_REPLY_77b1";
const SENTINEL_PATH = "SENTINEL_PATH_c0de";

/** @param {Record<string, any>} o */
function assistantLine(o) {
  const usage = { service_tier: "standard", ...o.usage };
  if (o.out !== undefined) usage.output_tokens = o.out;
  if (o.input !== undefined) usage.input_tokens = o.input;
  if (o.cacheRead !== undefined) usage.cache_read_input_tokens = o.cacheRead;
  if (o.cacheCreation !== undefined) usage.cache_creation_input_tokens = o.cacheCreation;
  return JSON.stringify({
    parentUuid: "p", isSidechain: Boolean(o.sidechain), type: "assistant", uuid: `u-${Math.random()}`,
    timestamp: o.ts || "2026-10-20T10:00:00.000Z", cwd: `C:\\work\\${SENTINEL_PATH}`, sessionId: "from-line",
    requestId: o.requestId || `req-${o.id}`, ...(o.agentId ? { agentId: o.agentId } : {}),
    message: {
      id: o.id, model: o.model || "claude-sonnet-5-5", role: "assistant", stop_reason: o.stop || null,
      content: [{ type: "text", text: `${SENTINEL_REPLY} ${o.id}` }, { type: "tool_use", input: { file_path: `/x/${SENTINEL_PATH}` } }],
      ...(o.noUsage ? {} : { usage }),
    },
  });
}

function userLine() {
  return JSON.stringify({ type: "user", timestamp: "2026-10-20T09:59:00.000Z", message: { role: "user", content: `${SENTINEL} please do things` } });
}

/** @param {string} file @param {string[]} lines @param {{ mtimeMs?: number, append?: boolean, raw?: string }} [opt] */
function writeLines(file, lines, opt = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const text = opt.raw !== undefined ? opt.raw : `${lines.join("\n")}\n`;
  if (opt.append) fs.appendFileSync(file, text);
  else fs.writeFileSync(file, text);
  if (opt.mtimeMs) fs.utimesSync(file, opt.mtimeMs / 1000, opt.mtimeMs / 1000);
  return Buffer.byteLength(text);
}

module.exports = { SENTINEL, SENTINEL_REPLY, SENTINEL_PATH, assistantLine, userLine, writeLines };
