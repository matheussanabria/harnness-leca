// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("cartao oferece drag e alternativa acessivel anterior e proxima", () => {
  const card = read("ui/public/js/modules/design-scrum-story-card.js");
  assert.match(card, /draggable="true"/);
  assert.match(card, /startScrumStoryDrag/);
  assert.match(card, /moveScrumStoryByStep/);
  assert.match(card, /etapa anterior/);
  assert.match(card, /proxima etapa/);
  assert.match(card, /fa-arrow-left/);
  assert.match(card, /fa-arrow-right/);
  assert.match(card, /aria-hidden="true"/);
});

test("drag e botoes usam o mesmo endpoint versionado por raia de origem", () => {
  const transition = read("ui/public/js/modules/design-scrum-story-transition.js");
  const sprint = read("ui/public/js/modules/design-scrum-sprint.js");
  const router = read("ui/server/routes/scrum.routes.js");
  const controller = read("ui/server/controllers/scrum-transition.controller.js");
  assert.match(transition, /scrum\/story\/transition/);
  assert.match(transition, /JSON\.stringify\(\{ storyId, fromLaneId, toLaneId \}\)/);
  assert.match(transition, /response\.status === 409/);
  assert.match(sprint, /allowScrumStoryDrop/);
  assert.match(sprint, /dropScrumStory/);
  assert.match(router, /scrum\\\/story\\\/transition/);
  assert.match(controller, /SCRUM_STORY_CONFLICT/);
  assert.match(controller, /send\(res, 409/);
});

test("movimento anuncia resultado e restaura foco depois da renderizacao", () => {
  const transition = read("ui/public/js/modules/design-scrum-story-transition.js");
  const css = read("ui/public/css/design/12-scrum-story-transitions.css");
  const aggregator = read("ui/public/css/design.css");
  assert.match(transition, /aria-live/);
  assert.match(transition, /role", "status/);
  assert.match(transition, /requestAnimationFrame/);
  assert.match(transition, /\.focus\(\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /44px/);
  assert.match(aggregator, /12-scrum-story-transitions\.css/);
});

test("drawer projeta o historico persistido sem alterar o cartao", () => {
  const drawer = read("ui/public/js/modules/design-scrum-story-drawer.js");
  assert.match(drawer, /transitionHistory/);
  assert.match(drawer, /story-transition-history/);
  assert.match(drawer, /clock-rotate-left/);
  assert.match(drawer, /esc\(item\.occurredAt\)/);
});

test("edicao torna status somente leitura para impedir bypass do workflow", () => {
  const modal = read("ui/public/js/modules/design-scrum-story-modal.js");
  assert.match(modal, /Status legado \(movimente no quadro\)/);
  assert.match(modal, /isEdit \? "disabled"/);
});
