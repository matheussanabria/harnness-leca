// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const {
  CATALOG_VERSION,
  OPERATIONS,
  getCapabilityCatalog,
  getProvider,
  resolveCapability,
  isValidOperation,
} = require("../ui/server/services/orchestration/capability-catalog");
const {
  apiOrchestrationCapabilities,
  apiOrchestrationCapabilityProvider,
} = require("../ui/server/controllers/orchestration-capabilities.controller");

const FIXED = new Date("2026-10-21T12:00:00.000Z");
const PROVIDERS = ["claude", "gemini", "opencode", "codex", "ollama", "proc_manager", "routines"];
const STATES = new Set(["available", "degraded", "unavailable", "unknown"]);

test("capability-catalog: monta catálogo versionado com todos os provedores", () => {
  const catalog = getCapabilityCatalog({ now: FIXED });
  assert.equal(catalog.version, CATALOG_VERSION);
  assert.equal(catalog.version, 1);
  assert.equal(catalog.checkedAt, FIXED.toISOString());
  assert.deepEqual(Object.keys(catalog.providers).sort(), [...PROVIDERS].sort());

  for (const id of PROVIDERS) {
    const provider = catalog.providers[id];
    assert.equal(provider.id, id);
    assert.equal(typeof provider.label, "string");
    assert.ok(provider.label.length > 0, `${id} precisa de label`);
    assert.ok(["chat_engine", "process_manager", "routine_runner"].includes(provider.kind), `${id} tem kind inválido`);
    assert.ok(Object.keys(provider.operations).length > 0, `${id} precisa de operações`);
    for (const [operationId, operation] of Object.entries(provider.operations)) {
      assert.ok(OPERATIONS[operationId], `${operationId} não está catalogada`);
      assert.ok(STATES.has(operation.state), `${operationId} tem estado inválido: ${operation.state}`);
      assert.equal(typeof operation.mode, "string");
      assert.equal(typeof operation.scope, "string");
      assert.ok(operation.reason.length > 0, `${operationId} precisa de motivo`);
      assert.equal(operation.checkedAt, FIXED.toISOString());
    }
  }
});

test("capability-catalog: resolve capacidade sem transformar ausência em disponível", () => {
  const stream = resolveCapability("claude", "execution.stream", { now: FIXED });
  assert.equal(stream?.state, "available");
  assert.equal(stream?.available, true);
  assert.equal(stream?.usable, true);

  const cancel = resolveCapability("claude", "execution.cancel", { now: FIXED });
  assert.equal(cancel?.state, "degraded");
  assert.equal(cancel?.scope, "harness_owned");
  assert.equal(cancel?.available, false);
  assert.equal(cancel?.usable, true);

  const resume = resolveCapability("gemini", "execution.resume", { now: FIXED });
  assert.equal(resume?.state, "unavailable");
  assert.equal(resume?.available, false);
  assert.equal(resume?.usable, false);

  const pause = resolveCapability("codex", "execution.pause", { now: FIXED });
  assert.equal(pause?.state, "unavailable");
  assert.equal(pause?.available, false);

  assert.equal(resolveCapability("inexistente", "execution.stream"), null);
  assert.equal(resolveCapability("claude", "execution.fantasma"), null);
  assert.equal(getProvider("inexistente"), null);
  assert.equal(isValidOperation("codex", "execution.resume"), true);
  assert.equal(isValidOperation("codex", "routine.list"), false);
});

test("capability-catalog: campos legados derivam do catálogo canônico", () => {
  const { capabilities } = getCapabilityCatalog({ now: FIXED });
  assert.equal(capabilities.claude.pauseSupported, false);
  assert.equal(capabilities.claude.streamSupported, true);
  assert.equal(capabilities.claude.cancelSupported, false);
  assert.equal(capabilities.claude.cancelScope, "harness_owned");
  assert.equal(capabilities.claude.externalProcessControl, false);
  assert.equal(capabilities.gemini.permissionsSupported, false);
  assert.equal(capabilities.codex.permissionsSupported, false);
  assert.equal(capabilities.proc_manager.startSupported, true);
  assert.equal(capabilities.proc_manager.streamLogsSupported, true);
  assert.equal(capabilities.proc_manager.killTreeSupported, true);
  assert.equal(capabilities.routines.listSupported, true);
  assert.equal(capabilities.routines.triggerImmediateSupported, true);
});

test("capability-catalog: HTTP expõe catálogo e provedor com 404 para desconhecido", async () => {
  const { createServer } = require("../ui/server");
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const all = await fetch(`${base}/api/orchestration/capabilities`);
    assert.equal(all.status, 200);
    const body = await all.json();
    assert.equal(body.version, 1);
    assert.ok(body.providers.claude);
    assert.equal(body.providers.claude.operations["execution.stream"].state, "available");
    assert.equal(body.providers.codex.operations["execution.resume"].state, "available");
    assert.equal(body.capabilities.claude.pauseSupported, false);
    assert.ok(body.capabilities.proc_manager);

    const one = await fetch(`${base}/api/orchestration/capabilities/codex`);
    assert.equal(one.status, 200);
    const provider = await one.json();
    assert.equal(provider.provider.id, "codex");
    assert.equal(provider.provider.operations["execution.cancel"].scope, "harness_owned");

    const missing = await fetch(`${base}/api/orchestration/capabilities/inexistente`);
    assert.equal(missing.status, 404);
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

test("capability-catalog: controller e rotas registradas nos arquivos esperados", () => {
  assert.equal(apiOrchestrationCapabilities.name, "apiOrchestrationCapabilities");
  assert.equal(apiOrchestrationCapabilityProvider.name, "apiOrchestrationCapabilityProvider");

  const router = fs.readFileSync(path.join(__dirname, "..", "ui/server/routes/index.js"), "utf8");
  assert.match(router, /orchestrationRoutes/);

  const routes = fs.readFileSync(path.join(__dirname, "..", "ui/server/routes/orchestration.routes.js"), "utf8");
  assert.match(routes, /apiOrchestrationCapabilities/);
  assert.match(routes, /apiOrchestrationCapabilityProvider/);
  assert.ok(routes.includes("/^\\/api\\/orchestration\\/capabilities\\/([\\w-]+)$/"));

  const oldController = fs.readFileSync(path.join(__dirname, "..", "ui/server/controllers/orchestration.controller.js"), "utf8");
  assert.doesNotMatch(oldController, /pauseSupported/);
  assert.doesNotMatch(oldController, /apiOrchestrationCapabilities/);
});

test("capability-catalog: módulo é puro, abaixo de 300 linhas e sem emojis", () => {
  const files = [
    "ui/server/services/orchestration/capability-catalog.js",
    "ui/server/services/orchestration/capability-definitions.js",
    "ui/server/services/orchestration/capability-legacy.js",
    "ui/server/controllers/orchestration-capabilities.controller.js",
    "ui/server/routes/orchestration.routes.js",
    "tests/capability-catalog.test.js",
  ];
  for (const file of files) {
    const text = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.ok(text.split(/\r?\n/).length < 300, `${file} passou de 300 linhas`);
    assert.equal(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text), false, `${file} contém emoji`);
  }

  const definitions = fs.readFileSync(path.join(__dirname, "..", "ui/server/services/orchestration/capability-definitions.js"), "utf8");
  assert.doesNotMatch(definitions, /require\("(fs|node:fs)"\)/);
  assert.doesNotMatch(definitions, /process\.env/);
  assert.doesNotMatch(definitions, /readFileSync|readdirSync|existsSync/);
});
