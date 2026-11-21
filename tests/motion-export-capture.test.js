// @ts-check
// EP-24.05: real export through the harness router and headless Chrome (CP-16, CP-18). Skipped without a browser.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createProjectFixture } = require("./helpers/project-fixture");
const { runExport, framePlan, outputSize, availableFormats } = require("../ui/server/services/motion-export-run.service");

const fixture = createProjectFixture();
fixture.activate();

const PROTO = "export-demo";
const protoDir = path.join(fixture.dir, "design", "prototypes", PROTO);
fs.mkdirSync(path.join(protoDir, "screens"), { recursive: true });
fs.writeFileSync(path.join(protoDir, "proto.json"), JSON.stringify({ schema: 1, id: PROTO, screens: [{ id: "home", file: "screens/home.html" }] }));
fs.writeFileSync(path.join(protoDir, "screens", "home.html"), '<div data-pid="p-1" style="width:160px;height:90px;background:#d97757">box</div>');
const DOC = { schema: "motion@1", duration: 1000, fps: 24, size: { w: 320, h: 180 }, tracks: [{ target: "p-1", keys: [{ t: 0, props: { opacity: 0 } }, { t: 1000, props: { opacity: 1 } }] }] };
fs.writeFileSync(path.join(protoDir, "screens", "home.motion.json"), JSON.stringify(DOC));
const outDir = path.join(fixture.dir, "design", "exports");
fs.mkdirSync(outDir, { recursive: true });

/** @type {import("node:http").Server} */ let server;
let port = 0;
test.before(async () => {
  server = require("../ui/server").createServer(); // the real HTTP gate (methods, host, origin), not only the router
  await new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(undefined)));
  port = /** @type {any} */ (server.address()).port;
});
test.after(async () => {
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(() => resolve(undefined)));
  fixture.cleanup();
});

async function hasBrowser() {
  try {
    const { browser } = await require("../tools/atelier-pilot/lib/browser").launchBrowser();
    await browser.close();
    return true;
  } catch {
    return false;
  }
}

/** @param {"mp4"|"webm"|"gif"} format @param {object} [extra] */
function spec(format, extra = {}) {
  return {
    renderUrl: `http://127.0.0.1:${port}/api/project/${fixture.slug}/design/prototypes/${PROTO}/render/home`,
    port, doc: DOC, format, fps: 24, scale: 1, outFile: path.join(outDir, `t.${format}`), ...extra,
  };
}

test("motion-export: frame plan, output size and offered formats", () => {
  assert.equal(framePlan(1000, 24).length, 24);
  assert.equal(framePlan(1000, 24)[23], 958.3333333333334);
  assert.deepEqual(outputSize({ size: { w: 321, h: 181 } }, 1), { viewport: { width: 321, height: 181 }, width: 322, height: 182 });
  assert.deepEqual(outputSize({}, 0.5), { viewport: { width: 1280, height: 720 }, width: 640, height: 360 });
  assert.deepEqual(availableFormats({ mp4: true, webm: true }), ["webm", "mp4", "gif"]);
});

test("CP-16: exporting WebM gives 24 frames and a 1 s video", async (t) => {
  if (!(await hasBrowser())) return t.skip("no Chrome or Edge available");
  const progress = [];
  const result = await runExport(spec("webm", { onProgress: (/** @type {number} */ f, /** @type {number} */ n) => progress.push([f, n]) }));
  assert.equal(result.frames, 24);
  assert.deepEqual(progress.at(-1), [24, 24]);
  const bytes = fs.readFileSync(result.file);
  assert.equal(bytes.subarray(0, 4).toString("hex"), "1a45dfa3", "EBML header");
  const { Input, BufferSource, ALL_FORMATS } = require("mediabunny");
  const input = new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS });
  const duration = await input.computeDuration();
  assert.ok(Math.abs(duration - 1) < 0.05, `duration ${duration}`);
  const track = await input.getPrimaryVideoTrack();
  assert.deepEqual([track?.displayWidth, track?.displayHeight], [320, 180]);
});

test("motion-export: MP4 and GIF files have the right headers", async (t) => {
  if (!(await hasBrowser())) return t.skip("no Chrome or Edge available");
  const mp4 = fs.readFileSync((await runExport(spec("mp4"))).file);
  assert.equal(mp4.subarray(4, 8).toString("latin1"), "ftyp");
  const gif = fs.readFileSync((await runExport(spec("gif", { fps: 12, scale: 0.5 }))).file);
  assert.equal(gif.subarray(0, 6).toString("latin1"), "GIF89a");
  assert.equal(gif.readUInt16LE(6), 160, "GIF width follows the scale");
});

test("CP-18: cancelling mid-export stops the job and leaves no file", async (t) => {
  if (!(await hasBrowser())) return t.skip("no Chrome or Edge available");
  const controller = new AbortController();
  const outFile = path.join(outDir, "cancel.webm");
  await assert.rejects(
    runExport(spec("webm", { outFile, signal: controller.signal, onProgress: (/** @type {number} */ f) => { if (f === 5) controller.abort("cancelled"); } })),
    (/** @type {any} */ e) => e.reason === "cancelled",
  );
  assert.equal(fs.existsSync(outFile), false);
  assert.deepEqual(fs.readdirSync(outDir).filter((f) => f.endsWith(".tmp")), []);
});

test("motion-export API: formats, create, poll, download, and errors", async (t) => {
  if (!(await hasBrowser())) return t.skip("no Chrome or Edge available");
  const base = `http://127.0.0.1:${port}/api/project/${fixture.slug}/design`;
  const headers = { origin: `http://127.0.0.1:${port}`, "content-type": "application/json" };
  const formats = await (await fetch(`${base}/motion/export-formats`)).json();
  assert.ok(formats.formats.includes("webm") && formats.formats.includes("gif"), JSON.stringify(formats));

  const bad = await fetch(`${base}/prototypes/${PROTO}/motion/home/export`, { method: "POST", headers, body: JSON.stringify({ format: "avi" }) });
  assert.equal(bad.status, 400);
  const denied = await fetch(`${base}/prototypes/${PROTO}/motion/home/export`, { method: "POST", body: "{}" });
  assert.equal(denied.status, 403);

  const created = await fetch(`${base}/prototypes/${PROTO}/motion/home/export`, { method: "POST", headers, body: JSON.stringify({ format: "webm", fps: 12, scale: 0.5 }) });
  assert.equal(created.status, 202);
  const { job } = await created.json();
  let status = job;
  for (let i = 0; i < 200 && !["done", "error", "cancelled"].includes(status.status); i += 1) {
    await new Promise((r) => setTimeout(r, 100));
    status = (await (await fetch(`${base}/motion/export/${job.id}`)).json()).job;
  }
  assert.equal(status.status, "done", JSON.stringify(status));
  assert.deepEqual([status.frame, status.total], [12, 12]);
  const file = await fetch(`${base}/motion/export/${job.id}/file`);
  assert.equal(file.headers.get("content-type"), "video/webm");
  assert.match(String(file.headers.get("content-disposition")), /attachment; filename="export-demo-home-[0-9a-f]{8}\.webm"/);
  assert.equal(Buffer.from(await file.arrayBuffer()).subarray(0, 4).toString("hex"), "1a45dfa3");
  assert.equal((await fetch(`${base}/motion/export/${job.id}`, { method: "DELETE", headers })).status, 200);
  assert.equal((await fetch(`${base}/motion/export/aaaaaaaaaaaa`)).status, 404);
});
