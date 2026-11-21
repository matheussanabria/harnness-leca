// @ts-check
// EP-24.05: export queue rules (one job per project, cancel, timeout, cleanup) and request options, without a browser.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createExportQueue, cleanupExports, MAX_AGE_MS } = require("../ui/server/services/motion-export-queue.service");
const { availableFormats } = require("../ui/server/services/motion-export-run.service");
const { exportOptions } = require("../ui/server/controllers/motion-export.controller");

/** Runner that waits until released or aborted. */
function controllableRun() {
  /** @type {Map<string, () => void>} */ const release = new Map();
  const run = (/** @type {any} */ job, /** @type {any} */ ctx) => new Promise((resolve, reject) => {
    ctx.onProgress(1, 2);
    ctx.signal.addEventListener("abort", () => reject(new Error("aborted")));
    release.set(job.id, () => resolve({ file: `/x/${job.id}.webm`, bytes: 10, mime: "video/webm" }));
  });
  return { run, release };
}
const spec = (slug = "p") => ({ slug, protoId: "a", screen: "home", format: "webm", fps: 30, scale: 1 });

test("CP-19: a second job of the same project waits until the first finishes; other projects run in parallel", async () => {
  const { run, release } = controllableRun();
  const q = createExportQueue({ run });
  const first = q.enqueue(spec());
  const second = q.enqueue(spec());
  const other = q.enqueue(spec("other"));
  assert.deepEqual([first.status, second.status, other.status], ["running", "queued", "running"]);
  assert.deepEqual([first.frame, first.total], [1, 2]);
  release.get(first.id)?.();
  await q.settled(first.id);
  assert.equal(q.get(first.id)?.status, "done");
  assert.equal(q.get(second.id)?.status, "running");
});

test("CP-18 (queue): cancelling a running job ends it as cancelled and starts the next one", async () => {
  const { run } = controllableRun();
  const q = createExportQueue({ run });
  const first = q.enqueue(spec());
  const second = q.enqueue(spec());
  assert.equal(q.cancel(first.id), true);
  await q.settled(first.id);
  assert.equal(q.get(first.id)?.status, "cancelled");
  assert.equal(q.get(second.id)?.status, "running");
  assert.equal(q.cancel(first.id), false, "finished jobs cannot be cancelled again");
});

test("motion-export queue: a queued job cancels at once; a slow job times out with a clear error", async () => {
  const { run } = controllableRun();
  const q = createExportQueue({ run, timeoutMs: 20 });
  const first = q.enqueue(spec());
  const queued = q.enqueue(spec());
  assert.equal(q.cancel(queued.id), true);
  assert.equal(q.get(queued.id)?.status, "cancelled");
  await q.settled(first.id);
  assert.equal(q.get(first.id)?.status, "error");
  assert.match(String(q.get(first.id)?.error), /longer than 10 minutes/);
});

test("motion-export queue: runner errors are kept short on the job", async () => {
  const q = createExportQueue({ run: async () => { throw new Error("x".repeat(500)); } });
  const job = q.enqueue(spec());
  await q.settled(job.id);
  assert.equal(q.get(job.id)?.status, "error");
  assert.equal(String(q.get(job.id)?.error).length, 300);
});

test("motion-export cleanup removes only export files older than 24 h", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "motion-exports-"));
  try {
    for (const name of ["old.webm", "new.mp4", "old.txt"]) fs.writeFileSync(path.join(dir, name), "x");
    const old = (Date.now() - MAX_AGE_MS - 60000) / 1000;
    fs.utimesSync(path.join(dir, "old.webm"), old, old);
    fs.utimesSync(path.join(dir, "old.txt"), old, old);
    assert.deepEqual(cleanupExports(dir, Date.now()), ["old.webm"]);
    assert.deepEqual(fs.readdirSync(dir).sort(), ["new.mp4", "old.txt"]);
    assert.deepEqual(cleanupExports(path.join(dir, "missing"), Date.now()), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("CP-17: without H.264 support MP4 is not offered", () => {
  assert.deepEqual(availableFormats({ mp4: false, webm: true }), ["webm", "gif"]);
  assert.deepEqual(availableFormats({}), ["gif"]);
});

test("motion-export options: defaults per format and limits", () => {
  const doc = { fps: 30 };
  assert.deepEqual(exportOptions({}, doc), { format: "webm", fps: 30, scale: 1 });
  assert.deepEqual(exportOptions({ format: "gif" }, doc), { format: "gif", fps: 15, scale: 0.5 });
  assert.deepEqual(exportOptions({ format: "mp4", fps: 60, scale: 2 }, doc), { format: "mp4", fps: 60, scale: 2 });
  for (const bad of [{ format: "avi" }, { format: "gif", fps: 60 }, { fps: 0 }, { scale: 3 }, { scale: "x" }]) {
    assert.throws(() => exportOptions(bad, doc), (/** @type {any} */ e) => e.status === 400, JSON.stringify(bad));
  }
});
