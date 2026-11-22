// Executive report (tools/exec-report.js): merge subjects, story evidence and the rendered Markdown.
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseMergeLine, parseStory } = require("../tools/lib/exec-report/collect");
const { renderReport } = require("../tools/lib/exec-report/render");
const { options } = require("../tools/exec-report");

test("merge subjects: one story, several stories, epic only, other", () => {
  assert.deepEqual(parseMergeLine("a1|2026-11-21|Merge EP-23.05: safe restart").stories, ["23.05"]);
  const multi = parseMergeLine("b2|2026-11-21|Merge EP-24.01, 24.02 and 24.04: motion format");
  assert.deepEqual(multi.stories, ["24.01", "24.02", "24.04"]);
  assert.equal(multi.epic, "EP-24");
  assert.equal(parseMergeLine("c3|2026-11-21|Merge EP-24 acceptance: closed (6/6)").kind, "epic");
  const other = parseMergeLine("d4|2026-11-20|Merge test fix: golden");
  assert.equal(other.kind, "other");
  assert.equal(other.epic, null);
  assert.equal(parseMergeLine("e5|2026-11-22|Merge EP-21.03: model 1.2 | extra").subject, "EP-21.03: model 1.2 | extra");
});

const STORY = `---
id: EP-23.05
titulo: "Reinício seguro"
epico: EP-23
status: implementada
---

## 7. Critérios de aceite
- [x] Espera a resposta terminar.
- [ ] A faixa aparece e some.

## 9. Evidências
- **Drenagem:** o lote pendente é gravado antes.
- **Pendente:** conferir no navegador.
- **Divergências:** anexos não voltam ao compositor.
`;

test("story: pending only from the Pendente label, open criteria, divergences", () => {
  const s = parseStory(STORY, "x.md");
  assert.equal(s.id, "23.05");
  assert.equal(s.status, "implementada");
  assert.deepEqual(s.pending, ["conferir no navegador."], "a bullet that only mentions 'pendente' is not pending");
  assert.deepEqual(s.openCriteria, ["A faixa aparece e some."]);
  assert.deepEqual(s.divergences, ["anexos não voltam ao compositor."]);
});

test("render: summary, one row per story, pending, warnings", () => {
  const merges = [
    parseMergeLine("a1|2026-11-20|Merge EP-23.05: first"),
    parseMergeLine("a2|2026-11-21|Merge EP-23.05: test fix"),
    parseMergeLine("b1|2026-11-21|Merge EP-23.07 story: planned"),
    parseMergeLine("c1|2026-11-21|Merge EP-24.01: done"),
    parseMergeLine("d1|2026-11-21|Merge fix: header"),
  ];
  const stories = new Map([
    ["23.05", parseStory(STORY, "x.md")],
    ["23.07", parseStory(STORY.replace("EP-23.05", "EP-23.07").replace("implementada", "planejada"), "y.md")],
    ["24.01", parseStory(STORY.replace("EP-23.05", "EP-24.01").replace("implementada", "concluida"), "z.md")],
  ]);
  const md = renderReport({ since: "2026-11-19", until: "2026-11-22", merges, stories, totals: { commits: 5, insertions: 10, deletions: 2 } });
  assert.match(md, /# Relatório executivo: 2026-11-19 a 2026-11-22/);
  assert.match(md, /\*\*2 histórias entregues\*\* e 1 planejadas, em 2 épicos/);
  assert.equal((md.match(/\| 23\.05 \|/g) || []).length, 1, "a story merged twice is one row");
  assert.match(md, /\| 23\.05 \| Reinício seguro \| Implementada \| 2026-11-21 \| `a2` \|/);
  assert.match(md, /Outras entregas[\s\S]*fix: header/);
  assert.match(md, /conferir no navegador/);
  assert.doesNotMatch(md, /\*\*23\.07[^\n]*\*\*\n  - /, "a planned story has no pending list");
  assert.match(md, /Atenção: 1 histórias marcadas como concluídas ainda têm critérios desmarcados \(24\.01\)/);
  assert.match(md, /Decisões que mudaram o plano/);
});

test("options: defaults to the last 7 days and validates dates", () => {
  const o = options([]);
  assert.match(o.since, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(o.branch, "main");
  assert.throws(() => options(["--since", "ontem"]), /YYYY-MM-DD/);
});
