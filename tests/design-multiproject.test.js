// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { resolveProjectDesignProfile } = require("../ui/server/services/design-profile-resolver.service");
const { getProjectDesignContext } = require("../ui/server/services/project-design-context.service");
const { buildDesignIndex } = require("../ui/server/services/design-index.service");
const { createProjectFixture } = require("./helpers/project-fixture");
const { writeJson } = require("./helpers/project-fixture-files");

function writeSharedDesignSystem(globalDir) {
  writeJson(path.join(globalDir, "design", "defaults.json"), {
    schema: 1,
    designSystem: { provider: "fs", prefix: "ds-", tokensCss: "doc/design-system/ds.css", componentsDir: "doc/design-system" },
    framework: { adapter: "static-html" },
    docs: { layers: { adapter: "markdown-folders", featuresGlob: "doc/sistema/features/*" } },
  });
  writeJson(path.join(globalDir, "design", "design-systems", "procempa-dis.json"), {
    designSystem: {
      ref: "procempa-dis",
      prefix: "ds-",
      componentsDir: "doc/design-system",
      tokensCss: "doc/design-system/ds.css",
      allowedRepoDirs: ["doc/design-system", "doc/sistema/features"],
    },
    framework: { adapter: "angular" },
  });
}

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
  const fixture = createProjectFixture({
    slug: "projeto-camadas",
    profile: {
      schema: 1,
      designSystem: { ref: "procempa-dis", prefix: "dis-" },
    },
  });
  test.after(() => fixture.cleanup());

  const globalDir = path.join(fixture.root, "global");
  writeSharedDesignSystem(globalDir);

  const profile = resolveProjectDesignProfile(fixture.dir, globalDir);

  assert.strictEqual(profile.schema, 1);
  assert.strictEqual(profile.framework.adapter, "angular");
  assert.strictEqual(profile.designSystem.ref, "procempa-dis");
  assert.strictEqual(profile.designSystem.prefix, "dis-");
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
  const fixtureA = createProjectFixture({
    slug: "projeto-procempa",
    profile: { schema: 1, designSystem: { ref: "procempa-dis", prefix: "dis-" } },
  });
  const fixtureB = createProjectFixture({ slug: "projeto-generico-teste", designSystem: false, prototype: false, designIndex: false });
  test.after(() => {
    fixtureA.cleanup();
    fixtureB.cleanup();
  });

  const globalDirA = path.join(fixtureA.root, "global");
  writeSharedDesignSystem(globalDirA);

  // 1. Contexto do Projeto A (Procempa)
  const ctxA = getProjectDesignContext(
    fixtureA.slug,
    fixtureA.dir,
    fixtureA.root,
    { globalDir: globalDirA }
  );

  assert.strictEqual(ctxA.profile.framework.adapter, "angular");
  assert.ok(ctxA.allowedRepoDirs.includes("doc/design-system"));
  assert.ok(ctxA.allowedRepoDirs.includes("doc/sistema/features"));

  // 2. Contexto do Projeto B (Genérico)
  const ctxB = getProjectDesignContext(
    "projeto-generico-teste",
    path.join(fixtureB.root, "projects", "projeto-inexistente-123"),
    fixtureB.root,
    { globalDir: path.join(fixtureB.root, "global") }
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
