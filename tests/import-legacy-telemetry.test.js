// @ts-check
// Tests - legacy telemetry importer (T1.4): replay no-op, corrupt lines, null preserved, legacy marker.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-legacy-import-"));
process.env.HARNESS_ROOT = ROOT;
test.after(() => fs.rmSync(ROOT, { recursive: true, force: true }));

const { run } = require("../tools/import-legacy-telemetry");
const { readEvents, closeStore } = require("../ui/server/services/events/event-store");
const { importLegacyTelemetry } = require("../tools/lib/telemetry-import");

const SLUG = "legacy-proj";
const hiaScript = { executionId: "exec-1", executorType: "script", executorId: "git.status", status: "succeeded", durationMs: 45, tokensPrompt: 0, tokensCompletion: 0, tokensTotal: 0, tokensSaved: 1200, recordedAt: "2026-10-19T22:27:02.965Z" };
const hiaLocal = { ...hiaScript, executionId: "exec-2", executorType: "local_llm", executorId: "qwen" };
const rtOk = { correlationId: "c-1", model: "qwen3.5:4b", valid: true, tipo: "bug", totalDurationMs: 250, loadDurationMs: 0, promptDurationMs: 0, evalDurationMs: 0, tokensPrompt: 70, tokensGenerated: 15, timestamp: "2026-10-21T14:08:46.234Z" };
const rtFail = { correlationId: "c-2", slug: "x", model: "qwen3.5:4b", valid: false, totalDurationMs: 0, loadDurationMs: 0, promptDurationMs: 0, evalDurationMs: 0, tokensPrompt: 0, tokensGenerated: 0, errors: ["Ollama connection timed out"], timestamp: "2026-10-21T14:08:46.255Z" };

const toLines = (/** @type {any[]} */ items) => items.map((i) => (typeof i === "string" ? i : JSON.stringify(i))).join("\n") + "\n";

/** @returns {{ dir: string, hia: string, rt: string }} */
function fixtures(/** @type {string} */ name, /** @type {any[]} */ hia, /** @type {any[]} */ rt) {
  const dir = path.join(ROOT, "fixtures", name);
  fs.mkdirSync(dir, { recursive: true });
  const h = path.join(dir, "hia-executions.jsonl");
  const r = path.join(dir, "runtime-shadow.jsonl");
  fs.writeFileSync(h, toLines(hia));
  fs.writeFileSync(r, toLines(rt));
  return { dir, hia: h, rt: r };
}

const imported = (/** @type {string} */ slug) => readEvents(slug, { limit: 1000 }).events;
const quiet = { log() {}, error() {} };

test("replay is a no-op and moving lines does not duplicate", () => {
  const f = fixtures("replay", [hiaScript, hiaLocal], [rtOk, rtFail]);
  const files = [f.hia, f.rt];
  const first = importLegacyTelemetry({ slug: SLUG, apply: true, files });
  assert.deepEqual(first.files.map((x) => x.imported), [2, 2]);
  assert.equal(imported(SLUG).length, 4);
  const second = importLegacyTelemetry({ slug: SLUG, apply: true, files });
  assert.deepEqual(second.files.map((x) => [x.imported, x.duplicate]), [[0, 2], [0, 2]]);
  assert.equal(imported(SLUG).length, 4);
  fs.writeFileSync(f.hia, toLines([hiaLocal, "", hiaScript]));
  const moved = importLegacyTelemetry({ slug: SLUG, apply: true, files: [f.hia] });
  assert.equal(moved.files[0].imported, 0);
  assert.equal(moved.files[0].duplicate, 2);
  closeStore(SLUG);
});

test("dry-run is the default, writes nothing and reports the same counts", () => {
  const f = fixtures("dry", [hiaScript], [rtOk]);
  const slug = "legacy-dry";
  const summary = run(["--project", slug, "--files", `${f.hia},${f.rt}`, "--json"], quiet);
  assert.equal(summary.mode, "dry-run");
  assert.deepEqual(summary.files.map((x) => x.imported), [1, 1]);
  assert.equal(fs.existsSync(path.join(ROOT, "projects", slug)), false);
  run(["--project", slug, "--files", `${f.hia},${f.rt}`, "--apply"], quiet);
  const after = run(["--project", slug, "--files", `${f.hia},${f.rt}`], quiet);
  assert.deepEqual(after.files.map((x) => [x.imported, x.duplicate]), [[0, 1], [0, 1]]);
  closeStore(slug);
});

