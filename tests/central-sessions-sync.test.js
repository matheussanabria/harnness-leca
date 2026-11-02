// @ts-check
// Testes do agendador de recargas da Central (SSE): debounce, espera máxima, carga única, aba oculta e descarte de resultados obsoletos.

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(".");
const SYNC = path.join(ROOT, "ui", "public", "js", "modules", "central-sessions-sync.js");

async function loadSync() {
  return import(pathToFileURL(SYNC).href);
}

/** Espera microtarefas pendentes (setImmediate não é mockado nestes testes). */
const flush = () => new Promise((resolve) => setImmediate(resolve));

/** Carga controlável: cada chamada fica pendente até o teste resolver ou rejeitar. */
function controlledLoad() {
  const calls = [];
  const load = (signal) =>
    new Promise((resolve, reject) => {
      calls.push({ signal, resolve, reject });
    });
  return { load, calls };
}

/** Alvo de visibilitychange falso, com disparo manual. */
function fakeDocument() {
  const listeners = new Map();
  return {
    hidden: false,
    addEventListener(type, listener) {
      listeners.set(type, [...(listeners.get(type) || []), listener]);
    },
    removeEventListener(type, listener) {
      listeners.set(type, (listeners.get(type) || []).filter((item) => item !== listener));
    },
    dispatch(type) {
      for (const listener of listeners.get(type) || []) listener();
    },
    listenerCount(type) {
      return (listeners.get(type) || []).length;
    },
  };
}

test("20 pedidos rápidos geram uma única carga após o debounce", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { createRefreshScheduler } = await loadSync();
  let loads = 0;
  const scheduler = createRefreshScheduler({
    load: async () => {
      loads += 1;
      return "ok";
    },
    apply: () => {},
    doc: null,
  });
  for (let index = 0; index < 20; index += 1) scheduler.request();
  t.mock.timers.tick(499);
  await flush();
  assert.equal(loads, 0, "ainda dentro do debounce");
  t.mock.timers.tick(1);
  await flush();
  assert.equal(loads, 1);
  t.mock.timers.tick(5000);
  await flush();
  assert.equal(loads, 1, "nenhum pedido extra");
});

test("espera máxima força a carga mesmo com pedidos contínuos", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { createRefreshScheduler } = await loadSync();
  let loads = 0;
  const scheduler = createRefreshScheduler({
    load: async () => {
      loads += 1;
      return null;
    },
    apply: () => {},
    doc: null,
  });
  for (let elapsed = 0; elapsed < 2000; elapsed += 400) {
    scheduler.request();
    t.mock.timers.tick(400);
  }
  await flush();
  assert.equal(loads, 1, "a espera máxima de 2000 ms dispara a carga");
});

test("pedido durante carga em voo gera exatamente uma repetição ao fim", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { createRefreshScheduler } = await loadSync();
  const applied = [];
  const { load, calls } = controlledLoad();
  const scheduler = createRefreshScheduler({ load, apply: (value) => applied.push(value), doc: null });

  scheduler.request();
  t.mock.timers.tick(500);
  assert.equal(calls.length, 1);

  scheduler.request();
  scheduler.request();
  t.mock.timers.tick(500);
  assert.equal(calls.length, 1, "não inicia segunda carga com a primeira em voo");

  calls[0].resolve("primeira");
  await flush();
  assert.deepEqual(applied, ["primeira"]);
  assert.equal(calls.length, 2, "exatamente uma repetição");

  calls[1].resolve("segunda");
  await flush();
  t.mock.timers.tick(5000);
  await flush();
  assert.equal(calls.length, 2, "sem repetições extras");
  assert.deepEqual(applied, ["primeira", "segunda"]);
});

test("aba oculta adia a carga e roda uma vez quando fica visível", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { createRefreshScheduler } = await loadSync();
  const doc = fakeDocument();
  let hidden = true;
  let loads = 0;
  const scheduler = createRefreshScheduler({
    load: async () => {
      loads += 1;
      return "visivel";
    },
    apply: () => {},
    doc,
    isHidden: () => hidden,
  });
  for (let index = 0; index < 20; index += 1) scheduler.request();
  t.mock.timers.tick(2500);
  await flush();
  assert.equal(loads, 0, "nenhuma carga com a aba oculta");
  assert.equal(doc.listenerCount("visibilitychange"), 1);

  hidden = false;
  doc.dispatch("visibilitychange");
  await flush();
  assert.equal(loads, 1, "uma única carga ao ficar visível");
  assert.equal(doc.listenerCount("visibilitychange"), 0);
});

test("resultado de carga cancelada não é aplicado e o sinal é abortado", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { createRefreshScheduler } = await loadSync();
  const applied = [];
  const { load, calls } = controlledLoad();
  const scheduler = createRefreshScheduler({ load, apply: (value) => applied.push(value), doc: null });

  scheduler.request();
  t.mock.timers.tick(500);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].signal.aborted, false);

  scheduler.cancel();
  assert.equal(calls[0].signal.aborted, true, "cancel aborta a carga em voo");
  calls[0].resolve("obsoleto");
  await flush();
  assert.deepEqual(applied, [], "resultado obsoleto descartado");
});

test("resultado de carga abortada por rejeição não aplica nem repete após cancel", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { createRefreshScheduler } = await loadSync();
  const applied = [];
  const { load, calls } = controlledLoad();
  const scheduler = createRefreshScheduler({ load, apply: (value) => applied.push(value), doc: null });

  scheduler.request();
  t.mock.timers.tick(500);
  scheduler.request();
  t.mock.timers.tick(500);
  scheduler.cancel();
  calls[0].reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
  await flush();
  t.mock.timers.tick(5000);
  await flush();
  assert.equal(calls.length, 1, "cancelado não repete a carga");
  assert.deepEqual(applied, []);
});

test("falha de carga mantém o último estado e permite a próxima recarga", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { createRefreshScheduler } = await loadSync();
  const applied = [];
  const { load, calls } = controlledLoad();
  const scheduler = createRefreshScheduler({ load, apply: (value) => applied.push(value), doc: null });

  scheduler.request();
  t.mock.timers.tick(500);
  calls[0].reject(new Error("rede"));
  await flush();
  assert.deepEqual(applied, [], "falha não aplica resultado");

  scheduler.request();
  t.mock.timers.tick(500);
  assert.equal(calls.length, 2, "próxima recarga ocorre normalmente");
});

test("cancel é definitivo: pedidos depois de cancelar não carregam", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { createRefreshScheduler } = await loadSync();
  let loads = 0;
  const scheduler = createRefreshScheduler({
    load: async () => {
      loads += 1;
      return null;
    },
    apply: () => {},
    doc: null,
  });
  scheduler.request();
  scheduler.cancel();
  scheduler.request();
  t.mock.timers.tick(5000);
  await flush();
  assert.equal(loads, 0);
});
