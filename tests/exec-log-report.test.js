// Executive log inside the executive report: dossiers of the delivered stories and the new report sections.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { collectDossiers, frontMatter, storyIdOf } = require("../tools/lib/exec-log/dossiers");
const { renderReport } = require("../tools/lib/exec-report/render");
const { main } = require("../tools/exec-log");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "exec-log-report-"));

const STAGES = [
  "| Stage | Status | Reason | File | Note |",
  "|---|---|---|---|---|",
  "| Start (start) | done | | `_status.md` | |",
  "| Prototype (prototype) | skipped | Sem elemento visual novo | | |",
  "| Commit and PR (commit-pr) | open | | | |",
].join("\n");

function makeDossier(root, slug, story) {
  const dir = path.join(root, "docs", "features", slug);
  fs.mkdirSync(path.join(dir, "evidence"), { recursive: true });
  fs.writeFileSync(path.join(dir, "evidence", "a.png"), "x");
  fs.writeFileSync(path.join(dir, "_status.md"), `---\nstory: ${story}\nroute: completa\n---\n${STAGES}\n`);
}

test("EL-06: dossiers of the delivered stories are read: route, stage counts and evidence files", () => {
  const root = tmp();
  makeDossier(root, "motion-format", "EP-24.01");
  makeDossier(root, "header-fix", "EP-24.03-fix");
  makeDossier(root, "other", "EP-30.01");
  const rows = collectDossiers(root, ["24.01", "24.03"]).map((d) => [d.slug, d.story, d.done, d.skipped, d.open, d.evidenceFiles]);
  assert.deepEqual(rows, [
    ["header-fix", "EP-24.03-fix", 1, 1, 1, 1],
    ["motion-format", "EP-24.01", 1, 1, 1, 1],
  ]);
  assert.deepEqual(collectDossiers(root, []), []);
  assert.deepEqual(collectDossiers(path.join(root, "missing"), ["24.01"]), []);
  assert.equal(storyIdOf("EP-24.03-fix"), "24.03");
  assert.equal(storyIdOf("17.02"), "17.02");
  assert.equal(storyIdOf(""), "");
  assert.deepEqual(frontMatter('---\nid: EP-24.01\ntitulo: "Formato"\n---\n# x'), { id: "EP-24.01", titulo: "Formato" });
});

const LOG = [
  { id: "L-0001", date: "2026-11-21", kind: "decision", epic: "EP-24", title: "Motion no Atelier", summary: "Sem editor separado.", evidence: ["docs/adr.md"] },
  { id: "L-0002", date: "2026-11-21", kind: "correction", epic: "EP-24", story: "24.06", title: "Portão HTTP", summary: "PUT e DELETE davam 405.", evidence: ["ad39e62"] },
  { id: "L-0003", date: "2026-11-22", kind: "approval", title: "EP-24 aceito", summary: "Depois do teste no Atelier.", evidence: [] },
  { id: "L-0004", date: "2026-11-22", kind: "metric", title: "Suíte completa", summary: "Tudo.", evidence: [], metrics: { tests_pass: 2929, tests_fail: 0 } },
  { id: "L-0005", date: "2026-11-22", kind: "finding", title: "Achado", summary: "Algo.", evidence: ["a.md"] },
];
const BASE = { since: "2026-11-21", until: "2026-11-22", merges: [], stories: new Map(), totals: { commits: 3, insertions: 10, deletions: 2 } };

test("EL-07: the report gains decisions, findings and corrections, approvals, quality and open items from the log", () => {
  const open = [
    { id: "L-0009", date: "2026-11-22", kind: "pending", title: "Aceitar o EP-17", summary: "Depende do usuário." },
    { id: "L-0010", date: "2026-11-22", kind: "risk", title: "Host", summary: "Porta fixa." },
  ];
  const dossiers = [{ slug: "motion-format", story: "EP-24.01", route: "completa", done: 8, skipped: 1, open: 0, evidenceFiles: 3 }];
  const md = renderReport({ ...BASE, log: { entries: LOG, open }, dossiers });
  assert.match(md, /- Registro executivo: 1 decisões, 2 achados e correções, 1 aprovações; 2 itens em aberto\./);
  assert.match(md, /- Processo: 1 dossiês, 8 etapas feitas, 1 dispensadas com motivo, 0 abertas\./);
  assert.match(md, /## Decisões\n\n- \*\*L-0001\*\* \(2026-11-21, EP-24\) Motion no Atelier\. Sem editor separado\. Evidências: `docs\/adr\.md`\./);
  assert.match(md, /## Achados e correções \(inclusive erros nossos\)\n\n- \*\*L-0002\*\* \(2026-11-21, EP-24 24\.06\) Portão HTTP/);
  assert.match(md, /## Aprovações\n\n- \*\*L-0003\*\*/);
  assert.match(md, /## Qualidade\n\n\| Data \| Registro \| tests_pass \| tests_fail \|\n\|---\|---\|---\|---\|\n\| 2026-11-22 \| L-0004 Suíte completa \| 2929 \| 0 \|/);
  assert.match(md, /\| motion-format \| EP-24\.01 \| completa \| 8 \| 1 \| 0 \| 3 \|/);
  assert.match(md, /- \*\*Itens em aberto do registro executivo\*\*\n  - L-0009 \[pendência\] Aceitar o EP-17\. Depende do usuário\.\n  - L-0010 \[risco\] Host\. Porta fixa\./);
  assert.ok(md.indexOf("## Decisões") < md.indexOf("## Pendências"), "log sections come before the open items");
  assert.match(md, /## Evidências citadas\n\n- `docs\/adr\.md`\n- `ad39e62`\n- `a\.md`/);
});

test("EL-08: without a log or dossiers the report has none of the new sections", () => {
  const plain = renderReport(BASE);
  for (const text of ["## Decisões", "## Achados", "## Aprovações", "## Qualidade", "## Evidências citadas", "Registro executivo", "- Processo:"]) assert.ok(!plain.includes(text), text);
  assert.match(plain, /- Nenhuma registrada\./);
  const empty = renderReport({ ...BASE, log: { entries: [], open: [] }, dossiers: [] });
  assert.ok(empty.includes("- Registro executivo: 0 decisões, 0 achados e correções, 0 aprovações; 0 itens em aberto."));
  assert.match(empty, /- Nenhuma registrada\./);
});

test("EL-09: report through the exec-log CLI is the exec-report output with the log in it", () => {
  const lines = [];
  main(["report", "--since", "2026-11-21", "--until", "2026-11-22"], { log: (m) => lines.push(m) });
  assert.match(lines.join("\n"), /^# Relatório executivo: 2026-11-21 a 2026-11-22/);
  assert.throws(() => main(["report", "--since", "ontem"], { log() {} }), /--since must be YYYY-MM-DD/);
});
