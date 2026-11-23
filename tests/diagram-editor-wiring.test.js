// EP-21.04: how the diagram island is wired into the legacy Design shell (the tab, the catalog, the starter data).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.join(__dirname, "..");
const modules = (...p) => import(pathToFileURL(path.join(ROOT, "ui/public/js/modules", ...p)).href);
const features = (...p) => import(pathToFileURL(path.join(ROOT, "ui/web/src/features", ...p)).href);
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

test("CP-07 the catalog templates equal the island templates, so a new diagram opens exactly as the island expects", async () => {
  const legacy = (await modules("design-canvas-diagram-templates.js")).DIAGRAM_TEMPLATES;
  const island = (await features("diagram", "templates.ts")).TEMPLATES;
  assert.equal(legacy.length, island.length);
  for (const [i, template] of island.entries()) {
    assert.equal(legacy[i].key, template.key);
    assert.equal(legacy[i].diagramType, template.type);
    assert.equal(legacy[i].source, template.source, `${template.key}: source drifted between the two lists`);
    assert.equal(legacy[i].title, template.title);
    assert.equal(legacy[i].label, template.label);
  }
});

test("CP-07 a catalog starter is a mermaid@1 payload the island reads back", async () => {
  const { DIAGRAM_TEMPLATES, diagramStarter, findDiagramTemplate } = await modules("design-canvas-diagram-templates.js");
  const { readDiagramData } = await features("diagram", "data.ts");
  for (const template of DIAGRAM_TEMPLATES) {
    const data = readDiagramData(diagramStarter(template));
    assert.ok(data, `${template.key} payload was refused by readDiagramData`);
    assert.equal(data.source, template.source);
  }
  assert.equal(findDiagramTemplate("nope").key, "flowchart", "an unknown key falls back to the flowchart");
});

test("CP-07 the catalog lists the six types in the New menu (diagram kind only)", async () => {
  const { diagramTemplateMenuHtml } = await modules("design-canvas-diagram-templates.js");
  const html = diagramTemplateMenuHtml();
  assert.equal((html.match(/data-canvas-template=/g) || []).length, 6);
  assert.match(html, /role="menu"/);
  assert.doesNotMatch(read("ui/public/js/modules/design-canvas-diagram-templates.js"), /[\u{1F300}-\u{1FAFF}]/u, "no emojis");
});

test("CP-12 the Diagramas tab is registered everywhere a Design view must be known", async () => {
  const router = await import(pathToFileURL(path.join(ROOT, "ui/public/js/shared/router.js")).href);
  assert.ok(router.VIEW_SCREENS.includes("canvas-diagram"));
  assert.ok((await modules("design-island-views.js")).ISLAND_DESIGN_VIEWS.includes("canvas-diagram"));
  assert.match(read("ui/public/js/modules/design-view-state.js"), /"canvas-diagram"/);
  assert.match(read("ui/public/index.html"), /data-view="canvas-diagram"[^>]*>\s*<i class="fa-solid fa-diagram-project">/);
  const { SCREENS } = require("../ui/server/services/screen-state/registry");
  assert.ok(SCREENS.some((screen) => screen.id === "canvas-diagram"));
});

test("CP-12 the workspace opens the diagram view without a canvas chat mode, and mind maps and boards are unchanged", async () => {
  const source = read("ui/public/js/modules/design-canvas-workspace.js");
  assert.match(source, /"canvas-diagram": \{ kind: "diagram"/);
  assert.match(source, /info\.kind === "diagram" \? null : \{ kind: info\.kind, slug \}/);
  assert.match(source, /"canvas-mindmap": \{ kind: "mindmap"/);
  assert.match(source, /"canvas-board": \{ kind: "board"/);
  const { canvasWorkspaceHtml } = await modules("design-canvas-workspace.js");
  const html = canvasWorkspaceHtml("canvas-diagram");
  assert.match(html, /Diagramas/);
  assert.match(html, /fa-diagram-project/);
});

test("CP-12 the catalog creates a diagram with the chosen template and keeps the old kinds working", async () => {
  const { canvasCatalogHtml } = await modules("design-canvas-catalog.js");
  const item = { id: "d1", title: "Meu fluxo", kind: "diagram", rev: 1, updatedAt: "2026-11-23T10:00:00Z" };
  const html = canvasCatalogHtml([item], { kind: "diagram", selectedId: "d1" });
  assert.match(html, /Diagramas do projeto \(1\)/);
  assert.match(html, /Diagrama/);
  assert.match(canvasCatalogHtml([], { kind: "board" }), /Nenhum quadro no projeto/);
  assert.match(canvasCatalogHtml([], { kind: "mindmap" }), /Nenhum mapa mental no projeto/);
});

test("CP-11 the island entry does not import Mermaid statically (it loads on first use)", () => {
  for (const file of ["main.tsx", "DiagramIsland.tsx", "DiagramEditor.tsx", "usePreview.ts", "ExportMenu.tsx"]) {
    const source = read("ui/web/src/islands/canvas-diagram", file);
    assert.doesNotMatch(source, /from "mermaid"|import mermaid/, `${file} imports mermaid statically`);
  }
  for (const file of ["render.ts", "validate.ts"]) {
    assert.match(read("ui/web/src/features/diagram", file), /await import\("mermaid"\)/, `${file} must lazy import`);
  }
});
