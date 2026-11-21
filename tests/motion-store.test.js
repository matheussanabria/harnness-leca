// @ts-check
// EP-24.01: timeline store and GET/PUT .../prototypes/:protoId/motion/:screenId (ADR-018).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createProjectFixture } = require("./helpers/project-fixture");
const { handle } = require("../ui/server/router");
const { readMotion, writeMotion, MotionError } = require("../ui/server/services/motion-store.service");

const fixture = createProjectFixture();
fixture.activate();
test.after(() => fixture.cleanup());

const PROTO = "motion-demo";
const protoDir = path.join(fixture.dir, "design", "prototypes", PROTO);
fs.mkdirSync(path.join(protoDir, "screens"), { recursive: true });
fs.writeFileSync(path.join(protoDir, "proto.json"), JSON.stringify({
  schema: 1, id: PROTO, title: "Motion demo", activeScreen: "home",
  screens: [{ id: "home", title: "Home", file: "screens/home.html" }, { id: "escape", title: "Bad", file: "../outside.html" }],
}));
fs.writeFileSync(path.join(protoDir, "screens", "home.html"), '<div data-pid="p-1"><h1 data-pid="p-2">Hi</h1></div>');
const motionFile = path.join(protoDir, "screens", "home.motion.json");

function timeline(over = {}) {
  return {
    schema: "motion@1", duration: 1000, fps: 30,
    tracks: [
      { target: "p-1", keys: [{ t: 0, props: { opacity: 0 } }, { t: 500, props: { opacity: 1 } }] },
      { target: "p-2", keys: [{ t: 0, props: { transform: "scale(0.9)" } }, { t: 800, props: { transform: "scale(1)" } }] },
    ],
    ...over,
  };
}

/**
 * @param {string} method
 * @param {string} screen
 * @param {unknown} [body]
 */
async function call(method, screen, body) {
  const payload = body === undefined ? "" : JSON.stringify(body);
  const listeners = {};
  const req = {
    method, url: `/api/project/${fixture.slug}/design/prototypes/${PROTO}/motion/${screen}`,
    socket: { remoteAddress: "127.0.0.1" },
    headers: { host: "localhost:4321", origin: "http://localhost:4321", "content-type": "application/json" },
    on(event, fn) { listeners[event] = fn; return req; }, destroy() {},
  };
  let status = 0;
  let text = "";
  const res = { setHeader() {}, writeHead(code) { status = code; }, end(data) { text = data; } };
  const done = handle(/** @type {any} */ (req), /** @type {any} */ (res));
  setImmediate(() => { if (payload) listeners.data?.(payload); listeners.end?.(); });
  await done;
  return { status, json: JSON.parse(text) };
}

test("CP-01: saving a valid timeline creates screens/<screen>.motion.json and returns the new rev", async () => {
  fs.rmSync(motionFile, { force: true });
  const empty = await call("GET", "home");
  assert.equal(empty.status, 200);
  assert.equal(empty.json.doc, null);
  assert.equal(empty.json.rev, null);

  const saved = await call("PUT", "home", { doc: timeline(), rev: null });
  assert.equal(saved.status, 200);
  assert.match(saved.json.rev, /^[0-9a-f]{12}$/);
  assert.equal(fs.existsSync(motionFile), true);
  assert.deepEqual(JSON.parse(fs.readFileSync(motionFile, "utf8")), timeline());

  const read = await call("GET", "home");
  assert.equal(read.json.rev, saved.json.rev);
});

test("CP-02: PUT with a prop outside the list answers 422 and does not touch the file", async () => {
  fs.rmSync(motionFile, { force: true });
  const bad = timeline();
  bad.tracks[0].keys[1].props = { left: "4px" };
  const r = await call("PUT", "home", { doc: bad, rev: null });
  assert.equal(r.status, 422);
  assert.equal(r.json.code, "invalid_timeline");
  assert.deepEqual(r.json.errors.map((e) => e.path), ["tracks[0].keys[1].props.left"]);
  assert.equal(fs.existsSync(motionFile), false);
});

test("CP-04: a stale rev answers 409 and keeps the stored timeline", async () => {
  fs.rmSync(motionFile, { force: true });
  const first = writeMotion(fixture.dir, PROTO, "home", timeline(), { rev: null });
  const second = writeMotion(fixture.dir, PROTO, "home", timeline({ duration: 2000 }), { rev: first.rev });
  const before = fs.readFileSync(motionFile, "utf8");
  const r = await call("PUT", "home", { doc: timeline({ duration: 3000 }), rev: first.rev });
  assert.equal(r.status, 409);
  assert.equal(r.json.code, "rev_conflict");
  assert.equal(r.json.rev, second.rev);
  assert.equal(fs.readFileSync(motionFile, "utf8"), before);
  assert.throws(() => writeMotion(fixture.dir, PROTO, "home", timeline(), {}), (e) => e instanceof MotionError && e.status === 409);
});

test("motion-store: orphan tracks come back as warnings on write and read", () => {
  fs.rmSync(motionFile, { force: true });
  const d = timeline();
  d.tracks[1].target = "p-7";
  const saved = writeMotion(fixture.dir, PROTO, "home", d, { rev: null });
  assert.deepEqual(saved.warnings.map((w) => w.code), ["orphan_track"]);
  assert.deepEqual(readMotion(fixture.dir, PROTO, "home").warnings.map((w) => w.code), ["orphan_track"]);
});

test("motion-store: files over 64 KB answer 413", async () => {
  const big = timeline({ tracks: Array.from({ length: 200 }, (_, i) => ({
    target: `p-${i}`, keys: Array.from({ length: 4 }, (_, k) => ({ t: k * 100, props: { filter: `blur(${"1".repeat(60)}px)` } })),
  })) });
  const r = await call("PUT", "home", { doc: big, rev: null });
  assert.equal(r.status, 413);
  assert.equal(r.json.code, "timeline_too_large");
});

test("motion-store: unknown screen 404, screen file outside the prototype 400, missing doc 400", async () => {
  assert.equal((await call("GET", "nope")).status, 404);
  assert.equal((await call("GET", "escape")).status, 400);
  assert.equal((await call("PUT", "home", { rev: null })).status, 400);
  assert.throws(() => readMotion(fixture.dir, "../x", "home"), (e) => e instanceof MotionError && e.status === 400);
});
