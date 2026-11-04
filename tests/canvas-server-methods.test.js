// The HTTP gate of ui/server.js must let the Canvas API use PUT, DELETE and binary asset uploads (and nothing else).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { removeDir } = require("./helpers/temp-dir");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-canvas-gate-"));
process.env.HARNESS_ROOT = ROOT;
fs.mkdirSync(path.join(ROOT, "projects", "demo"), { recursive: true });
fs.mkdirSync(path.join(ROOT, "projects", "_template"), { recursive: true });
fs.mkdirSync(path.join(ROOT, "global"), { recursive: true });

const { createServer } = require("../ui/server");
let server;
let base;
test.before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => {
  server.closeAllConnections();
  server.close();
  await new Promise((resolve) => setTimeout(resolve, 250));
  removeDir(ROOT);
});

const ID = "11111111-1111-4111-8111-111111111111";
const call = (method, p, headers = {}, body) =>
  fetch(base + p, { method, headers: { Origin: base, ...headers }, body }).then((r) => r.status);

test("canvas PUT and DELETE reach the handlers (unknown board is 404, not 405)", async () => {
  const json = { "Content-Type": "application/json" };
  assert.equal(await call("PUT", `/api/canvas/boards/${ID}?project=demo`, json, JSON.stringify({ rev: 1, title: "x" })), 404);
  assert.equal(await call("DELETE", `/api/canvas/boards/${ID}?project=demo`, json), 404);
});

test("canvas writes keep the same-origin rule", async () => {
  const json = { "Content-Type": "application/json" };
  assert.equal(await call("PUT", `/api/canvas/boards/${ID}?project=demo`, { ...json, Origin: "http://evil.test" }, "{}"), 403);
  assert.equal(await call("DELETE", `/api/canvas/boards/${ID}?project=demo`, { ...json, Origin: "http://evil.test" }), 403);
});

test("canvas asset upload accepts octet-stream, other POST routes still need JSON", async () => {
  const bin = { "Content-Type": "application/octet-stream" };
  assert.equal(await call("POST", `/api/canvas/boards/${ID}/assets?project=demo&name=a.png`, bin, "x"), 404);
  assert.equal(await call("POST", `/api/canvas/boards?project=demo`, bin, "x"), 403);
});

test("PUT and DELETE stay blocked outside the canvas API", async () => {
  assert.equal(await call("PUT", "/api/state", { "Content-Type": "application/json" }, "{}"), 405);
  assert.equal(await call("DELETE", "/api/state"), 405);
});
