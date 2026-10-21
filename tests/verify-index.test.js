// @ts-check
// Testes — Verificador do indice mestre

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(".");
const { countCheckboxes, tableRows, sections } = require("../tools/verify-index");

test("verificador do índice - conta as caixas do checklist", () => {
  const text = ["- [x] um", "- [ ] dois", "- [x] tres", "- texto solto"].join("\n");
  assert.deepEqual(countCheckboxes(text), { done: 2, total: 3 });
});

test("verificador do índice - lê as entregas aceitas da tabela de épicos", () => {
  const text = [
    "| [EP-00](docs/x.md) | Auditoria | P0 | Concluído | 4/4 |",
    "| [EP-09](docs/y.md) | Central | P1 | Em andamento | 2/5 |",
  ].join("\n");
  const rows = tableRows(text);
  assert.equal(rows.size, 2);
  assert.deepEqual(rows.get("EP-00"), { done: 4, total: 4 });
  assert.deepEqual(rows.get("EP-09"), { done: 2, total: 5 });
});

test("verificador do índice - confere a contagem de cada seção do checklist", () => {
  const text = [
    "### EP-09 Central (2/5)",
    "- [x] [09.01](a.md) primeira",
    "- [ ] 09.02 segunda",
    "- [x] [09.03](b.md) terceira",
    "",
    "### EP-10 Deploy (0/5)",
    "- [ ] 10.01 primeira",
  ].join("\n");
  const secs = sections(text);
  assert.deepEqual(secs.get("EP-09"), { done: 2, total: 5, boxes: 3, checked: 2 });
  assert.deepEqual(secs.get("EP-10"), { done: 0, total: 5, boxes: 1, checked: 0 });
});

test("verificador do índice - o índice real do repositório está consistente", () => {
  const { execFileSync } = require("node:child_process");
  const out = execFileSync(process.execPath, [path.join(ROOT, "tools", "verify-index.js")], { encoding: "utf8" });
  assert.match(out, /entregas aceitas/);
  assert.doesNotMatch(out, /divergencia/);
});

test("verificador do índice - o arquivo do verificador respeita o limite de linhas e não usa emojis", () => {
  const source = fs.readFileSync(path.join(ROOT, "tools", "verify-index.js"), "utf8");
  assert.ok(source.split("\n").length < 300);
  assert.doesNotMatch(source, /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u);
});
