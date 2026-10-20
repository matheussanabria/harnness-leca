// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const {
  mutateStructuralHtml,
  findNodeRangeByPid,
  extractComponentCandidate,
} = require("../ui/server/services/prototype-structural.service");
const {
  compileSingleHtmlPrototype,
} = require("../ui/server/services/prototype-exporter.service");

test("prototype-structural: remove, duplicate, move e insertBlock via data-pid", () => {
  const html = `<div class="container" data-pid="p-1">
  <header data-pid="p-2"><h1>Título</h1></header>
  <main data-pid="p-3"><p data-pid="p-4">Item 1</p><p data-pid="p-5">Item 2</p></main>
</div>`;

  // 1. Remove
  const removed = mutateStructuralHtml(html, "p-2", { type: "remove" });
  assert.equal(removed.includes("Título"), false);

  // 2. Duplicate
  const duplicated = mutateStructuralHtml(html, "p-4", { type: "duplicate" });
  const matches = duplicated.match(/Item 1/g) || [];
  assert.equal(matches.length, 2);

  // 3. InsertBlock
  const withBlock = mutateStructuralHtml(html, "p-3", { type: "insertBlock", componentId: "ds-card", position: "inside" }, '<div class="ds-card">Novo Card</div>');
  assert.match(withBlock, /Novo Card/);
  assert.match(withBlock, /data-pid="p-/);

  // 4. Move
  const moved = mutateStructuralHtml(html, "p-5", { type: "move", direction: "up" });
  assert.equal(typeof moved, "string");
});

test("prototype-structural: extractComponentCandidate registra em proto.json e MAPA.md", () => {
  const memoryFs = new Map();
  const projectDir = "/mock/proj";
  const protoDir = "/mock/proj/design/prototypes/proto-1";
  const norm = (p) => p.replace(/\\/g, "/");

  const initialProtoJson = JSON.stringify({ schema: 1, id: "proto-1", title: "Meu Protótipo", components: [] });
  const initialMapa = "# MAPA\n\n## Componentes Candidatos\n";

  memoryFs.set(norm(protoDir), { isDir: true });
  memoryFs.set(norm(path.join(protoDir, "proto.json")), initialProtoJson);
  memoryFs.set(norm(path.join(protoDir, "MAPA.md")), initialMapa);

  const mockDeps = {
    fs: {
      existsSync: (p) => memoryFs.has(norm(p)),
      readFileSync: (p) => memoryFs.get(norm(p)) || "",
      writeFileSync: (p, data) => memoryFs.set(norm(p), data),
    },
    path,
  };

  const res = extractComponentCandidate(projectDir, "proto-1", {
    name: "AlertaUrgente",
    screen: "home",
    pid: "p-4",
  }, mockDeps);

  assert.equal(res.ok, true);
  assert.equal(res.component.id, "alertaurgente");
  assert.equal(res.component.stage, "extracted");

  const updatedProto = JSON.parse(memoryFs.get(norm(path.join(protoDir, "proto.json"))));
  assert.equal(updatedProto.components.length, 1);
  assert.equal(updatedProto.components[0].id, "alertaurgente");

  const updatedMapa = memoryFs.get(norm(path.join(protoDir, "MAPA.md")));
  assert.match(updatedMapa, /AlertaUrgente/);
});

test("prototype-exporter: compileSingleHtmlPrototype compila HTML único com abas e runtime offline", () => {
  const memoryFs = new Map();
  const projectDir = "/mock/proj";
  const protoDir = "/mock/proj/design/prototypes/proto-1";
  const norm = (p) => p.replace(/\\/g, "/");

  const protoJson = JSON.stringify({
    schema: 1,
    id: "proto-1",
    title: "Fluxo Completo",
    version: 2,
    screens: [
      { id: "home", title: "Início", file: "screens/home.html" },
      { id: "resumo", title: "Resumo", file: "screens/resumo.html" },
    ],
  });

  memoryFs.set(norm(protoDir), { isDir: true });
  memoryFs.set(norm(path.join(protoDir, "proto.json")), protoJson);
  memoryFs.set(norm(path.join(protoDir, "styles", "proto.css")), ".custom { margin: 10px; }");
  memoryFs.set(norm(path.join(protoDir, "screens", "home.html")), "<div class='home'>Tela 1</div>");
  memoryFs.set(norm(path.join(protoDir, "screens", "resumo.html")), "<div class='resumo'>Tela 2</div>");

  const mockDeps = {
    fs: {
      existsSync: (p) => memoryFs.has(norm(p)),
      readFileSync: (p) => memoryFs.get(norm(p)) || "",
    },
    path,
  };

  const html = compileSingleHtmlPrototype(projectDir, "/mock/repo", "proto-1", {}, mockDeps);

  assert.match(html, /<!DOCTYPE html>/);
  assert.match(html, /Fluxo Completo/);
  assert.match(html, /Tela 1/);
  assert.match(html, /Tela 2/);
  assert.match(html, /showScreen/);
  assert.match(html, /data-action/);
});
