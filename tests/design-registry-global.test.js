// @ts-check
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  loadRegistry,
  loadProjectRegistry,
  registerComponent,
  registerImplementation,
  listRegistryComponents,
  getComponent,
  resolveGlobalDir,
} = require("../ui/server/services/design-registry.service");

/** Monta um harness de mentira: <raiz>/global e <raiz>/projects/<slug>. */
function montar({ global: globalComps, projeto: projetoComps }) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "ds-global-"));
  const projectDir = path.join(raiz, "projects", "exemplo");
  const globalDir = path.join(raiz, "global");
  if (globalComps) {
    fs.mkdirSync(path.join(globalDir, "design", "ds"), { recursive: true });
    fs.writeFileSync(path.join(globalDir, "design", "ds", "registry.json"),
      JSON.stringify({ schema: 1, namespace: "cn", components: globalComps }), "utf8");
  }
  if (projetoComps) {
    fs.mkdirSync(path.join(projectDir, "design", "ds"), { recursive: true });
    fs.writeFileSync(path.join(projectDir, "design", "ds", "registry.json"),
      JSON.stringify({ schema: 1, namespace: "dis", components: projetoComps }), "utf8");
  }
  fs.mkdirSync(projectDir, { recursive: true });
  return { raiz, projectDir, globalDir };
}

const comp = (id, extra = {}) => ({ id, name: id, category: "Design System", ...extra });

test("projeto sem registry próprio enxerga o Design System global", () => {
  const { projectDir } = montar({ global: { "cn.button": comp("cn.button") } });
  const reg = loadRegistry(projectDir);
  assert.equal(reg.namespace, "cn");
  assert.equal(Object.keys(reg.components).length, 1);
  assert.equal(reg.components["cn.button"].origin, "global");
});

test("projeto com Design System próprio sobrescreve componente a componente", () => {
  const { projectDir } = montar({
    global: { "cn.button": comp("cn.button", { name: "Botão global" }), "cn.table": comp("cn.table") },
    projeto: { "cn.button": comp("cn.button", { name: "Botão do projeto" }), "dis.annotation-list": comp("dis.annotation-list") },
  });
  const reg = loadRegistry(projectDir);
  assert.equal(reg.namespace, "dis", "o namespace do projeto manda");
  assert.equal(reg.components["cn.button"].name, "Botão do projeto");
  assert.equal(reg.components["cn.button"].origin, "projeto");
  assert.equal(reg.components["cn.table"].origin, "global", "o que o projeto não sobrescreve continua vindo do global");
  assert.equal(reg.components["dis.annotation-list"].origin, "projeto");
});

test("sem global e sem projeto, devolve registry vazio em vez de quebrar", () => {
  const { projectDir } = montar({});
  const reg = loadRegistry(projectDir);
  assert.deepEqual(reg.components, {});
});

test("gravar um componente não copia o global para dentro do projeto", () => {
  const { projectDir } = montar({ global: { "cn.button": comp("cn.button"), "cn.table": comp("cn.table") } });
  registerComponent(projectDir, comp("cn.card"));
  const proprio = loadProjectRegistry(projectDir);
  assert.deepEqual(Object.keys(proprio.components), ["cn.card"], "só o componente gravado fica no projeto");
  assert.equal(Object.keys(loadRegistry(projectDir).components).length, 3, "e os três continuam visíveis");
});

test("implementação em componente herdado cria a sobrescrita local", () => {
  const { projectDir } = montar({ global: { "cn.button": comp("cn.button", { version: "1.0.0" }) } });
  registerImplementation(projectDir, "cn.button", "angular", { entryFile: "button.angular.ts" });
  const proprio = loadProjectRegistry(projectDir);
  assert.ok(proprio.components["cn.button"], "o projeto passa a ter a sua versão");
  assert.equal(proprio.components["cn.button"].implementations.angular.entryFile, "button.angular.ts");
  assert.equal(proprio.components["cn.button"].origin, undefined, "origin não é gravado no disco");
  assert.equal(loadRegistry(projectDir).components["cn.button"].origin, "projeto");
});

test("implementação em componente inexistente continua falhando", () => {
  const { projectDir } = montar({ global: { "cn.button": comp("cn.button") } });
  assert.throws(() => registerImplementation(projectDir, "cn.nao-existe", "react", {}), /não encontrado/);
});

