// @ts-check
// Maturidade da historia (draft/refining/ready), entrada na sprint e Definition of Ready mecanica.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { getCanonicalLanes } = require("../ui/server/services/project-scrum-lanes");
const { upsertStory, assignStorySprint } = require("../ui/server/services/project-scrum-ops");
const { loadProjectScrum } = require("../ui/server/services/project-scrum-persist");

const GOOD = {
  title: "Exportar relatorio em CSV",
  description: "O usuario precisa exportar o relatorio mensal em CSV para conferir no Excel.",
  acceptanceCriteria: ["O botao Exportar gera um arquivo .csv", "O arquivo contem todas as colunas visiveis"],
};

function scrumData(stories) {
  return {
    schemaVersion: 2, migrationHistory: [], activeSprintId: "sprint-1",
    sprints: [{ id: "sprint-1", name: "Sprint 1" }, { id: "sprint-2", name: "Sprint 2" }],
    epics: [], stories, lanes: getCanonicalLanes(), lanesRevision: 0, transitionHistory: [],
  };
}

function withProject(data, run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "scrum-maturity-"));
  const project = path.join(root, "project");
  fs.mkdirSync(project, { recursive: true });
  const file = path.join(project, "scrum.json");
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  try { return run({ project, file, stored: () => JSON.parse(fs.readFileSync(file, "utf8")) }); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

const find = (result, id) => result.scrum.stories.find((story) => story.id === id);

test("historia sem maturidade gravada vale ready na leitura e o arquivo nao muda", () => withProject(scrumData([
  { id: "legacy-1", key: "L-1", title: "Antiga", sprintId: "sprint-1", status: "todo", laneId: "pronto-para-dev", origin: "local" },
]), ({ project, file }) => {
  const before = fs.readFileSync(file, "utf8");
  assert.equal(find(loadProjectScrum("t", project, project), "legacy-1").maturity, "ready");
  assert.equal(fs.readFileSync(file, "utf8"), before);
}));

test("rascunho nasce no backlog, sem cair na sprint ativa", () => withProject(scrumData([]), ({ project, stored }) => {
  const result = upsertStory("t", project, project, { id: "d-1", title: "Ideia solta", maturity: "draft" });
  assert.equal(find(result, "d-1").maturity, "draft");
  assert.equal(find(result, "d-1").sprintId, null);
  assert.equal(stored().stories[0].sprintId, null);
  const refining = upsertStory("t", project, project, { id: "r-1", title: "Em refinamento", maturity: "refining" });
  assert.equal(find(refining, "r-1").sprintId, null);
}));

test("historia criada sem maturidade continua indo para a sprint ativa (comportamento anterior)", () => withProject(scrumData([]), ({ project }) => {
  const result = upsertStory("t", project, project, { id: "n-1", title: "Historia comum" });
  assert.equal(find(result, "n-1").sprintId, "sprint-1");
  assert.equal(find(result, "n-1").maturity, "ready");
}));

test("maturidade invalida e recusada sem gravar", () => withProject(scrumData([]), ({ project, file }) => {
  const before = fs.readFileSync(file, "utf8");
  assert.throws(() => upsertStory("t", project, project, { id: "x", title: "Historia", maturity: "pronta" }), /invalida/);
  assert.equal(fs.readFileSync(file, "utf8"), before);
}));

test("editar uma historia do backlog sem enviar sprintId nao a puxa para a sprint ativa", () => withProject(scrumData([
  { id: "b-1", key: "B-1", title: "No backlog", sprintId: null, status: "todo", laneId: "pronto-para-dev", origin: "local" },
  { id: "s-2", key: "S-2", title: "Na sprint dois", sprintId: "sprint-2", status: "todo", laneId: "pronto-para-dev", origin: "local" },
]), ({ project }) => {
  upsertStory("t", project, project, { id: "b-1", title: "No backlog editada" });
  const result = upsertStory("t", project, project, { id: "s-2", title: "Na sprint dois editada" });
  assert.equal(find(result, "b-1").sprintId, null);
  assert.equal(find(result, "s-2").sprintId, "sprint-2");
  assert.equal(find(result, "b-1").title, "No backlog editada");
}));

test("editar nao zera a maturidade gravada", () => withProject(scrumData([]), ({ project, stored }) => {
  upsertStory("t", project, project, { id: "d-1", title: "Rascunho", maturity: "draft" });
  upsertStory("t", project, project, { id: "d-1", title: "Rascunho com titulo novo" });
  assert.equal(stored().stories[0].maturity, "draft");
  assert.equal(stored().stories[0].sprintId, null);
}));

test("rascunho e refinamento nao entram na sprint; pronta entra", () => withProject(scrumData([]), ({ project, stored }) => {
  upsertStory("t", project, project, { id: "d-1", title: "Rascunho", maturity: "draft" });
  assert.throws(() => assignStorySprint("t", project, project, "d-1", "sprint-1"), /rascunho ou refinamento/);
  assert.equal(stored().stories[0].sprintId, null);
  upsertStory("t", project, project, { id: "d-1", ...GOOD, maturity: "ready" });
  const result = assignStorySprint("t", project, project, "d-1", "sprint-1");
  assert.equal(find(result, "d-1").sprintId, "sprint-1");
  // tirar da sprint continua permitido para qualquer maturidade
  assert.equal(find(assignStorySprint("t", project, project, "d-1", ""), "d-1").sprintId, null);
}));

test("passar para ready exige a Definition of Ready e explica o que falta", () => withProject(scrumData([]), ({ project, stored }) => {
  upsertStory("t", project, project, { id: "d-1", title: "Curta", maturity: "draft" });
  assert.throws(
    () => upsertStory("t", project, project, { id: "d-1", maturity: "ready" }),
    (error) => /Definition of Ready/.test(error.message) && /description/.test(error.message) && /criteria-present/.test(error.message),
  );
  assert.equal(stored().stories[0].maturity, "draft");
  const ok = upsertStory("t", project, project, { id: "d-1", ...GOOD, maturity: "ready" });
  assert.equal(find(ok, "d-1").maturity, "ready");
}));

test("criar direto como ready tambem passa pela Definition of Ready", () => withProject(scrumData([]), ({ project, stored }) => {
  assert.throws(() => upsertStory("t", project, project, { id: "n-1", title: "Sem nada", maturity: "ready" }), /Definition of Ready/);
  assert.equal(stored().stories.length, 0);
}));

test("voltar para rascunho com a historia na sprint e recusado", () => withProject(scrumData([
  { id: "p-1", key: "P-1", title: "Pronta e na sprint", sprintId: "sprint-1", status: "todo", laneId: "pronto-para-dev", origin: "local" },
]), ({ project, stored }) => {
  assert.throws(() => upsertStory("t", project, project, { id: "p-1", maturity: "draft" }), /Retire a historia da sprint/);
  assert.equal(stored().stories[0].maturity, undefined);
}));

test("historia legada sem maturidade enviando ready nao reavalia a DoR (ja era pronta)", () => withProject(scrumData([
  { id: "legacy-1", key: "L-1", title: "Antiga", sprintId: "sprint-1", status: "todo", laneId: "pronto-para-dev", origin: "local" },
]), ({ project }) => {
  const result = upsertStory("t", project, project, { id: "legacy-1", maturity: "ready" });
  assert.equal(find(result, "legacy-1").maturity, "ready");
}));

test("payload parcial nao apaga titulo, descricao nem criterios da historia gravada", () => withProject(scrumData([]), ({ project, stored }) => {
  upsertStory("t", project, project, { id: "d-1", ...GOOD, maturity: "draft", points: 5, epicId: "epic-1", priority: "alta" });
  const result = upsertStory("t", project, project, { id: "d-1", maturity: "ready" });
  const story = find(result, "d-1");
  assert.equal(story.title, GOOD.title);
  assert.equal(story.description, GOOD.description);
  assert.deepEqual(story.acceptanceCriteria, GOOD.acceptanceCriteria);
  assert.equal(story.points, 5);
  assert.equal(story.epicId, "epic-1");
  assert.equal(story.priority, "alta");
  assert.equal(story.maturity, "ready");
  assert.equal(stored().stories.length, 1);
}));

test("upsert com sprintId nao empurra rascunho nem refinamento para a sprint (achado da revisao)", () => withProject(scrumData([]), ({ project, stored }) => {
  upsertStory("t", project, project, { id: "d-1", title: "Rascunho", maturity: "draft" });
  assert.throws(() => upsertStory("t", project, project, { id: "d-1", sprintId: "sprint-1" }), /rascunho ou refinamento nao entra na sprint/);
  assert.equal(stored().stories[0].sprintId, null);
  upsertStory("t", project, project, { id: "r-1", title: "Refinando", maturity: "refining" });
  assert.throws(() => upsertStory("t", project, project, { id: "r-1", title: "Refinando 2", sprintId: "sprint-2" }), /rascunho ou refinamento/);
  // criar ja como rascunho dentro de uma sprint tambem e recusado
  assert.throws(() => upsertStory("t", project, project, { id: "n-1", title: "Nova", maturity: "draft", sprintId: "sprint-1" }), /rascunho ou refinamento nao entra na sprint/);
  assert.equal(stored().stories.length, 2);
  // editar o titulo de um rascunho (sem sprintId) segue permitido
  assert.equal(find(upsertStory("t", project, project, { id: "d-1", title: "Rascunho editado" }), "d-1").title, "Rascunho editado");
}));
