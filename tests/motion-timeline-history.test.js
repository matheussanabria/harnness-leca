// @ts-check
// EP-24.06 (CP-23): timeline saves from the keyframe panel enter the Atelier history; undo and redo restore the file.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createProjectFixture } = require("./helpers/project-fixture");

const fixture = createProjectFixture();
fixture.activate();
const { handle } = require("../ui/server/router");
test.after(() => fixture.cleanup());

const PROTO = "kf-history";
const protoDir = path.join(fixture.dir, "design", "prototypes", PROTO);
fs.mkdirSync(path.join(protoDir, "screens"), { recursive: true });
fs.writeFileSync(path.join(protoDir, "proto.json"), JSON.stringify({ schema: 1, id: PROTO, version: 1, screens: [{ id: "home", file: "screens/home.html" }] }));
fs.writeFileSync(path.join(protoDir, "screens", "home.html"), '<div data-pid="p-1">box</div>');
const motionFile = path.join(protoDir, "screens", "home.motion.json");
const at = (/** @type {number} */ t) => ({ schema: "motion@1", duration: 1000, fps: 30, tracks: [{ target: "p-1", keys: [{ t: 0, props: { opacity: 0 } }, { t, props: { opacity: 1 } }] }] });

/** @param {string} method @param {string} url @param {unknown} [body] */
async function call(method, url, body) {
  const payload = body === undefined ? "" : JSON.stringify(body);
  const listeners = {};
  const req = {
    method, url, socket: { remoteAddress: "127.0.0.1" },
    headers: { host: "localhost:4321", origin: "http://localhost:4321", "content-type": "application/json" },
    on(event, fn) { listeners[event] = fn; return req; }, destroy() {},
  };
  let status = 0;
  let text = "";
  const res = { setHeader() {}, writeHead(code) { status = code; }, end(data) { text = data || ""; } };
  const done = handle(/** @type {any} */ (req), /** @type {any} */ (res));
  setImmediate(() => { if (payload) listeners.data?.(payload); listeners.end?.(); });
  await done;
  return { status, json: text ? JSON.parse(text) : {} };
}

const base = `/api/project/${fixture.slug}/design/prototypes/${PROTO}`;
const keyTime = () => JSON.parse(fs.readFileSync(motionFile, "utf8")).tracks[0].keys[1].t;

test("CP-23: Ctrl+Z after moving a keyframe brings it back, in the file too; redo moves it again", async () => {
  const first = await call("PUT", `${base}/motion/home`, { doc: at(500), rev: null, label: "Animação criada" });
  assert.equal(first.status, 200, JSON.stringify(first.json));
  const moved = await call("PUT", `${base}/motion/home`, { doc: at(700), rev: first.json.rev, label: "Keyframe movido para 700 ms" });
  assert.equal(moved.status, 200, JSON.stringify(moved.json));
  assert.equal(keyTime(), 700);

  const history = await call("GET", `${base}/history`);
  const labels = JSON.stringify(history.json);
  assert.match(labels, /Keyframe movido para 700 ms/);

  const undo = await call("POST", `${base}/history/undo`, {});
  assert.equal(undo.status, 200, JSON.stringify(undo.json));
  assert.equal(keyTime(), 500);
  const read = await call("GET", `${base}/motion/home`);
  assert.equal(read.json.rev, first.json.rev, "the rev matches the restored content");

  const redo = await call("POST", `${base}/history/redo`, {});
  assert.equal(redo.status, 200, JSON.stringify(redo.json));
  assert.equal(keyTime(), 700);
});

test("motion-timeline history: an invalid save leaves no history entry", async () => {
  const before = JSON.stringify((await call("GET", `${base}/history`)).json);
  const rev = (await call("GET", `${base}/motion/home`)).json.rev;
  const bad = await call("PUT", `${base}/motion/home`, { doc: { ...at(700), fps: 25 }, rev, label: "inválida" });
  assert.equal(bad.status, 422);
  assert.equal(JSON.stringify((await call("GET", `${base}/history`)).json), before);
});
