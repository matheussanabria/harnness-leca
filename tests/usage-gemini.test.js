// @ts-check
// Gemini/Antigravity activity reader: per-day counts, content sentinels never surface, cache, degradation, route.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createGeminiActivityReader } = require("../ui/server/services/usage-ingest/gemini-activity-reader");
const { centralEventRoutes } = require("../ui/server/routes/central-events.routes");

const SENTINEL = "SENTINEL-GEMINI-CONTENT-XYZ";
const line = (type, at, extra = {}) => JSON.stringify({ step_index: 1, source: "MODEL", type, status: "DONE", created_at: at, content: SENTINEL, thinking: SENTINEL, ...extra });

function makeBrain(sessions) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gem-"));
  for (const [id, lines] of Object.entries(sessions)) {
    const logs = path.join(dir, id, ".system_generated", "logs");
    fs.mkdirSync(logs, { recursive: true });
    fs.writeFileSync(path.join(logs, "transcript.jsonl"), lines.join("\n") + "\n");
  }
  return dir;
}

test("counts prompts, responses and errors per UTC day across sessions", () => {
  const brainDir = makeBrain({
    a: [line("USER_INPUT", "2026-08-04T10:00:00Z"), line("PLANNER_RESPONSE", "2026-08-04T10:01:00Z"), line("VIEW_FILE", "2026-08-04T10:02:00Z"), "not json"],
    b: [line("USER_INPUT", "2026-08-04T11:00:00Z"), line("ERROR_MESSAGE", "2026-08-05T01:00:00Z"), line("USER_INPUT", "bad-date")],
  });
  const out = createGeminiActivityReader({ brainDir }).read();
  assert.equal(out.sessions, 2);
  assert.deepEqual(out.days.map((d) => d.day), ["2026-08-05", "2026-08-04"]);
  const d4 = out.days[1];
  assert.deepEqual([d4.sessions, d4.prompts, d4.responses, d4.errors], [2, 2, 1, 0]);
  assert.equal(out.days[0].errors, 1);
});

test("no transcript content is ever returned", () => {
  const brainDir = makeBrain({ a: [line("USER_INPUT", "2026-08-04T10:00:00Z")] });
  assert.ok(!JSON.stringify(createGeminiActivityReader({ brainDir }).read()).includes(SENTINEL));
});

test("re-read uses the cache until the file changes", () => {
  const brainDir = makeBrain({ a: [line("USER_INPUT", "2026-08-04T10:00:00Z")] });
  const reader = createGeminiActivityReader({ brainDir });
  assert.equal(reader.read().days[0].prompts, 1);
  const file = path.join(brainDir, "a", ".system_generated", "logs", "transcript.jsonl");
  fs.appendFileSync(file, line("USER_INPUT", "2026-08-04T12:00:00Z") + "\n");
  assert.equal(reader.read().days[0].prompts, 2);
});

test("missing directory degrades to an empty result with a warning", () => {
  const seen = [];
  const out = createGeminiActivityReader({ brainDir: path.join(os.tmpdir(), "does-not-exist-gem"), warn: (m) => seen.push(m) }).read();
  assert.deepEqual(out.days, []);
  assert.equal(out.warnings.length, 1);
  assert.equal(seen.length, 1);
});

test("route GET /api/usage/gemini is registered", () => {
  assert.ok(centralEventRoutes.some((r) => r.method === "GET" && r.path.test("/api/usage/gemini")));
});
