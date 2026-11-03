// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const os = require("os");

const { resolveAgyBin, resetAgyBin } = require("../tools/lib/antigravity-bin");
const { createAntigravityStreamParser, isUuid } = require("../tools/lib/engines/antigravity-stream");
const geminiEngine = require("../tools/lib/engines/gemini");
const catalog = require("../tools/lib/engines/catalog.json");

test("isUuid: validates 36-char lowercase and uppercase uuids", () => {
  assert.equal(isUuid("d173ae5f-d242-4402-99f5-279b803a515d"), true);
  assert.equal(isUuid("D173AE5F-D242-4402-99F5-279B803A515D"), true);
  assert.equal(isUuid("not-a-uuid"), false);
  assert.equal(isUuid(""), false);
  assert.equal(isUuid(null), false);
});

test("resolveAgyBin: honors AGY_BIN override when pointing to a valid file", (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agy-test-"));
  const fakeBin = path.join(tmpDir, process.platform === "win32" ? "fake-agy.exe" : "fake-agy");
  fs.writeFileSync(fakeBin, "");
  t.after(() => {
    delete process.env.AGY_BIN;
    resetAgyBin();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  resetAgyBin();
  process.env.AGY_BIN = fakeBin;
  const resolved = resolveAgyBin();
  assert.equal(resolved, fakeBin);
});

test("createAntigravityStreamParser: streams text chunks and tracks conversation ID and usage", () => {
  const chunks = [];
  const toolUses = [];
  const toolResults = [];

  const parser = createAntigravityStreamParser(
    {
      onChunk: (c) => chunks.push(c),
      onToolUse: (u) => toolUses.push(u),
      onToolResult: (r) => toolResults.push(r),
    },
    ""
  );

  parser.line('{"event":"init","conversation_id":"c8f2f27e-d6e5-4aa8-a491-cc6b4d5ac99f"}');
  assert.equal(parser.getState().sessionId, "c8f2f27e-d6e5-4aa8-a491-cc6b4d5ac99f");

  parser.line(
    '{"event":"step_update","step_update":{"conversation_id":"c8f2f27e-d6e5-4aa8-a491-cc6b4d5ac99f","step_index":1,"state":"ACTIVE","step_type":"agent_response","text_delta":"Olá!"}}'
  );
  parser.line(
    '{"event":"step_update","step_update":{"conversation_id":"c8f2f27e-d6e5-4aa8-a491-cc6b4d5ac99f","step_index":1,"state":"DONE","step_type":"agent_response","text_delta":" Tudo bem?","usage":{"total_tokens":42}}}'
  );

  parser.line(
    '{"event":"step_update","step_update":{"step_index":2,"state":"ACTIVE","step_type":"tool","tool_name":"read_file","tool_info":{"parameters":{"Path":"file.txt"}}}}'
  );
  parser.line(
    '{"event":"step_update","step_update":{"step_index":2,"state":"DONE","step_type":"tool","tool_name":"read_file","tool_info":{"output":"content"}}}'
  );

  parser.line(
    '{"event":"result","result":{"status":"SUCCESS","response":"Olá! Tudo bem?","usage":{"total_tokens":50}}}'
  );

  const state = parser.getState();
  assert.equal(state.text, "Olá! Tudo bem?");
  assert.equal(state.usage?.total_tokens, 50);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].text, "Olá!");
  assert.equal(chunks[1].text, " Tudo bem?");
  assert.equal(toolUses.length, 1);
  assert.equal(toolUses[0].name, "read_file");
  assert.equal(toolResults.length, 1);
  assert.equal(toolResults[0].output, "content");
});

test("createAntigravityStreamParser: handles error result gracefully", () => {
  const parser = createAntigravityStreamParser({ onChunk: () => {} }, "sess-123");
  parser.line('{"event":"result","result":{"status":"ERROR","error":"Quota exceeded"}}');
  assert.equal(parser.getState().error, "Quota exceeded");
});

test("geminiEngine: status reports Antigravity auth and availability", async () => {
  const st = await geminiEngine.status(catalog.gemini);
  assert.equal(typeof st.hasKey, "boolean");
  assert.equal(typeof st.hasAgy, "boolean");
  assert.equal(st.available, true);
  assert.ok(st.auth.includes("Antigravity") || st.auth.includes("Google") || st.auth.includes("Studio"));
});

