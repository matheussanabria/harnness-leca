// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { handle } = require("../ui/server/router");
const { resolveNodeTraceability } = require("../ui/server/services/prototype-traceability.service.js");

const ROOT = path.resolve(".");
const SAUDE_DIR = path.join(ROOT, "projects", "saude-dispensacao");
const MODULE_PATH = path.join(ROOT, "ui", "public", "js", "modules", "prototype-element-map.js");
const CONTROLLER_PATH = path.join(ROOT, "ui", "server", "controllers", "prototype-traceability.controller.js");
const CSS_PATH = path.join(ROOT, "ui", "public", "css", "design", "14-prototype-element-map.css");

const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u;

async function loadModule() {
  return import(pathToFileURL(MODULE_PATH).href);
}

function createHost() {
  return { innerHTML: "", querySelector: () => null };
}

function syntheticTrace(overrides = {}) {
  return {
    nodeId: "node-2",
    screenId: "home",
    component: { id: "dis.header", isRegistered: true },
    files: {
      screen: "screens/home.html",
      style: "styles/proto.css",
      manifest: "design/ds/components/dis.header/manifest.json",
      registry: "design/ds/registry.json",
      components: [
        { framework: "vanilla", path: "design/ds/components/dis.header/header.html", entry: true },
        { framework: "react", path: "design/ds/components/dis.header/header.jsx", entry: true },
      ],
    },
    code: { vanilla: "<header></header>" },
    ...overrides,
  };
}

