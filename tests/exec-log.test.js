// Executive log: store rules, the CLI, and the fact sheet built from injected git output (no real repository needed).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const store = require("../tools/lib/exec-log/store");
const { main, parseMetrics } = require("../tools/exec-log");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "exec-log-"));
const NOW = () => new Date("2026-11-22T15:00:00Z");
const base = { kind: "delivery", title: "Player entregue", summary: "Barra de transporte no Atelier.", epic: "EP-24", story: "24.03", evidence: ["a.md"] };
// Built at run time so the source never holds something shaped like a real credential.
const FAKE_KEY = ["sk", "ant", "x".repeat(28)].join("-");
const FAKE_MAIL = ["fulano", "example.com"].join("@");

test("EL-01: an entry is validated, gets the next id and a date, and is appended as one JSON line", () => {
  const file = path.join(tmp(), "docs", "executive", "log.jsonl");
  const first = store.appendEntry(file, base, { now: NOW });
  const second = store.appendEntry(file, { ...base, title: "Outra", kind: "decision" }, { now: NOW });
  assert.deepEqual([first.entry.id, second.entry.id], ["L-0001", "L-0002"]);
  assert.equal(first.entry.by, "claude");
  assert.match(first.entry.date, /^\d{4}-\d{2}-\d{2}$/);
  const lines = fs.readFileSync(file, "utf8").trim().split("\n");
  assert.equal(lines.length, 2);
  assert.deepEqual(JSON.parse(lines[0]), first.entry);
  assert.equal(store.readEntries(path.join(os.tmpdir(), "does-not-exist.jsonl")).length, 0);
});

test("EL-02: validation reports every problem and refuses secrets and personal data", () => {
  const errors = store.validateInput({ kind: "nope", title: "", summary: "x".repeat(701), epic: "24", story: "x", date: "22/11", evidence: "a", metrics: { Bad: 1 } });
  assert.equal(errors.length, 8, errors.join(" | "));
  assert.deepEqual(store.validateInput({ kind: "metric", title: "t", summary: "s" }), ["a metric entry needs metrics"]);
  assert.ok(store.validateInput({ ...base, summary: `chave ${FAKE_KEY}` }).some((e) => /secret|personal/.test(e)));
  assert.ok(store.validateInput({ ...base, summary: `contato ${FAKE_MAIL}` }).some((e) => /secret|personal/.test(e)));
  assert.deepEqual(store.validateInput({ ...base, metrics: { tests_pass: 2889, tests_fail: 0 } }), []);
  assert.throws(() => store.appendEntry(path.join(tmp(), "l.jsonl"), { ...base, kind: "x" }), /kind must be one of/);
});

test("EL-03: a key makes add idempotent; resolves must point to an existing entry", () => {
  const file = path.join(tmp(), "l.jsonl");
  const a = store.appendEntry(file, { ...base, key: "ep-24:accept" });
  const again = store.appendEntry(file, { ...base, title: "Texto diferente", key: "ep-24:accept" });
  assert.equal(again.duplicate, true);
  assert.equal(again.entry.id, a.entry.id);
  assert.equal(store.readEntries(file).length, 1);
  assert.throws(() => store.appendEntry(file, { ...base, resolves: "L-0099" }), /L-0099, which does not exist/);
  const pending = store.appendEntry(file, { ...base, kind: "pending", title: "Fazer X" }).entry;
  assert.deepEqual(store.openItems(store.readEntries(file)).map((e) => e.id), [pending.id]);
  store.appendEntry(file, { ...base, kind: "delivery", title: "X feito", resolves: pending.id });
  assert.deepEqual(store.openItems(store.readEntries(file)), [], "a resolved pending item leaves the open list");
});

test("EL-04: verify finds missing files, unknown commits and duplicate ids", () => {
  const entries = [
    { id: "L-0001", evidence: ["ok.md", "missing.md", "abc1234", "https://example.com/x"] },
    { id: "L-0001", evidence: [] },
  ];
  const broken = store.findBrokenEvidence(entries, { pathExists: (p) => p === "ok.md", commitExists: () => false });
  assert.deepEqual(broken.map((b) => `${b.evidence}:${b.reason}`), ["missing.md:file not found", "abc1234:commit not found"]);
  assert.deepEqual(store.duplicateIds(entries), ["L-0001"]);
});

test("EL-05: the CLI adds, lists and verifies against a root folder", () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, "a.md"), "x");
  const lines = [];
  const io = { log: (m) => lines.push(m) };
  const env = { root, now: NOW, git: () => { throw new Error("no repo"); } };
  main(["add", "--kind", "delivery", "--title", "Player", "--summary", "Pronto", "--epic", "EP-24", "--story", "24.03", "--evidence", "a.md", "--metrics", "tests_pass=10,tests_fail=0"], io, env);
  assert.match(lines.at(-1), /^L-0001 registered \(delivery,/);
  main(["add", "--kind", "pending", "--title", "Aprovar", "--summary", "Falta o aceite", "--key", "k"], io, env);
  main(["add", "--kind", "pending", "--title", "Aprovar", "--summary", "Falta o aceite", "--key", "k"], io, env);
  assert.match(lines.at(-1), /already exists/);
  main(["list", "--kind", "pending"], io, env);
  assert.match(lines.at(-1), /^L-0002\t.*\tpending\t-\tAprovar$/);
  main(["verify"], io, env);
  assert.match(lines.at(-1), /^ok: 2 entries/);
  fs.appendFileSync(store.logFile(root), `${JSON.stringify({ id: "L-0003", kind: "delivery", date: "2026-11-22", title: "t", summary: "s", evidence: ["gone.md"], by: "claude" })}\n`);
  assert.throws(() => main(["verify"], io, env), /1 broken evidence item/);
  assert.throws(() => main(["add", "--kind", "delivery"], io, env), /Not registered: .*title is required/);
  assert.throws(() => main(["wat"], io, env), /Unknown command/);
  assert.deepEqual(parseMetrics("a=1,b=2.5"), { a: 1, b: 2.5 });
});
