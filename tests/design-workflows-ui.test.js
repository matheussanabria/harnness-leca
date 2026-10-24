// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(".");
const MODULES = path.join(ROOT, "ui", "public", "js", "modules");
const NEW_FILES = [
  path.join(MODULES, "design-workflows-api.js"),
  path.join(MODULES, "design-workflows-state.js"),
  path.join(MODULES, "design-workflows-view.js"),
  path.join(MODULES, "design-workflows.js"),
  path.join(ROOT, "ui", "public", "css", "design", "27-workflows.css"),
  path.join(ROOT, "ui", "public", "css", "design", "28-workflows-plan.css"),
];
const INDEX_PATH = path.join(ROOT, "ui", "public", "index.html");
const DESIGN_PATH = path.join(MODULES, "design.js");
const CSS_INDEX_PATH = path.join(ROOT, "ui", "public", "css", "design.css");
const VIEW_STATE_PATH = path.join(MODULES, "design-view-state.js");

const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u;

test("EP-08.06: files stay under 300 lines and use no emoji", () => {
  for (const file of NEW_FILES) {
    assert.ok(fs.existsSync(file), `Arquivo ausente: ${file}`);
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/).length;
    assert.ok(lines <= 300, `${path.basename(file)} tem ${lines} linhas (limite 300).`);
    assert.equal(EMOJI_REGEX.test(content), false, `${path.basename(file)} contem emojis.`);
  }
});

test("EP-08.06: Workflows tab is registered in index.html and design.js", () => {
  const index = fs.readFileSync(INDEX_PATH, "utf8");
  assert.ok(index.includes(`data-view="workflows"`), "Aba de workflows ausente no index.html.");
  assert.ok(index.includes("fa-solid fa-diagram-project"), "Icone FontAwesome ausente na aba de workflows.");
  assert.ok(index.indexOf(`data-view="workflows"`) > index.indexOf(`data-view="routines"`), "A aba deve ficar ao lado de Rotinas.");

  const design = fs.readFileSync(DESIGN_PATH, "utf8");
  assert.ok(design.includes("renderWorkflowsWorkspace"), "design.js nao importa o modulo de workflows.");
  assert.ok(design.includes(`currentView === "workflows"`), "design.js nao despacha a view de workflows.");
  assert.ok(design.split(/\r?\n/).length < 300, "design.js passou de 300 linhas.");

  const viewState = fs.readFileSync(VIEW_STATE_PATH, "utf8");
  assert.ok(viewState.includes('"workflows"'), "A view de workflows nao pode ser restaurada.");

  const cssIndex = fs.readFileSync(CSS_INDEX_PATH, "utf8");
  assert.ok(cssIndex.includes("27-workflows.css"), "Folha de estilo dos workflows nao importada.");
  assert.ok(cssIndex.includes("28-workflows-plan.css"), "Folha de estilo do plano nao importada.");
});

test("EP-08.06: view uses FontAwesome only and modules avoid blocking dialogs", () => {
  const viewContent = fs.readFileSync(NEW_FILES[2], "utf8");
  const icons = viewContent.match(/fa-[a-z-]+/g) || [];
  assert.ok(icons.length > 0, "Nenhum icone encontrado na view.");
  assert.equal(icons.every((icon) => icon.startsWith("fa-")), true);
  assert.equal(/class="[^"]*\bfa\b(?!-)/.test(viewContent), false, "Classe de icone fora do padrao FontAwesome.");

  for (const file of NEW_FILES.filter((item) => item.endsWith(".js"))) {
    const content = fs.readFileSync(file, "utf8");
    assert.equal(/\b(?:window\.)?(?:confirm|alert|prompt)\s*\(/.test(content), false, `${path.basename(file)} usa dialogo bloqueante.`);
  }
});

test("EP-08.06: workflows module splits HTTP, state and view responsibilities", () => {
  const api = fs.readFileSync(NEW_FILES[0], "utf8");
  const state = fs.readFileSync(NEW_FILES[1], "utf8");
  const view = fs.readFileSync(NEW_FILES[2], "utf8");
  const controller = fs.readFileSync(NEW_FILES[3], "utf8");

  assert.ok(api.includes("/api/orchestration/workflows"));
  assert.ok(api.includes("/workflow-plan/"));
  assert.ok(api.includes("/workflow-runs"));
  assert.ok(state.includes("workflowsReducer") && state.includes("createWorkflowsState"));
  assert.ok(view.includes("renderPlan") && view.includes("renderWorkflowsShell"));
  assert.ok(controller.includes("renderWorkflowsWorkspace") && controller.includes("startCurrent"));
});
