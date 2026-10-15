// getEnginesStatus (o que a interface mostra no seletor de motores) com fetch e executável simulados.
// O esperado fica em tests/golden/engines-status.json; UPDATE_GOLDEN=1 npm test regrava (e revise o diff).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Antes de carregar qualquer módulo de tools/: raiz temporária (sem ler o global/.env de verdade) e um "claude" que
// responde a -v com sucesso em qualquer máquina (o próprio node).
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-status-"));
process.env.HARNESS_ROOT = TMP_ROOT;
process.env.CLAUDE_BIN = process.execPath;
delete process.env.GEMINI_API_KEY;
delete process.env.GOOGLE_API_KEY;
delete process.env.OPENCODE_URL;
test.after(() => fs.rmSync(TMP_ROOT, { recursive: true, force: true }));

const E = require("../tools/lib/engines");
const GOLDEN = path.join(__dirname, "golden", "engines-status.json");

const respond = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test("status dos motores: opencode offline e sem chave do Gemini, e depois com os dois", async (t) => {
  const realFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = realFetch; });

  globalThis.fetch = async () => { throw new Error("offline"); };
  const offline = await E.getEnginesStatus();

  process.env.GEMINI_API_KEY = "chave-de-teste";
  t.after(() => { delete process.env.GEMINI_API_KEY; });
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/session")) return respond(200, []);
    if (String(url).endsWith("/api/model")) return respond(200, { data: [
      { id: "zeta-free", name: "Zeta" }, { id: "grok-code", name: "Grok Code Fast 1" },
      { id: "alfa", name: "Alfa", providerID: "outro" }, { id: "glm-5-free", name: "GLM 5" },
    ] });
    throw new Error("url inesperada: " + url);
  };
  const online = await E.getEnginesStatus();

  const actual = JSON.stringify({ offline, online }, null, 2) + "\n";
  if (process.env.UPDATE_GOLDEN) { fs.writeFileSync(GOLDEN, actual); return; }
  assert.ok(fs.existsSync(GOLDEN), "falta tests/golden/engines-status.json: rode UPDATE_GOLDEN=1 npm test e revise");
  // Por valor, não por texto: a ordem das chaves do objeto não importa para a interface.
  assert.deepEqual(JSON.parse(actual), JSON.parse(fs.readFileSync(GOLDEN, "utf8")));

  // Os pontos que importam para a interface, além do golden:
  assert.equal(offline.claude.available, true);
  assert.equal(offline.opencode.available, false);
  assert.equal(offline.gemini.hasKey, false);
  assert.equal(online.opencode.available, true);
  assert.equal(online.gemini.hasKey, true);
  assert.deepEqual(online.opencode.models.map((m) => m.id), ["glm-5-free", "grok-code", "alfa", "zeta-free"],
    "modelos conhecidos primeiro, na ordem de prioridade; o resto em ordem alfabética do nome");
  assert.equal(online.opencode.defaultModel, "glm-5-free");
});

test("registro de motores: todo motor tem a mesma interface e uma entrada no catálogo", () => {
  const catalog = require("../tools/lib/engines/catalog.json");
  assert.deepEqual([...E.engines.keys()], ["claude", "opencode", "gemini"]);
  for (const [id, engine] of E.engines) {
    assert.equal(engine.id, id);
    assert.equal(typeof engine.stream, "function", `${id}.stream`);
    assert.equal(typeof engine.status, "function", `${id}.status`);
    for (const key of ["name", "icon", "color", "description", "defaultEffort", "effortLevels", "models"]) assert.ok(catalog[id][key], `catalog.${id}.${key}`);
  }
  assert.equal(E.engines.get("__proto__"), undefined);
  assert.equal(E.engines.get("constructor"), undefined);
});
