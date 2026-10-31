// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseSuggestions, summarize } = require("../tools/lib/hia/combo-report");
const { parseArgs } = require("../tools/hia-combo-report");

const rec = (o) => JSON.stringify({ executorType: "cloud", executorId: "opencode", status: "routed", ...o });
const JSONL = [
  rec({ suggestedType: "investigate", suggestedCombo: "harness-bugs", project: "a", recordedAt: "2026-11-01T10:00:00Z", promptPreview: "investigue o erro" }),
  rec({ suggestedType: "general", suggestedCombo: "Harness", project: "a", recordedAt: "2026-11-02T10:00:00Z", promptPreview: "bom dia" }),
  rec({ suggestedType: "test", suggestedCombo: "harness-testes", project: "b", recordedAt: "2026-11-03T10:00:00Z" }),
  JSON.stringify({ executorType: "script", executorId: "git.status" }),
  "not json",
  "",
].join("\n");

test("combo-report - keeps only cloud records with a suggestion and ignores bad lines", () => {
  assert.equal(parseSuggestions(JSONL).length, 3);
});

test("combo-report - totals, general share and distribution", () => {
  const r = summarize(parseSuggestions(JSONL));
  assert.equal(r.total, 3);
  assert.equal(r.generalShare, 33);
  assert.deepEqual(r.byCombo, { "harness-bugs": 1, Harness: 1, "harness-testes": 1 });
  assert.deepEqual(r.byEngine, { opencode: 3 });
});

test("combo-report - filters by project and date; sample has only previews, newest first", () => {
  const r = summarize(parseSuggestions(JSONL), { project: "a", since: "2026-11-01T12:00:00Z" });
  assert.equal(r.total, 1);
  assert.equal(r.sample[0].combo, "Harness");
  const all = summarize(parseSuggestions(JSONL));
  assert.deepEqual(all.sample.map((s) => s.preview), ["bom dia", "investigue o erro"]);
});

test("combo-report - empty input yields a zeroed report", () => {
  assert.deepEqual(summarize([]), { total: 0, generalShare: 0, byType: {}, byCombo: {}, byEngine: {}, sample: [] });
});

test("combo-report - CLI argument parsing", () => {
  assert.deepEqual(parseArgs(["--since", "2026-11-01", "--project", "x", "--sample", "5", "--json"]), {
    since: "2026-11-01", project: "x", sample: 5, json: true,
  });
});
