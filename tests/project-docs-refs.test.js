// @ts-check
// Reference index of the documentation reader: one test per reference kind, CRLF files and the real repo.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createDocAccess } = require("../ui/server/services/project-docs/confine");
const { readDocTree } = require("../ui/server/services/project-docs/tree");
const { buildRefsIndex, getRefsIndex, screenRefs } = require("../ui/server/services/project-docs/refs-index");
const { buildCatalog } = require("../ui/server/services/project-docs/catalog");
const { parseStory, parseTrace, parseAliases } = require("../ui/server/services/project-docs/refs-parsers");

const CRLF = (lines) => lines.join("\r\n");
const F = "doc/sistema/features";

function write(root, rel, text) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

/** Two features and three stories; _status.md and regras.md use CRLF on purpose. */
function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "project-docs-refs-"));
  write(root, `${F}/calculo/_status.md`, CRLF(["---", 'aliases: ["Status: Cálculo"]', "status: rascunho", "historias:", "  - DIS-443 principal", "  - DIS-439 secundaria", "  - DIS-454 secundaria", "---", "# Cálculo"]));
  write(root, `${F}/calculo/regras.md`, CRLF(["# Regras", "", "| Id | Regra | Código |", "|---|---|---|", "| RN-calculo-001 | Um **medicamento** por chamada | `S` |", "| ~~RN-calculo-002~~ | Sobra abate a seguinte | `S` |", "| RN-calculo-003 | Embalagem ausente | `S` |", "| texto | sem id | |"]));
  write(root, `${F}/calculo/rastreio.yml`, CRLF(["funcionalidade: calculo", "cenarios:", '  CD-01: { titulo: "intervalo em dias corridos", historia: DIS-439 }', "  CA-443-6:", '    titulo: "campos conforme o protótipo"', "regras:", "  RN-calculo-001:", "    codigo: [S]"]));
  write(root, `${F}/calculo/02-bdd.md`, "# BDD");
  write(root, `${F}/calculo/notas.md`, "# Notas");
  write(root, `${F}/tela/_status.md`, CRLF(["---", 'aliases: ["Status: Tela"]', "historias:", "  - DIS-505 principal", "  - DIS-443 secundaria", "---"]));
  write(root, `${F}/tela/rastreio.yml`, '  CA-443-6:\n    titulo: "outra prova"\n');
  write(root, `${F}/_historias.md`, CRLF(["# Registro", "## Apelidos", "| Placeholder | Virou |", "|---|---|", "| `DIS-NOVA-PRESCRICAO` | **DIS-505** |"]));
  write(root, "doc/scrum/DIS-443/user-story.md", CRLF(["# DIS-443 Integração", "## Critérios de Aceitação", "- **Critério 1:** cronograma próprio", "- **Critério 2:** recálculo só do dispensado"]));
  write(root, "doc/scrum/dis-454/user-story.md", "# DIS-454 Cobertura mínima\n");
  write(root, "doc/scrum/DIS-NOVA-PRESCRICAO/user-story.md", "# Rascunho da nova prescrição\n");
  write(root, "doc/INDICE-REVISAO.md", "# Índice");
  write(root, "doc/CHECKLIST-REVISAO.md", "# Checklist");
  write(root, "doc/sistema/02-pendencias-e-riscos.md", "# Pendências");
  return root;
}

function indexOf(root) {
  const access = createDocAccess(root);
  const listing = readDocTree(access);
  return { access, listing, index: buildRefsIndex(access, listing.files) };
}

test("RN: every rule row of a CRLF regras.md is indexed with its anchor, line and plain text", () => {
  const { index } = indexOf(makeRepo());
  assert.deepEqual(Object.keys(index.rn).sort(), ["RN-calculo-001", "RN-calculo-002", "RN-calculo-003"]);
  assert.deepEqual(index.rn["RN-calculo-001"], { path: "sistema/features/calculo/regras.md", anchor: "rn-calculo-001", line: 5, text: "Um medicamento por chamada", feature: "calculo" });
});

test("_status.md in CRLF: all stories of historias: are read, with their role", () => {
  const { index } = indexOf(makeRepo());
  assert.deepEqual(index.features.calculo.stories, [
    { id: "DIS-443", role: "principal" },
    { id: "DIS-439", role: "secundaria" },
    { id: "DIS-454", role: "secundaria" },
  ]);
  assert.equal(index.features.calculo.title, "Cálculo");
  assert.equal(index.features.calculo.status, "rascunho");
});

test("feature: dossier documents by role, other notes apart, and the story that owns it", () => {
  const { index } = indexOf(makeRepo());
  assert.equal(index.features.calculo.docs.regras, "sistema/features/calculo/regras.md");
  assert.equal(index.features.calculo.docs.bdd, "sistema/features/calculo/02-bdd.md");
  assert.deepEqual(index.features.calculo.others, ["sistema/features/calculo/notas.md"]);
  assert.deepEqual(index.storyFeatures["DIS-443"], ["calculo"]);
  assert.deepEqual(index.storyFeatures["DIS-505"], ["tela"]);
});

