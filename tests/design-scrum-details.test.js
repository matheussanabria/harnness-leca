// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("cartao abre detalhes e mantem edicao como acao explicita", () => {
  const card = read("ui/public/js/modules/design-scrum-story-card.js");
  assert.match(card, /openStoryDetailsById/);
  assert.match(card, /openEditStoryById/);
  assert.doesNotMatch(card, /JSON\.stringify\(story\)/);
  assert.match(card, /fa-solid/);
});

test("drawer renderiza conteudo seguro, criterios, cenarios, secoes documentadas, comentarios e relacionamentos", () => {
  const drawer = read("ui/public/js/modules/design-scrum-story-drawer.js");
  assert.match(drawer, /import \{ md \}/);
  assert.match(drawer, /acceptanceCriteria/);
  assert.match(drawer, /scenarios/);
  assert.match(drawer, /story\.context/);
  assert.match(drawer, /story\.userStory/);
  assert.match(drawer, /story\.outOfScope/);
  assert.match(drawer, /story\.additionalInfo/);
  assert.match(drawer, /commentsHtml/);
  assert.match(drawer, /relationships/);
  assert.match(drawer, /event\.key === "Escape"/);
});

test("kanban suporta selecao de todas as sprints e sincronizacao de sprint ativa", () => {
  const sprint = read("ui/public/js/modules/design-scrum-sprint.js");
  const actions = read("ui/public/js/modules/design-scrum-actions.js");
  assert.match(sprint, /value="all"/);
  assert.match(sprint, /currentFilter === "all"/);
  assert.match(actions, /ds\.selectedSprintFilter/);
});

test("mapeamento de status possui UI, rota e persistencia separada", () => {
  const ui = read("ui/public/js/modules/design-scrum-status-mapping.js");
  const router = read("ui/server/router.js");
  const persistence = read("ui/server/services/project-scrum-persist.js");
  assert.match(ui, /scrum\/status-mapping/);
  assert.match(router, /scrum\\\/status-mapping/);
  assert.match(persistence, /statusMapping/);
});

test("agregador carrega os estilos focados do painel lateral", () => {
  const css = read("ui/public/css/design.css");
  assert.match(css, /09-scrum-story-details\.css/);
});

test("kanban usa laneId do backend e modal acessivel configura as doze raias", () => {
  const sprint = read("ui/public/js/modules/design-scrum-sprint.js");
  const config = read("ui/public/js/modules/design-scrum-lane-config.js");
  const data = read("ui/public/js/modules/design-scrum-data.js");
  const router = read("ui/server/router.js");
  const css = read("ui/public/css/design.css");
  assert.match(sprint, /scrum\.lanes/);
  assert.match(sprint, /story\.laneId === lane\.id/);
  assert.doesNotMatch(data, /STATUS_COLUMNS/);
  assert.match(config, /aria-labelledby/);
  assert.match(config, /aria-describedby/);
  assert.match(config, /reportValidity/);
  assert.match(config, /scrum\/lanes/);
  assert.match(router, /scrum\\\/lanes/);
  assert.match(css, /10-scrum-lanes\.css/);
});
