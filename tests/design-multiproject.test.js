// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { resolveProjectDesignProfile } = require("../ui/server/services/design-profile-resolver.service");
const { getProjectDesignContext } = require("../ui/server/services/project-design-context.service");
const { buildDesignIndex } = require("../ui/server/services/design-index.service");

test("Design Multiprojeto - Teste de Zero Constantes Hardcoded", () => {
  const root = path.resolve(__dirname, "..");
  const filesToCheck = [
    "ui/server/controllers/design.controller.js",
    "ui/server/services/design-index.service.js",
    "ui/server/services/design-layers.service.js",
    "ui/server/services/design-agents.config.js",
    "ui/public/js/modules/inspector.js",
    "ui/public/js/modules/inspector-dom.js",
    "ui/public/js/modules/inspector-mode.js",
    "ui/public/js/modules/inspector-bridge.js",
    "ui/public/js/modules/inspector-iframe.js",
    "ui/public/js/modules/inspector-card.js",
    "ui/public/js/modules/inspector-edit-panel.js",
  ];

  const forbiddenLiterals = [
    "saude-dispensacao",
    "dis-design-system",
    "doc/design-system",
    "doc/sistema",
  ];

  for (const relFile of filesToCheck) {
    const fullPath = path.join(root, relFile);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, "utf8");

    for (const lit of forbiddenLiterals) {
      assert.strictEqual(
        content.includes(lit),
        false,
        `Constante proibida '${lit}' encontrada no arquivo '${relFile}'. Use configuração por perfil injetado.`
      );
    }
  }
});

test("Design Multiprojeto - Resolução em 3 Camadas (Defaults < DS Compartilhado < Projeto)", () => {
  const root = path.resolve(__dirname, "..");
  const globalDir = path.join(root, "global");
  const projectDir = path.join(root, "projects", "saude-dispensacao");

  const profile = resolveProjectDesignProfile(projectDir, globalDir);

  assert.strictEqual(profile.schema, 1);
  assert.strictEqual(profile.framework.adapter, "angular");
  assert.strictEqual(profile.designSystem.ref, "procempa-dis");
  assert.strictEqual(profile.designSystem.prefix, "ds-");
  assert.strictEqual(profile.designSystem.componentsDir, "doc/design-system");
  assert.strictEqual(profile.designSystem.tokensCss, "doc/design-system/ds.css");
});

test("Design Multiprojeto - Projeto Genérico Sem Perfil cai suavemente em Generic", () => {
  const mockDeps = {
    fs: {
      existsSync: () => false,
      readFileSync: () => "",
    },
    path,
  };

  const profile = resolveProjectDesignProfile("/caminho/inexistente/projects/meu-app", "/caminho/inexistente/global", mockDeps);

  assert.strictEqual(profile.schema, 1);
  assert.strictEqual(profile.framework.adapter, "static-html");
  assert.strictEqual(profile.designSystem.provider, "none");
  assert.strictEqual(profile.isGeneric, true);
});

test("Design Multiprojeto - Dois Projetos Lado a Lado (Procempa vs Genérico)", () => {
  const root = path.resolve(__dirname, "..");

  // 1. Contexto do Projeto A (Procempa)
  const ctxA = getProjectDesignContext(
    "saude-dispensacao",
    path.join(root, "projects", "saude-dispensacao"),
    root,
    { globalDir: path.join(root, "global") }
  );

  assert.strictEqual(ctxA.profile.framework.adapter, "angular");
  assert.ok(ctxA.allowedRepoDirs.includes("doc/design-system"));
  assert.ok(ctxA.allowedRepoDirs.includes("doc/sistema/features"));

  // 2. Contexto do Projeto B (Genérico)
  const ctxB = getProjectDesignContext(
    "projeto-generico-teste",
    path.join(root, "projects", "projeto-inexistente-123"),
    root,
    { globalDir: path.join(root, "global") }
  );

  assert.strictEqual(ctxB.profile.framework.adapter, "static-html");
  assert.strictEqual(ctxB.profile.designSystem.provider, "none");
  assert.ok(ctxB.allowedRepoDirs.includes("doc/features"));

  // 3. buildDesignIndex no Projeto Genérico deve retornar vazio e limpo sem erro 500
  const indexB = buildDesignIndex("/mock/projeto-generico-teste", "/mock/repo-generico", {
    profile: ctxB.profile,
    deps: {
      fs: {
        existsSync: () => false,
        readdirSync: () => [],
        readFileSync: () => "",
      },
      path,
    },
  });

  assert.strictEqual(indexB.ok, true);
  assert.strictEqual(indexB.components.length, 0);
  assert.strictEqual(indexB.features.length, 0);
  assert.strictEqual(indexB.prototypes.length, 0);
});