test("DIS-NNN and Critério N: title, criteria anchors, lower-case folders and drafts with their alias", () => {
  const { index } = indexOf(makeRepo());
  assert.equal(index.stories["DIS-443"].title, "DIS-443 Integração");
  assert.deepEqual(index.stories["DIS-443"].criteria["2"], { anchor: "criterio-2", line: 4, text: "recálculo só do dispensado" });
  assert.equal(index.stories["DIS-454"].path, "scrum/dis-454/user-story.md");
  assert.equal(index.stories["DIS-NOVA-PRESCRICAO"].draft, true);
  assert.equal(index.stories["DIS-NOVA-PRESCRICAO"].aliasOf, "DIS-505");
  assert.deepEqual(index.aliases, { "DIS-NOVA-PRESCRICAO": "DIS-505" });
});

test("trace ids: inline and block titles, RN keys left to regras.md, a repeated id keeps every place", () => {
  const { index } = indexOf(makeRepo());
  assert.deepEqual(index.trace["CD-01"], [{ path: "sistema/features/calculo/rastreio.yml", line: 3, title: "intervalo em dias corridos", feature: "calculo" }]);
  assert.deepEqual(index.trace["CA-443-6"].map((t) => t.feature), ["calculo", "tela"]);
  assert.equal(index.trace["RN-calculo-001"], undefined);
});

test("screenRefs: field stories by final screen id and references that do not resolve", () => {
  const { index } = indexOf(makeRepo());
  const screens = [{ id: "s2", rules: [{ rn: ["RN-calculo-001", "RN-calculo-999"] }] }];
  const links = {
    "DIS-443": { dona: [{ screenId: "s2", fieldId: "embalagem" }], relacionada: [] },
    "DIS-499": { dona: [], relacionada: [{ screenId: "s2", fieldId: "embalagem" }, { screenId: null, fieldId: null }] },
  };
  const r = screenRefs(index, screens, links);
  assert.deepEqual(r.fieldStories, { s2: { embalagem: { principal: ["DIS-443"], relacionadas: ["DIS-499"] } } });
  assert.deepEqual(r.missing, [{ screen: "s2", kind: "rn", id: "RN-calculo-999" }, { screen: "s2", kind: "story", id: "DIS-499" }]);
});

test("cache: the index is rebuilt when a file it reads changes", () => {
  const root = makeRepo();
  const { access, listing } = indexOf(root);
  const first = getRefsIndex(root, access, listing.files);
  assert.equal(getRefsIndex(root, access, listing.files), first);
  write(root, `${F}/calculo/regras.md`, "| RN-calculo-004 | nova | |\n");
  const again = getRefsIndex(root, access, readDocTree(access).files);
  assert.notEqual(again, first);
  assert.deepEqual(Object.keys(again.rn).filter((id) => id.startsWith("RN-calculo")), ["RN-calculo-004"]);
});

test("catalog: review index, checklist, open issues, features, stories and drafts", () => {
  const { listing, index } = indexOf(makeRepo());
  const c = buildCatalog(listing.files, index);
  assert.deepEqual(c.revisao, ["INDICE-REVISAO.md"]);
  assert.deepEqual(c.checklist, ["CHECKLIST-REVISAO.md"]);
  assert.deepEqual(c.pendencias, ["sistema/02-pendencias-e-riscos.md"]);
  assert.deepEqual(c.funcionalidades.map((f) => f.slug), ["calculo", "tela"]);
  assert.deepEqual(c.historias.map((s) => s.id), ["DIS-443", "DIS-454"]);
  assert.deepEqual(c.rascunhos.map((s) => [s.id, s.aliasOf]), [["DIS-NOVA-PRESCRICAO", "DIS-505"]]);
});

test("parsers: LF and CRLF read the same", () => {
  const story = ["# T", "1. **Critério 3.** texto"];
  assert.deepEqual(parseStory(story.join("\n")), parseStory(story.join("\r\n")));
  const trace = ["  PS-31:", '    titulo: "laudos"'];
  assert.deepEqual(parseTrace(trace.join("\r\n")), [{ id: "PS-31", line: 1, title: "laudos" }]);
  assert.deepEqual(parseAliases(["## Apelidos", "| `DIS-NOVA-X` | DIS-1 |"].join("\r\n")), { "DIS-NOVA-X": "DIS-1" });
});

const REAL = path.join(os.homedir(), "git/saude/dispensacao");
test("real repo: the step 2 screen reaches DIS-443, DIS-505 and the calculation rules", { skip: !fs.existsSync(path.join(REAL, F)) }, () => {
  const { getProjectScreens } = require("../ui/server/services/project-screens.service");
  const { index } = indexOf(REAL);
  assert.ok(index.stories["DIS-443"] && index.stories["DIS-505"], "both stories are indexed");
  const ids = index.features["nova-prescricao"].stories.map((s) => s.id);
  assert.ok(ids.includes("DIS-505") && ids.includes("DIS-443"));
  const s2 = getProjectScreens("saude-dispensacao", REAL, REAL).screens.find((s) => s.featureScreenId === "nova-prescricao-s2");
  assert.ok(s2, "the step 2 screen is on the map");
  const cited = new Set(s2.rules.flatMap((r) => r.rn).map((id) => index.rn[id] && index.rn[id].feature));
  assert.ok(cited.has("calculo-dispensacao"), "step 2 cites rules of calculo-dispensacao");
});