test("filtro por origem separa o que é global do que é do projeto", () => {
  const { projectDir } = montar({
    global: { "cn.button": comp("cn.button"), "cn.table": comp("cn.table") },
    projeto: { "dis.annotation-list": comp("dis.annotation-list") },
  });
  assert.equal(listRegistryComponents(projectDir, { origin: "global" }).length, 2);
  assert.equal(listRegistryComponents(projectDir, { origin: "projeto" }).length, 1);
});

test("getComponent acha componente do global", () => {
  const { projectDir } = montar({ global: { "cn.button": comp("cn.button") } });
  assert.equal(getComponent(projectDir, "cn.button").origin, "global");
  assert.equal(getComponent(projectDir, "cn.nada"), null);
});

test("resolveGlobalDir cai em <raiz>/global quando não é informado", () => {
  const { projectDir, globalDir } = montar({});
  assert.equal(resolveGlobalDir(projectDir), globalDir);
});

const { resolveProjectDesignProfile } = require("../ui/server/services/design-profile-resolver.service");
const { registryComponentsForIndex } = require("../ui/server/services/design-registry-index.service");

/** Monta um harness de mentira com defaults.json e um design-system nomeado. */
function montarPerfil({ defaults, ds, profile }) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "ds-perfil-"));
  const projectDir = path.join(raiz, "projects", "exemplo");
  const globalDir = path.join(raiz, "global");
  fs.mkdirSync(path.join(globalDir, "design", "design-systems"), { recursive: true });
  fs.mkdirSync(path.join(projectDir, "design"), { recursive: true });
  fs.writeFileSync(path.join(globalDir, "design", "defaults.json"), JSON.stringify(defaults), "utf8");
  if (ds) fs.writeFileSync(path.join(globalDir, "design", "design-systems", "codificadores.json"), JSON.stringify(ds), "utf8");
  if (profile) fs.writeFileSync(path.join(projectDir, "design", "profile.json"), JSON.stringify(profile), "utf8");
  return { projectDir, globalDir };
}

const DEFAULTS_COM_REF = {
  schema: 1,
  designSystem: { ref: "codificadores", provider: "none", tokensCss: "design/tokens.css", componentsDir: "" },
};
const DS_GLOBAL = {
  schema: 1,
  id: "codificadores",
  designSystem: { provider: "fs", namespace: "cn", tokensCss: "global/design/ds/tokens.css", componentsDir: "global/design/ds/components" },
};

test("projeto sem profile.json herda o Design System padrão global", () => {
  const { projectDir, globalDir } = montarPerfil({ defaults: DEFAULTS_COM_REF, ds: DS_GLOBAL });
  const p = resolveProjectDesignProfile(projectDir, globalDir);
  assert.equal(p.designSystemRef, "codificadores");
  assert.equal(p.designSystemOrigin, "global");
  assert.equal(p.designSystem.provider, "fs", "o DS nomeado sobrescreve o provider 'none' do defaults");
  assert.equal(p.designSystem.tokensCss, "global/design/ds/tokens.css");
});

test("projeto com ref próprio não herda o global", () => {
  const { projectDir, globalDir } = montarPerfil({
    defaults: DEFAULTS_COM_REF,
    ds: DS_GLOBAL,
    profile: { designSystem: { ref: "procempa-dis" } },
  });
  const p = resolveProjectDesignProfile(projectDir, globalDir);
  assert.equal(p.designSystemRef, "procempa-dis");
  assert.equal(p.designSystemOrigin, "projeto");
});

test("overrides do projeto trocam só os tokens, mantendo os componentes do global", () => {
  const { projectDir, globalDir } = montarPerfil({
    defaults: DEFAULTS_COM_REF,
    ds: DS_GLOBAL,
    profile: { designSystem: { ref: "codificadores", overrides: { tokensCss: "projects/exemplo/design/tokens.css" } } },
  });
  const p = resolveProjectDesignProfile(projectDir, globalDir);
  assert.equal(p.designSystem.tokensCss, "projects/exemplo/design/tokens.css");
  assert.equal(p.designSystem.componentsDir, "global/design/ds/components", "os componentes continuam vindo do global");
});

test("sem ref em lugar algum, origem é 'nenhum' (projeto genérico)", () => {
  const { projectDir, globalDir } = montarPerfil({ defaults: { schema: 1, designSystem: { provider: "none" } } });
  const p = resolveProjectDesignProfile(projectDir, globalDir);
  assert.equal(p.designSystemRef, null);
  assert.equal(p.designSystemOrigin, "nenhum");
  assert.equal(p.isGeneric, true);
});