test("corrupt, non-object and incomplete lines are counted and skipped", () => {
  const f = fixtures("corrupt", [hiaScript, "{not json", "[1,2]", { status: "succeeded" }], [rtOk]);
  const out = importLegacyTelemetry({ slug: "legacy-corrupt", apply: true, files: [f.hia] });
  const s = out.files[0];
  assert.equal(s.read, 4);
  assert.equal(s.imported, 1);
  assert.equal(s.invalid, 3);
  assert.deepEqual(s.invalidSamples.map((x) => x.reason), ["unparsable_json", "not_an_object", "missing_executionId"]);
  closeStore("legacy-corrupt");
});

test("nulls are preserved and coerced zeros import as null", () => {
  const slug = "legacy-null";
  const partial = { correlationId: "c-3", model: "m", valid: true, timestamp: "2026-10-21T14:08:46.234Z" };
  const f = fixtures("nulls", [hiaScript, hiaLocal], [rtOk, rtFail, partial]);
  importLegacyTelemetry({ slug, apply: true, files: [f.hia, f.rt] });
  const byRun = Object.fromEntries(imported(slug).map((e) => [e.runId, e]));
  assert.deepEqual(byRun["exec-1"].payload.tokens.input, 0);
  assert.ok(byRun["exec-1"].payload.flags.includes("unverified_zero"));
  assert.equal(byRun["exec-2"].payload.tokens.input, null);
  assert.equal(byRun["exec-2"].payload.tokens.total, null);
  assert.ok(byRun["exec-2"].payload.flags.includes("coerced_zero"));
  assert.equal(byRun["c-1"].payload.tokens.input, 70);
  assert.equal(byRun["c-2"].payload.tokens.input, null);
  assert.equal(byRun["c-2"].payload.tokens.output, null);
  assert.equal(byRun["c-2"].payload.durationMs, null);
  assert.equal(byRun["c-3"].payload.tokens.input, null);
  assert.equal(byRun["c-3"].payload.tokens.output, null);
  closeStore(slug);
});

test("events carry the legacy marker and tokensSaved is not measured", () => {
  const slug = "legacy-marker";
  const f = fixtures("marker", [hiaScript], [rtOk]);
  const summary = importLegacyTelemetry({ slug, apply: true, files: [f.hia, f.rt] });
  assert.equal(summary.files[0].flagged, 1);
  assert.equal(summary.files[1].flagged, 0);
  const events = imported(slug);
  assert.deepEqual(events.map((e) => e.type).sort(), ["run.finished", "usage.observed"]);
  for (const e of events) {
    assert.equal(e.payload.origin, "legacy");
    assert.equal(e.payload.quality, "unknown");
    assert.equal(e.source.provider, "legacy-import");
    assert.match(e.idempotencyKey, /^legacy:(hia-executions|runtime-shadow)\.jsonl:[0-9a-f]{32}$/);
  }
  const run_ = events.find((e) => e.type === "run.finished");
  assert.equal(run_.payload.estimates.tokensSaved.measured, false);
  assert.equal(run_.at, "2026-10-19T22:27:02.965Z");
  closeStore(slug);
});

test("CLI validates arguments and never modifies the legacy files", () => {
  const f = fixtures("readonly", [hiaScript], [rtOk]);
  const before = fs.readFileSync(f.hia);
  assert.throws(() => run([], quiet), /--project/);
  assert.throws(() => run(["--project", "x", "--apply", "--dry-run"], quiet), /not both/);
  run(["--project", "legacy-ro", "--files", f.hia, "--apply"], quiet);
  assert.deepEqual(fs.readFileSync(f.hia), before);
  closeStore("legacy-ro");
});