test("EP-06.05: mapeamento de elementos visuais para arquivos e componentes", async (t) => {
  await t.test("novos arquivos respeitam limite de linhas e nao usam emojis", () => {
    for (const file of [MODULE_PATH, CONTROLLER_PATH, CSS_PATH]) {
      assert.ok(fs.existsSync(file), `Arquivo ausente: ${file}`);
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split("\n").length;
      assert.ok(lines <= 300, `${path.basename(file)} tem ${lines} linhas (limite 300).`);
      assert.equal(EMOJI_REGEX.test(content), false, `${path.basename(file)} contem emojis.`);
    }
  });

  await t.test("layout do Atelie e CSS conectam o painel", () => {
    const view = fs.readFileSync(path.join(ROOT, "ui", "public", "js", "modules", "prototype-atelier-view.js"), "utf8");
    const cssIndex = fs.readFileSync(path.join(ROOT, "ui", "public", "css", "design.css"), "utf8");
    assert.ok(view.includes('id="atelierElementMap"'));
    assert.ok(cssIndex.includes("14-prototype-element-map.css"));
  });

  await t.test("servico devolve arquivos de tela, estilo, registry e componente", () => {
    const trace = resolveNodeTraceability(SAUDE_DIR, "dis-modular", "home", "node-2");
    assert.equal(trace.files.screen, "screens/home.html");
    assert.equal(trace.files.style, "styles/proto.css");
    assert.equal(trace.files.registry, "design/ds/registry.json");
    assert.match(trace.files.manifest, /^design\/ds\/components\/header\/manifest\.json$/);
    assert.ok(trace.files.components.length > 0);
    assert.ok(trace.files.components.every((entry) => entry.path.startsWith("design/ds/components/header/")));
    assert.ok(trace.files.components.some((entry) => entry.entry === true));
  });

  await t.test("normalizeElementMapping extrai arquivos e frameworks", async () => {
    const { normalizeElementMapping } = await loadModule();
    const mapping = normalizeElementMapping(syntheticTrace());
    assert.equal(mapping.componentId, "dis.header");
    assert.equal(mapping.screenFile, "screens/home.html");
    assert.equal(mapping.styleFile, "styles/proto.css");
    assert.equal(mapping.manifestFile, "design/ds/components/dis.header/manifest.json");
    assert.deepEqual(mapping.frameworks, ["vanilla", "react"]);
    assert.equal(mapping.componentFiles.length, 2);
    assert.equal(mapping.componentFiles[0].entry, true);
  });

  await t.test("no sem componente cai no fallback html.element", async () => {
    const { normalizeElementMapping, FALLBACK_COMPONENT_ID } = await loadModule();
    const mapping = normalizeElementMapping({ nodeId: "node-x", screenId: "home", files: {} });
    assert.equal(mapping.componentId, FALLBACK_COMPONENT_ID);
    assert.equal(mapping.isRegistered, false);
    assert.equal(mapping.screenFile, "screens/home.html");
    assert.equal(mapping.registryFile, "design/ds/registry.json");
    assert.deepEqual(mapping.componentFiles, []);
  });

  await t.test("payload e bloco do chat carregam arquivo, componente e seletor", async () => {
    const { normalizeElementMapping, elementContextPayload, renderElementMappingHtml } = await loadModule();
    const { formatContextBlock } = await import(pathToFileURL(path.join(ROOT, "ui", "public", "js", "modules", "studio-chat.js")).href);
    const mapping = normalizeElementMapping(syntheticTrace());
    const payload = elementContextPayload(mapping);
    assert.equal(payload.file, "screens/home.html");
    assert.equal(payload.component, "dis.header");
    assert.equal(payload.selector, '[data-node-id="node-2"]');

    const block = formatContextBlock("element", payload);
    assert.ok(block.includes('arquivo="screens/home.html"'));
    assert.ok(block.includes('componente="dis.header"'));
    assert.ok(block.includes('seletor="[data-node-id="node-2"]"'));

    const html = renderElementMappingHtml(mapping);
    assert.ok(html.includes("screens/home.html"));
    assert.ok(html.includes("design/ds/components/dis.header/header.html"));
    assert.ok(html.includes("data-element-map-chat"));
    assert.ok(html.includes("fontawesome") === false);
    assert.ok(html.includes("fa-solid"));
  });

  await t.test("renderElementMapping consulta a API e preenche o painel", async () => {
    const { renderElementMapping } = await loadModule();
    const host = createHost();
    let requestedUrl = "";
    const fetchImpl = async (url) => {
      requestedUrl = String(url);
      return { ok: true, json: async () => ({ ok: true, traceability: syntheticTrace() }) };
    };

    const mapping = await renderElementMapping({
      slug: "saude-dispensacao",
      protoId: "dis-modular",
      screenId: "home",
      node: { nodeId: "node-2", pid: "p-2" },
      host,
      fetchImpl,
    });

    assert.match(requestedUrl, /\/api\/project\/saude-dispensacao\/design\/prototypes\/dis-modular\/traceability\?/);
    assert.match(requestedUrl, /nodeId=node-2/);
    assert.equal(mapping.componentId, "dis.header");
    assert.ok(host.innerHTML.includes("screens/home.html"));
  });

  await t.test("renderElementMapping mostra erro sem lancar excecao", async () => {
    const { renderElementMapping } = await loadModule();
    const host = createHost();
    const fetchImpl = async () => ({ ok: false, status: 404, json: async () => ({ error: "No nao encontrado." }) });
    const mapping = await renderElementMapping({
      slug: "saude-dispensacao",
      protoId: "dis-modular",
      screenId: "home",
      node: { nodeId: "node-fantasma" },
      host,
      fetchImpl,
    });
    assert.equal(mapping, null);
    assert.ok(host.innerHTML.includes("element-map-error"));
    assert.ok(host.innerHTML.includes("No nao encontrado."));
  });

  await t.test("rota de rastreabilidade responde 200 e 400", async () => {
    async function call(url) {
      let statusCode = 0;
      let body = "";
      const req = { method: "GET", url, headers: { host: "localhost:4321" } };
      const res = {
        setHeader: () => {},
        writeHead: (code) => { statusCode = code; },
        end: (data) => { body = data; },
      };
      await handle(req, res);
      return { statusCode, body };
    }

    const okResponse = await call("/api/project/saude-dispensacao/design/prototypes/dis-modular/traceability?screenId=home&nodeId=node-2");
    assert.equal(okResponse.statusCode, 200);
    const json = JSON.parse(okResponse.body);
    assert.equal(json.ok, true);
    assert.equal(json.traceability.nodeId, "node-2");
    assert.equal(json.traceability.files.screen, "screens/home.html");

    const badResponse = await call("/api/project/saude-dispensacao/design/prototypes/dis-modular/traceability?screenId=home");
    assert.equal(badResponse.statusCode, 400);
    assert.match(badResponse.body, /nodeId/);
  });
});
