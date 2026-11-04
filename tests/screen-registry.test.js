// Regressao do EP-14.04: registro, saneamento e cobertura das chaves do localStorage.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  MAX_STATE_BYTES,
  TIPOS,
  SCREENS,
  EXCLUSOES,
  ScreenStateError,
  getScreen,
  isScreenId,
  listScreens,
  getScreenCatalog,
  isStorageKeyCovered,
  matchesPattern,
  sanitizeState,
  serializeState,
  stateBytes,
} = require("../ui/server/services/screen-state/registry");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_JS = path.join(ROOT, "ui", "public", "js");

const EXPECTED_IDS = [
  "chats",
  "studio",
  "prototypes",
  "scrum",
  "layers",
  "board",
  "audit",
  "artifacts",
  "routines",
  "canvas-mindmap",
  "canvas-board",
  "overview",
  "office",
  "lists",
  "deploy",
  "diario",
];

function listJsFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listJsFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(full);
  }
  return files;
}

function collectStorageKeys() {
  const pattern = /["'`](harness[_\.][A-Za-z0-9_.:*\-]+|dai(?:_[A-Za-z0-9_.:*\-]+|:wm:[A-Za-z0-9_.:*\-]+)|hia_[A-Za-z0-9_]+)["'`]/g;
  const keys = new Set();
  for (const file of listJsFiles(PUBLIC_JS)) {
    const source = fs.readFileSync(file, "utf8");
    for (const match of source.matchAll(pattern)) keys.add(match[1]);
  }
  return [...keys].sort();
}

test("EP-14.04: registro declara as telas canonicas", () => {
  assert.equal(SCREENS.length, 16);
  assert.deepEqual(listScreens(), EXPECTED_IDS);
  for (const id of EXPECTED_IDS) {
    assert.equal(isScreenId(id), true, `tela ${id} deve existir`);
    assert.equal(getScreen(id).id, id, `id interno de ${id} deve bater`);
    assert.equal(getScreen(`nao-${id}`), null);
  }
});

test("EP-14.04: cada tela declara escopo, campos com tipo/limite e migraDe", () => {
  for (const entry of SCREENS) {
    assert.equal(["projeto", "global"].includes(entry.escopo), true, `escopo de ${entry.id}`);
    assert.equal(typeof entry.titulo, "string");
    assert.equal(entry.rota.startsWith("/"), true, `rota de ${entry.id}`);
    assert.equal(entry.icone.startsWith("fa-"), true, `icone FontAwesome de ${entry.id}`);
    assert.equal(Array.isArray(entry.migraDe), true, `migraDe de ${entry.id}`);

    const fields = Object.entries(entry.campos);
    assert.ok(fields.length > 0, `tela ${entry.id} deve declarar campos`);
    for (const [name, rule] of fields) {
      assert.equal(TIPOS.includes(rule.tipo), true, `${entry.id}.${name} usa tipo valido`);
      assert.ok(rule.limite > 0, `${entry.id}.${name} deve ter limite`);
      if (rule.tipo === "number") assert.ok(rule.minimo >= 0);
    }
  }

  const catalog = getScreenCatalog();
  assert.equal(catalog.length, 16);
  assert.deepEqual(catalog.map((item) => item.id), EXPECTED_IDS);
});

test("EP-14.04: campos fora do esquema e valores invalidos sao descartados", () => {
  const state = {
    viewMode: "cards",
    pageSize: 30,
    sortAsc: "nao",
    draft: "x".repeat(20001),
    desconhecido: true,
  };

  assert.deepEqual(sanitizeState("chats", state), { viewMode: "cards", pageSize: 30 });
  assert.deepEqual(sanitizeState("chats", { pageSize: 0 }), {});
  assert.deepEqual(sanitizeState("chats", { pageSize: 101 }), {});
  assert.deepEqual(sanitizeState("chats", { pageSize: 100 }), { pageSize: 100 });
  assert.deepEqual(sanitizeState("chats", { sortAsc: true }), { sortAsc: true });
  assert.deepEqual(sanitizeState("chats", { assignments: { texto: "a".repeat(70000) } }), {});
  assert.deepEqual(sanitizeState("office", { mouseSensitivity: 11 }), {});
  assert.deepEqual(sanitizeState("office", { mouseSensitivity: 10 }), { mouseSensitivity: 10 });
});

test("EP-14.04: a tela lists aceita somente os presets de tamanho de pagina", () => {
  const presets = { central: 5, cabinet: 10, "scrum-backlog": 25, routines: 50 };
  assert.deepEqual(sanitizeState("lists", { pageSizes: presets }), { pageSizes: presets });
  assert.deepEqual(
    sanitizeState("lists", { pageSizes: { central: 5, cabinet: 7, workflows: 100, epic: "25" } }),
    { pageSizes: { central: 5 } },
    "valores fora dos presets sao descartados",
  );
  assert.deepEqual(sanitizeState("lists", { pageSizes: [] }), {});
  assert.deepEqual(sanitizeState("lists", { pageSizes: "grande" }), {});
  assert.deepEqual(
    sanitizeState("lists", { laneLimits: { "central:running": 8 }, kanbanAutoFallback: true }),
    { laneLimits: { "central:running": 8 }, kanbanAutoFallback: true },
  );
  assert.deepEqual(sanitizeState("lists", { kanbanAutoFallback: "sim" }), {});
});

test("EP-14.04: saneamento nao propaga proto e isola a copia do estado", () => {
  const malicious = JSON.parse('{"__proto__":{"poluido":true},"viewMode":"cards","groups":[{"x":1}]}');
  const clean = sanitizeState("chats", malicious);

  assert.deepEqual(clean, { viewMode: "cards", groups: [{ x: 1 }] });
  assert.equal({}.poluido, undefined, "Object.prototype nao pode ser poluido");
  clean.groups.push("novo");
  assert.equal(malicious.groups.length, 1, "a copia nao compartilha o array original");
});

test("EP-14.04: estado acima de 64 KB e rejeitado", () => {
  assert.equal(MAX_STATE_BYTES, 64 * 1024);
  const grande = {
    assignments: { texto: "a".repeat(59000) },
    draft: "b".repeat(20000),
  };
  assert.ok(stateBytes(grande) > MAX_STATE_BYTES);

  assert.throws(
    () => sanitizeState("chats", grande),
    (error) => error instanceof ScreenStateError && error.code === "STATE_TOO_LARGE"
  );
  assert.throws(() => serializeState("chats", grande), /65536 bytes/);
});

test("EP-14.04: tela desconhecida e estado sem forma de objeto sao rejeitados", () => {
  assert.throws(
    () => sanitizeState("inexistente", {}),
    (error) => error instanceof ScreenStateError && error.code === "UNKNOWN_SCREEN"
  );
  for (const invalid of [null, "texto", 12, []]) {
    assert.throws(
      () => sanitizeState("chats", invalid),
      (error) => error instanceof ScreenStateError && error.code === "INVALID_STATE"
    );
  }
});

test("EP-14.04: toda chave de localStorage do cliente esta migraDe ou em exclusoes", () => {
  const keys = collectStorageKeys();
  assert.ok(keys.length > 0, "a varredura deve encontrar chaves do cliente");

  const uncovered = keys.filter((key) => !isStorageKeyCovered(key));
  assert.deepEqual(uncovered, [], `chaves sem destino: ${uncovered.join(", ")}`);

  for (const expected of ["harness_chats_view_mode", "harness_deploy_config", "dai:wm:layout:"]) {
    assert.equal(keys.includes(expected), true, `varredura deve achar ${expected}`);
  }
});

test("EP-14.04: padroes de migracao casam prefixos e exclusoes ficam justificadas", () => {
  assert.equal(matchesPattern("harness_groups_*", "harness_groups_projeto"), true);
  assert.equal(matchesPattern("harness_groups_*", "harness_groups"), false);
  assert.equal(matchesPattern("harness.canvas.v1*", "harness.canvas.v1.slug.proto"), true);
  assert.equal(matchesPattern("dai:wm:layout:*", "dai:wm:layout:projeto"), true);

  assert.equal(isStorageKeyCovered("harness_groups_qualquer"), true);
  assert.equal(isStorageKeyCovered("harness.chat.desconhecida"), false);

  assert.equal(EXCLUSOES.some((entry) => entry.chave === "harness_pin"), true);
  for (const entry of EXCLUSOES) {
    assert.equal(typeof entry.motivo, "string");
    assert.ok(entry.motivo.length > 20, `exclusao ${entry.chave} precisa de motivo`);
  }
});