test("índice do quadro aponta a pasta certa para componente global e para o do projeto", () => {
  const { projectDir } = montar({
    global: { "cn.button": comp("cn.button") },
    projeto: { "dis.annotation-list": comp("dis.annotation-list") },
  });
  const itens = registryComponentsForIndex(projectDir);
  const botao = itens.find((i) => i.registryId === "cn.button");
  const lista = itens.find((i) => i.registryId === "dis.annotation-list");
  assert.equal(botao.dsFolder, "global/design/ds/components/button");
  assert.equal(botao.origin, "global");
  assert.equal(lista.dsFolder, "projects/exemplo/design/ds/components/annotation-list");
  assert.equal(lista.origin, "projeto");
});

const { createDesignSystemProvider } = require("../ui/server/services/design-system-provider.factory");

/** Monta repoRoot com um tokens.css global e, opcionalmente, um do projeto. */
function montarTokens({ global: cssGlobal, projeto: cssProjeto }) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), "ds-tokens-"));
  fs.mkdirSync(path.join(raiz, "global", "design", "ds"), { recursive: true });
  fs.writeFileSync(path.join(raiz, "global", "design", "ds", "tokens.css"), cssGlobal, "utf8");
  if (cssProjeto) {
    fs.mkdirSync(path.join(raiz, "projects", "exemplo", "design"), { recursive: true });
    fs.writeFileSync(path.join(raiz, "projects", "exemplo", "design", "tokens.css"), cssProjeto, "utf8");
  }
  return raiz;
}

const CSS_GLOBAL = `:root{\n--primary-interactive:#2b4fcc;\n--neutral-body:#091e42;\n--neutral-light:#dcdee4;\n}`;
const CSS_PROJETO = `@import url("../../../global/design/ds/tokens.css");\n:root{\n--primary-interactive:#e5202e;\n}`;

test("sem sobrescrita, os tokens são os do Design System global", async () => {
  const raiz = montarTokens({ global: CSS_GLOBAL });
  const p = createDesignSystemProvider({ provider: "fs", tokensCss: "global/design/ds/tokens.css" }, raiz);
  const tokens = await p.getTokens();
  assert.equal(tokens.length, 3);
  assert.equal(tokens.find((t) => t.name === "--primary-interactive").value, "#2b4fcc");
});

test("com sobrescrita, o projeto troca só o que redefine e herda o resto", async () => {
  const raiz = montarTokens({ global: CSS_GLOBAL, projeto: CSS_PROJETO });
  const p = createDesignSystemProvider(
    {
      provider: "fs",
      baseTokensCss: "global/design/ds/tokens.css",
      tokensCss: "projects/exemplo/design/tokens.css",
    },
    raiz,
  );
  const tokens = await p.getTokens();
  assert.equal(tokens.length, 3, "os 3 continuam visíveis, não só o redefinido");
  assert.equal(tokens.find((t) => t.name === "--primary-interactive").value, "#e5202e", "o do projeto manda");
  assert.equal(tokens.find((t) => t.name === "--neutral-body").value, "#091e42", "o neutro vem do global");
});

test("o @import do arquivo do projeto não vira token", async () => {
  const raiz = montarTokens({ global: CSS_GLOBAL, projeto: CSS_PROJETO });
  const p = createDesignSystemProvider(
    { provider: "fs", baseTokensCss: "global/design/ds/tokens.css", tokensCss: "projects/exemplo/design/tokens.css" },
    raiz,
  );
  const tokens = await p.getTokens();
  assert.ok(!tokens.some((t) => t.value.includes("url(")), "nenhum valor carrega uma url");
});

test("resolver marca baseTokensCss quando o projeto sobrescreve os tokens", () => {
  const { projectDir, globalDir } = montarPerfil({
    defaults: DEFAULTS_COM_REF,
    ds: DS_GLOBAL,
    profile: { designSystem: { ref: "codificadores", overrides: { tokensCss: "projects/exemplo/design/tokens.css" } } },
  });
  const p = resolveProjectDesignProfile(projectDir, globalDir);
  assert.equal(p.designSystem.baseTokensCss, "global/design/ds/tokens.css");
  assert.equal(p.designSystem.tokensCss, "projects/exemplo/design/tokens.css");
});

test("sem sobrescrita, não há baseTokensCss a carregar", () => {
  const { projectDir, globalDir } = montarPerfil({ defaults: DEFAULTS_COM_REF, ds: DS_GLOBAL });
  const p = resolveProjectDesignProfile(projectDir, globalDir);
  assert.equal(p.designSystem.baseTokensCss, undefined);
});
