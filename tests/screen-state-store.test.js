// @ts-check
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-screen-state-store-"));
const SLUG = "projeto-teste";
process.env.HARNESS_ROOT = ROOT;
fs.mkdirSync(path.join(ROOT, "projects", SLUG), { recursive: true });

const store = require("../ui/server/services/screen-state/store");
const {
  HISTORY_LIMIT,
  ScreenStoreError,
  readScreenState,
  patchScreenState,
  readScreenHistory,
  appendScreenHistory,
} = store;

test.after(() => {
  fs.rmSync(ROOT, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
});

function expectStoreError(fn, code, status) {
  assert.throws(
    fn,
    (error) => error instanceof ScreenStoreError && error.code === code && error.status === status
  );
}

function projectStateDir() {
  return path.join(ROOT, "projects", SLUG, "ui-state");
}

test("screen-state-store: grava, recarrega o modulo e devolve o mesmo estado", () => {
  assert.deepEqual(readScreenState("chats", SLUG), { rev: 0, state: {}, updatedAt: null });

  const first = patchScreenState("chats", SLUG, { viewMode: "cards", pageSize: 30 });
  assert.equal(first.rev, 1);
  assert.deepEqual(first.state, { viewMode: "cards", pageSize: 30 });
  assert.equal(typeof first.updatedAt, "string");

  const file = path.join(projectStateDir(), "chats.json");
  assert.equal(fs.existsSync(file), true);
  const saved = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(saved.rev, 1);
  assert.deepEqual(saved.state, { viewMode: "cards", pageSize: 30 });

  const modulePath = require.resolve("../ui/server/services/screen-state/store");
  delete require.cache[modulePath];
  const reloaded = require(modulePath);
  assert.deepEqual(reloaded.readScreenState("chats", SLUG).state, { viewMode: "cards", pageSize: 30 });
  assert.deepEqual(reloaded.readScreenState("chats", SLUG).rev, 1);

  const leftovers = fs.readdirSync(projectStateDir()).filter((name) => name.endsWith(".tmp"));
  assert.deepEqual(leftovers, []);
});

test("screen-state-store: merge preserva campos anteriores e o rev protege a concorrencia", () => {
  const first = patchScreenState("scrum", SLUG, { sprint: "sprint-1" }, 0);
  assert.equal(first.rev, 1);

  const second = patchScreenState("scrum", SLUG, { tab: "board" }, 1);
  assert.equal(second.rev, 2);
  assert.deepEqual(second.state, { sprint: "sprint-1", tab: "board" });

  expectStoreError(
    () => patchScreenState("scrum", SLUG, { tab: "outra" }, 1),
    "REVISION_CONFLICT",
    409
  );
  assert.equal(readScreenState("scrum", SLUG).rev, 2);
  assert.equal(readScreenState("scrum", SLUG).state.tab, "board");

  const third = patchScreenState("scrum", SLUG, { tab: "outra" }, 2);
  assert.equal(third.rev, 3);
  assert.equal(third.state.tab, "outra");

  expectStoreError(
    () => patchScreenState("scrum", SLUG, { tab: "x" }, "invalida"),
    "INVALID_REVISION",
    400
  );
});

test("screen-state-store: estado acima de 64 KB responde 413 e nao altera o arquivo", () => {
  const before = readScreenState("board", SLUG);
  expectStoreError(
    () => patchScreenState("board", SLUG, { filter: "x".repeat(70000) }, before.rev),
    "STATE_TOO_LARGE",
    413
  );
  assert.deepEqual(readScreenState("board", SLUG), before);
});

test("screen-state-store: telas globais usam global/ui-state e os campos sao saneados", () => {
  const result = patchScreenState("overview", undefined, {
    query: "projeto",
    page: 0,
    desconhecido: true,
    sortAsc: "nao",
  });
  assert.deepEqual(result.state, { query: "projeto" });

  const file = path.join(ROOT, "global", "ui-state", "overview.json");
  assert.equal(fs.existsSync(file), true);
  assert.deepEqual(readScreenState("overview", undefined).state, { query: "projeto" });
});

test("screen-state-store: valida id da tela, slug do projeto e corpo do estado", () => {
  expectStoreError(() => readScreenState("inexistente", SLUG), "UNKNOWN_SCREEN", 404);
  expectStoreError(() => readScreenState("chats", ""), "PROJECT_REQUIRED", 400);
  expectStoreError(() => readScreenState("chats", "nao-existe"), "PROJECT_NOT_FOUND", 404);
  expectStoreError(() => patchScreenState("chats", SLUG, null, 0), "INVALID_STATE", 400);
  expectStoreError(() => patchScreenState("chats", SLUG, [], 0), "INVALID_STATE", 400);
});

test("screen-state-store: historico grava JSONL, limita a leitura e respeita o anel de 500", () => {
  appendScreenHistory("board", SLUG, { acao: "abrir", alvo: "cartao-1", ts: "2026-10-22T10:00:00.000Z" });
  appendScreenHistory("board", SLUG, { acao: "filtrar", alvo: "sprint-1", ts: "2026-10-22T10:01:00.000Z" });

  const recent = readScreenHistory("board", SLUG, 1);
  assert.equal(recent.total, 2);
  assert.deepEqual(recent.history, [
    { acao: "filtrar", alvo: "sprint-1", ts: "2026-10-22T10:01:00.000Z" },
  ]);

  const historyFile = path.join(projectStateDir(), "board.history.jsonl");
  const lines = fs.readFileSync(historyFile, "utf8").split(/\r?\n/).filter(Boolean);
  assert.equal(lines.length, 2);
  assert.deepEqual(JSON.parse(lines[0]), {
    acao: "abrir",
    alvo: "cartao-1",
    ts: "2026-10-22T10:00:00.000Z",
  });

  for (let i = 1; i <= HISTORY_LIMIT + 5; i += 1) {
    appendScreenHistory("layers", SLUG, { acao: `acao-${i}`, alvo: "camada", ts: `ts-${i}` });
  }

  const ring = readScreenHistory("layers", SLUG, 9999);
  assert.equal(ring.total, HISTORY_LIMIT);
  assert.equal(ring.history.length, HISTORY_LIMIT);
  assert.equal(ring.history[0].acao, `acao-${HISTORY_LIMIT + 5}`);
  assert.equal(ring.history[HISTORY_LIMIT - 1].acao, "acao-6");

  const ringLines = fs
    .readFileSync(path.join(projectStateDir(), "layers.history.jsonl"), "utf8")
    .split(/\r?\n/)
    .filter(Boolean);
  assert.equal(ringLines.length, HISTORY_LIMIT);
});

test("screen-state-store: historico recusa entradas invalidas e campo muito longo", () => {
  expectStoreError(() => appendScreenHistory("board", SLUG, null), "INVALID_HISTORY", 400);
  expectStoreError(() => appendScreenHistory("board", SLUG, { alvo: "x", ts: "1" }), "INVALID_HISTORY", 400);
  expectStoreError(
    () => appendScreenHistory("board", SLUG, { acao: "a", alvo: "x".repeat(301), ts: "1" }),
    "INVALID_HISTORY",
    400
  );
});

test("screen-state-store: null remove o campo, preserva os demais e ignora nomes fora do esquema", () => {
  patchScreenState("scrum", SLUG, { sprint: "S1", filter: "abertas" });
  const cleared = patchScreenState("scrum", SLUG, { filter: null, inexistente: null });
  assert.equal(cleared.state.sprint, "S1");
  assert.equal("filter" in cleared.state, false);
  assert.equal("inexistente" in cleared.state, false);
  assert.equal("filter" in readScreenState("scrum", SLUG).state, false);
});
