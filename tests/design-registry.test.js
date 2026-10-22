// @ts-check
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { createProjectFixture } = require("./helpers/project-fixture");

const fixture = createProjectFixture();
test.after(() => fixture.cleanup());

const {
  validateComponentManifest,
  loadRegistry,
  saveRegistry,
  registerComponent,
  getComponent,
  listRegistryComponents,
  registerImplementation,
} = require("../ui/server/services/design-registry.service");

const {
  toKebab,
  extractAnnotationListPilot,
} = require("../ui/server/services/design-extractor.service");

test("Design Registry - Validação de manifesto canônico", () => {
  const invalidComp = { id: "InvalidId", name: "" };
  const resInvalid = validateComponentManifest(invalidComp);
  assert.strictEqual(resInvalid.valid, false);
  assert.ok(resInvalid.errors.length >= 2);

  const validComp = {
    id: "dis.annotation-list",
    name: "Lista de Anotações",
    category: "data-display",
    props: { items: { type: "array" } },
  };
  const resValid = validateComponentManifest(validComp);
  assert.strictEqual(resValid.valid, true);
  assert.strictEqual(resValid.errors.length, 0);
});

test("Design Registry - Operações CRUD no Registry com mock de fs", () => {
  const mockStorage = {};
  const mockFs = {
    existsSync: (p) => !!mockStorage[p],
    readFileSync: (p) => mockStorage[p] || "",
    writeFileSync: (p, data) => { mockStorage[p] = String(data); },
    mkdirSync: () => {},
  };

  const projectDir = "C:/mock-project";
  const comp = {
    id: "dis.patient-header",
    name: "Cabeçalho do Paciente",
    category: "layout",
    props: { name: { type: "string" } },
  };

  const registered = registerComponent(projectDir, comp, { fs: mockFs, path });
  assert.strictEqual(registered.id, "dis.patient-header");
  assert.strictEqual(registered.version, "1.0.0");

  const fetched = getComponent(projectDir, "dis.patient-header", { fs: mockFs, path });
  assert.ok(fetched);
  assert.strictEqual(fetched.name, "Cabeçalho do Paciente");

  const all = listRegistryComponents(projectDir, {}, { fs: mockFs, path });
  assert.strictEqual(all.length, 1);

  // Filtro por categoria
  const layoutComps = listRegistryComponents(projectDir, { category: "layout" }, { fs: mockFs, path });
  assert.strictEqual(layoutComps.length, 1);
  const inputComps = listRegistryComponents(projectDir, { category: "inputs" }, { fs: mockFs, path });
  assert.strictEqual(inputComps.length, 0);
});

test("Design Registry - Registro de Implementações de Framework", () => {
  const mockStorage = {};
  const mockFs = {
    existsSync: (p) => !!mockStorage[p],
    readFileSync: (p) => mockStorage[p] || "",
    writeFileSync: (p, data) => { mockStorage[p] = String(data); },
    mkdirSync: () => {},
  };
  const projectDir = "C:/mock-project";

  registerComponent(projectDir, {
    id: "dis.button",
    name: "Botão",
    category: "actions",
  }, { fs: mockFs, path });

  const updated = registerImplementation(
    projectDir,
    "dis.button",
    "vanilla",
    {
      entryFile: "button.html",
      files: ["button.html", "button.css"],
      status: "validated",
    },
    { fs: mockFs, path }
  );

  assert.strictEqual(updated.implementations.vanilla.status, "validated");
  assert.strictEqual(updated.implementations.vanilla.entryFile, "button.html");
});

test("Design Extractor - Execução do Piloto AnnotationList", () => {
  const saudeProjectDir = fixture.dir;
  const manifest = extractAnnotationListPilot(saudeProjectDir);

  assert.strictEqual(manifest.id, "dis.annotation-list");
  assert.strictEqual(manifest.name, "Lista de Anotações");
  assert.ok(manifest.props.items);
  assert.ok(manifest.implementations.vanilla);
  assert.ok(manifest.implementations.react);

  // Verifica arquivos físicos gerados
  const compDir = path.join(saudeProjectDir, "design", "ds", "components", "annotation-list");
  assert.ok(fs.existsSync(path.join(compDir, "manifest.json")));
  assert.ok(fs.existsSync(path.join(compDir, "annotation-list.html")));
  assert.ok(fs.existsSync(path.join(compDir, "annotation-list.css")));
  assert.ok(fs.existsSync(path.join(compDir, "annotation-list.js")));

  // Verifica persistência no registry do projeto
  const regComp = getComponent(saudeProjectDir, "dis.annotation-list");
  assert.ok(regComp);
  assert.strictEqual(regComp.id, "dis.annotation-list");
});
