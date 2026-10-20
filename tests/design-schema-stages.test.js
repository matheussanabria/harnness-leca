// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateChecklist, determineStage, enrichComponentStage } = require("../ui/server/services/design-stage.service");
const { loadDesignJson, buildDesignIndex } = require("../ui/server/services/design-index.service");

test("design-stage: calcula checklist de 6 marcas corretamente", () => {
  const comp = { id: "header", name: "HeaderComponent", selector: "app-header" };
  const context = {
    prototypeComponents: new Set(["header"]),
    extractedComponents: new Set(["header"]),
    dsComponents: new Set(["header"]),
    boilerplateComponents: new Set(["header"]),
    implementedComponents: new Set(["header"]),
    documentedComponents: new Set(["header"]),
  };

  const chk = calculateChecklist(comp, context);
  assert.equal(chk.inPrototype, true);
  assert.equal(chk.isExtracted, true);
  assert.equal(chk.inDesignSystem, true);
  assert.equal(chk.hasBoilerplate, true);
  assert.equal(chk.isImplemented, true);
  assert.equal(chk.isDocumented, true);
});

test("design-stage: determina etapa pela MAIOR ETAPA SATISFEITA com inferencia retroativa", () => {
  // 1. Todas true -> documented
  const allTrue = {
    inPrototype: true,
    isExtracted: true,
    inDesignSystem: true,
    hasBoilerplate: true,
    isImplemented: true,
    isDocumented: true,
  };
  assert.equal(determineStage(allTrue).stage, "documented");

  // 2. Componente do DS com Boilerplate -> vai para boilerplate (mesmo se noApp for false)
  const dsBoilerplate = {
    inPrototype: true,
    isExtracted: true,
    inDesignSystem: true,
    hasBoilerplate: true,
    isImplemented: false,
    isDocumented: false,
  };
  assert.equal(determineStage(dsBoilerplate).stage, "boilerplate");

  // 3. Componente do DS infere Protótipo e Extraído
  const dsComp = { id: "menu", hasBoilerplate: true };
  const calculated = calculateChecklist(dsComp);
  assert.equal(calculated.inPrototype, true);
  assert.equal(calculated.isExtracted, true);
  assert.equal(calculated.hasBoilerplate, true);
  assert.equal(calculated.meta.inPrototype.inferred, true);
  assert.equal(determineStage(calculated).stage, "boilerplate");

  // 4. Componente só com 'so-no-prototipo' vai para Extraído
  const onlyProto = {
    inPrototype: true,
    isExtracted: true,
    inDesignSystem: false,
    hasBoilerplate: false,
    isImplemented: false,
    isDocumented: false,
  };
  assert.equal(determineStage(onlyProto).stage, "extracted");

  // 4. Nenhuma marca -> prototype (fallback)
  const none = {
    inPrototype: false,
    isExtracted: false,
    inDesignSystem: false,
    hasBoilerplate: false,
    isImplemented: false,
    isDocumented: false,
  };
  assert.equal(determineStage(none).stage, "prototype");
});

test("design-stage: respeita stageOverride explícito", () => {
  const checklist = {
    inPrototype: true,
    isExtracted: true,
    inDesignSystem: false,
    hasBoilerplate: false,
    isImplemented: false,
    isDocumented: false,
  };

  const res = determineStage(checklist, "boilerplate");
  assert.equal(res.stage, "boilerplate");
  assert.equal(res.isOverridden, true);
});

test("design-stage: enriquece componente com agente DAI real do .agents/", () => {
  const comp = { id: "btn", name: "ButtonComponent", inPrototype: true, isExtracted: true };
  const enriched = enrichComponentStage(comp);

  assert.equal(enriched.stage, "extracted");
  assert.equal(enriched.dai.agentId, "ux-ui-designer");
  assert.equal(enriched.dai.nextStage, "design_system");
  assert.match(enriched.dai.nextAction, /Definir interface/);
});

test("design-index: valida schema 1 do design.json e rejeita schema inválido", () => {
  const mockDeps = {
    fs: {
      existsSync: () => true,
      readFileSync: () => JSON.stringify({ schema: 2, components: [] }),
    },
    path: require("path"),
  };

  assert.throws(
    () => loadDesignJson("/fake/proj", mockDeps),
    /não suportado: 2/
  );
});

test("design-index: autodescoberta gera componentes a partir do repositório", () => {
  const mockFs = {
    existsSync: (p) => p.includes("doc"),
    readdirSync: (p) => {
      if (p.endsWith("design-system")) {
        return [{ name: "01-header", isDirectory: () => true, isFile: () => false }];
      }
      if (p.includes("01-header")) {
        return [
          { name: "header.component.ts", isFile: () => true, isDirectory: () => false },
          { name: "header.component.html", isFile: () => true, isDirectory: () => false },
        ];
      }
      return [];
    },
    readFileSync: () => "",
  };

  const res = buildDesignIndex("/fake/proj", "/fake/repo", {
    deps: { fs: mockFs, path: require("path") },
  });

  assert.equal(res.ok, true);
  assert.equal(res.components.length, 1);
  assert.equal(res.components[0].id, "header");
  assert.equal(res.components[0].checklist.inDesignSystem, true);
  assert.equal(res.components[0].checklist.hasBoilerplate, true);
});
