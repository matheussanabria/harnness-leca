// Executive log: store rules, the CLI, and the fact sheet built from injected git output (no real repository needed).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const store = require("../tools/lib/exec-log/store");
const { collectCommits, parseSubject, frontMatter, collectFacts } = require("../tools/lib/exec-log/facts");
const { renderFactSheet } = require("../tools/lib/exec-log/render");
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

const GIT_OUT = [
  "@@aaa1111|2026-11-21|feat(motion): validator and store (EP-24.01)",
  "120\t3\tui/server/services/motion-schema.service.js",
  "40\t0\ttests/motion-schema.test.js",
  "-\t-\tdocs/features/motion-format/evidence/shot.png",
  "@@bbb2222|2026-11-21|Merge EP-24.01: motion format",
  "@@ccc3333|2026-11-22|fix(atelier): wrap the preview header",
  "5\t1\tui/public/css/design/08-prototype-catalog.css",
  "@@ddd4444|2026-11-22|docs(ep-24): accept the epic",
  "10\t10\tdocs/harness-evolution/02-epics/EP-24-motion-design/24.01-formato.md",
  "3\t0\tdocs/features/motion-format/_status.md",
].join("\n");

test("EL-06: git output becomes commits with type, scope and line counts (merges and binaries handled)", () => {
  assert.deepEqual(parseSubject("feat(motion): x"), { type: "feat", scope: "motion" });
  assert.deepEqual(parseSubject("Merge EP-24: x"), { type: "merge", scope: "" });
  assert.deepEqual(parseSubject("random subject"), { type: "other", scope: "" });
  const calls = [];
  const commits = collectCommits({ from: "2026-11-21", to: "2026-11-22" }, (args) => { calls.push(args); return GIT_OUT; });
  assert.equal(commits.length, 4);
  assert.deepEqual(commits[0], { hash: "aaa1111", date: "2026-11-21", subject: "feat(motion): validator and store (EP-24.01)", type: "feat", scope: "motion", files: ["ui/server/services/motion-schema.service.js", "tests/motion-schema.test.js", "docs/features/motion-format/evidence/shot.png"], insertions: 160, deletions: 3 });
  assert.equal(commits[1].files.length, 0, "a merge has no file list");
  assert.ok(calls[0].some((a) => a.startsWith("--since=2026-11-21")) && calls[0].some((a) => a.startsWith("--until=2026-11-22 23:59:59")));
  assert.deepEqual(frontMatter('---\nid: EP-24.01\ntitulo: "Formato"\nstatus: concluida\n---\n# x'), { id: "EP-24.01", titulo: "Formato", status: "concluida" });
});

test("EL-07: the fact sheet has the totals, stories, dossiers, log sections and open items, and nothing else", () => {
  const root = tmp();
  const story = path.join(root, "docs/harness-evolution/02-epics/EP-24-motion-design");
  fs.mkdirSync(story, { recursive: true });
  fs.writeFileSync(path.join(story, "24.01-formato.md"), '---\nid: EP-24.01\ntitulo: "Formato motion@1"\nepico: EP-24\nstatus: concluida\n---\n');
  const dossier = path.join(root, "docs/features/motion-format");
  fs.mkdirSync(path.join(dossier, "evidence"), { recursive: true });
  fs.writeFileSync(path.join(dossier, "evidence", "a.png"), "x");
  fs.writeFileSync(path.join(dossier, "_status.md"), "---\nstory: EP-24.01\nroute: completa\n---\n| Stage | Status | Reason | File | Note |\n|---|---|---|---|---|\n| Start (start) | done | | `_status.md` | |\n| Prototype (prototype) | skipped | Sem elemento visual novo | | |\n| Commit and PR (commit-pr) | open | | | |\n");
  const facts = collectFacts(root, { from: "2026-11-21", to: "2026-11-22" }, () => GIT_OUT);
  assert.deepEqual([facts.commits.length, facts.filesChanged, facts.insertions, facts.deletions], [4, 6, 178, 14]);
  assert.deepEqual(facts.stories.map((s) => [s.id, s.epic, s.status]), [["24.01", "EP-24", "concluida"]]);
  assert.deepEqual(facts.dossiers, [{ slug: "motion-format", story: "EP-24.01", route: "completa", done: 1, skipped: 1, open: 1, evidenceFiles: 1 }]);

  const file = path.join(root, "log.jsonl");
  store.appendEntry(file, { ...base, evidence: ["docs/features/motion-format/_status.md"], date: "2026-11-21" });
  store.appendEntry(file, { kind: "correction", title: "Host do worktree", summary: "A main nao usa o host do worktree: o token difere.", date: "2026-11-22", evidence: ["a1b2c3d"] });
  store.appendEntry(file, { kind: "metric", title: "Suite completa", summary: "Todos os testes.", date: "2026-11-22", metrics: { tests_pass: 2929, tests_fail: 0, tests_skipped: 5 } });
  const pending = store.appendEntry(file, { kind: "pending", title: "Aceite do EP-17", summary: "Depende do usuario.", date: "2026-11-22" }).entry;
  store.appendEntry(file, { kind: "pending", title: "Fora do periodo", summary: "Escrito depois.", date: "2026-11-23" });
  const sheet = renderFactSheet(facts, store.readEntries(file));

  assert.match(sheet, /^# Executive fact sheet: 2026-11-21 to 2026-11-22\n/);
  assert.match(sheet, /- Commits on main: 4 \(feat 1, merge 1, fix 1, docs 1\)/);
  assert.match(sheet, /- Files changed \(non-merge commits\): 6; lines \+178 \/ -14/);
  assert.match(sheet, /- Stories touched: 1 \(accepted 1, implemented or in review 0, planned 0\)/);
  assert.match(sheet, /\| EP-24 \| 24\.01 \| Formato motion@1 \| concluida \|/);
  assert.match(sheet, /\| motion-format \| EP-24\.01 \| completa \| 1 \| 1 \| 1 \| 1 \|/);
  assert.match(sheet, /## Delivered\n\n- \*\*L-0001\*\* \(2026-11-21, EP-24 24\.03\) Player entregue\./);
  assert.match(sheet, /## Corrections \(including our own mistakes\)\n\n- \*\*L-0002\*\*/);
  assert.match(sheet, /\| Date \| Entry \| tests_pass \| tests_fail \| tests_skipped \|\n\|---\|---\|---\|---\|---\|\n\| 2026-11-22 \| L-0003 \| 2929 \| 0 \| 5 \|/);
  assert.ok(sheet.includes(`**${pending.id}** (2026-11-22) Aceite do EP-17`), "open item inside the period");
  assert.doesNotMatch(sheet, /Fora do periodo/, "entries after the period are not on the sheet");
  assert.match(sheet, /## Evidence index\n\n- `docs\/features\/motion-format\/_status\.md`\n- `a1b2c3d`/);

  const filtered = renderFactSheet(facts, store.readEntries(file), { epic: "EP-99" });
  assert.match(filtered, /Stories touched: 0/);
  assert.match(filtered, /- None\./);
});
