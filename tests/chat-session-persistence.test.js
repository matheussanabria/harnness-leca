// @ts-check
// A sessão do motor sobrevive ao F5 (recarregamento da página), e "Novo chat" continua zerando.
import test from "node:test";
import assert from "node:assert/strict";

const store = new Map();
globalThis.localStorage = /** @type {any} */ ({
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
});

const KEY = "harness:engine-sessions:v1";
let n = 0;
/** Nova instância do módulo = a página recarregada (o Map em memória começa vazio). */
const reload = () => import(`../ui/public/js/modules/chat-session-store.js?reload=${++n}`);

test.beforeEach(() => store.clear());

test("F5 no meio de um chat rascunho: a sessão do opencode é reencontrada", async () => {
  const a = await reload();
  a.setEngineSession("inv", null, "opencode", "ses_abc123");
  assert.equal(a.getEngineSession("inv", null, "opencode"), "ses_abc123");

  const b = await reload(); // F5
  assert.equal(b.getEngineSession("inv", null, "opencode"), "ses_abc123", "a conversa continua na mesma sessão");
  assert.equal(b.getEngineSession("inv", null, "gemini"), null, "outros motores seguem sem sessão");
});

test("chat salvo: a sessão acompanha o nome do arquivo e também sobrevive ao F5", async () => {
  const a = await reload();
  a.setEngineSession("inv", null, "opencode", "ses_rascunho");
  a.moveEngineSessions("inv", null, "2026-10-28-etapa-1.md"); // o chat foi salvo e ganhou nome
  const b = await reload();
  assert.equal(b.getEngineSession("inv", "2026-10-28-etapa-1.md", "opencode"), "ses_rascunho");
  assert.equal(b.getEngineSession("inv", null, "opencode"), null, "o rascunho não fica com a sessão do chat salvo");
});

test("Novo chat zera a sessão e isso também persiste (o F5 seguinte não ressuscita a antiga)", async () => {
  const a = await reload();
  a.setEngineSession("inv", null, "opencode", "ses_velha");
  a.clearEngineSessions("inv", null);
  assert.equal(a.getEngineSession("inv", null, "opencode"), null);
  const b = await reload();
  assert.equal(b.getEngineSession("inv", null, "opencode"), null);
});

test("projetos e conversas não se misturam", async () => {
  const a = await reload();
  a.setEngineSession("inv", "c1.md", "opencode", "ses_1");
  a.setEngineSession("inv", "c2.md", "opencode", "ses_2");
  a.setEngineSession("outro", "c1.md", "opencode", "ses_3");
  const b = await reload();
  assert.equal(b.getEngineSession("inv", "c1.md", "opencode"), "ses_1");
  assert.equal(b.getEngineSession("inv", "c2.md", "opencode"), "ses_2");
  assert.equal(b.getEngineSession("outro", "c1.md", "opencode"), "ses_3");
});

test("storage corrompido ou ausente não quebra: começa vazio", async () => {
  store.set(KEY, "{isso não é json");
  const a = await reload();
  assert.equal(a.getEngineSession("inv", null, "opencode"), null);
  a.setEngineSession("inv", null, "opencode", "ses_nova"); // e volta a gravar normalmente
  assert.equal(JSON.parse(store.get(KEY))["inv::draft"].opencode, "ses_nova");

  const real = globalThis.localStorage;
  globalThis.localStorage = /** @type {any} */ ({ getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("bloqueado"); } });
  const b = await reload();
  assert.doesNotThrow(() => b.setEngineSession("inv", null, "opencode", "ses_x"));
  assert.equal(b.getEngineSession("inv", null, "opencode"), "ses_x", "vale em memória mesmo sem storage");
  globalThis.localStorage = real;
});

test("guarda só conversas que têm sessão e limita a quantidade (as mais antigas saem)", async () => {
  const a = await reload();
  a.getEngineSession("inv", "vazia.md", "opencode"); // só consultar não grava
  for (let i = 0; i < 70; i++) a.setEngineSession("inv", `c${i}.md`, "opencode", `ses_${i}`);
  const saved = JSON.parse(store.get(KEY));
  const keys = Object.keys(saved);
  assert.ok(keys.length <= 60, `limitou a ${keys.length}`);
  assert.ok(!keys.some((k) => k.includes("vazia")), "conversa sem sessão não é guardada");
  assert.ok(keys.includes("inv::c69.md"), "a mais recente fica");
  assert.ok(!keys.includes("inv::c0.md"), "a mais antiga saiu");
});
