// @ts-check
// Aba Consumo: controlador com DOM falso (estados, janela, polling, abort, registro da aba).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const mod = (f) => import(pathToFileURL(path.resolve("ui", "public", "js", f)).href);
const tick = () => new Promise((r) => setImmediate(r));

const tok = (o = {}) => ({ input: null, output: null, cacheRead: null, cacheCreation: null, reasoning: null, ...o });
const day = (calls, ingest = true) => ({
  totals: { calls, tokens: tok({ output: 5 }), cost: { amount: 1, currency: "USD", kind: "estimated", basis: "api-equivalent" } },
  groups: [], coverage: { calls, callsWithCost: calls }, ingest: { enabled: ingest },
});

/** Fake DOM mínimo: raiz com innerHTML e clique por delegação. */
function fakeRoot() {
  const listeners = {};
  const root = {
    innerHTML: "", isConnected: true,
    addEventListener: (t, fn) => { listeners[t] = fn; },
    removeEventListener: (t) => { delete listeners[t]; },
    closest: () => null,
    click(attr, value) {
      const el = { getAttribute: () => value };
      const target = { closest: (sel) => (sel === `[${attr}]` ? el : null) };
      listeners.click && listeners.click({ target });
    },
    hasListener: () => !!listeners.click,
  };
  return root;
}

function fakeDoc() {
  const ls = {};
  return {
    hidden: false,
    addEventListener: (t, fn) => { ls[t] = fn; },
    removeEventListener: (t) => { delete ls[t]; },
    emit(t) { ls[t] && ls[t](); },
    count: () => Object.keys(ls).length,
  };
}

/** setInterval controlável. */
function fakeTimers() {
  let fn = null; let id = 0; let cleared = 0;
  return {
    set: (f) => { fn = f; return ++id; },
    clear: () => { fn = null; cleared += 1; },
    fire: () => fn && fn(),
    active: () => fn !== null,
    cleared: () => cleared,
  };
}

async function setup(loadImpl, extra = {}) {
  const { mountUsagePanel } = await mod("modules/usage-panel.js");
  const root = fakeRoot(); const doc = fakeDoc(); const timers = fakeTimers();
  const calls = [];
  const load = loadImpl || (async (slug, o) => { calls.push({ slug, ...o }); return { window: o.window, day: day(3), model: { groups: [] }, session: { groups: [] } }; });
  const wrapped = async (slug, o) => { calls.length || calls.push(null); calls.pop(); calls.push({ slug, window: o.window, signal: o.signal }); return load(slug, o); };
  const h = mountUsagePanel(root, { slug: "proj", doc, load: wrapped, setIntervalImpl: timers.set, clearIntervalImpl: timers.clear, ...extra });
  return { root, doc, timers, calls, h };
}

test("mostra carregando e depois o painel pronto", async () => {
  const s = await setup();
  assert.match(s.root.innerHTML, /Carregando consumo/);
  await s.h.first;
  assert.match(s.root.innerHTML, /Chamadas/);
  assert.match(s.root.innerHTML, /ESTIMADO/);
  assert.equal(s.calls[0].slug, "proj");
  assert.equal(s.calls[0].window, "7d");
  s.h.destroy();
});

test("estado de erro com retry que recarrega", async () => {
  let n = 0;
  const s = await setup(async () => { n += 1; if (n === 1) throw new Error("Falha ao consultar o consumo (500)."); return { day: day(2) }; });
  await s.h.first;
  assert.match(s.root.innerHTML, /role="alert"/);
  assert.match(s.root.innerHTML, /Falha ao consultar o consumo \(500\)/);
  assert.match(s.root.innerHTML, /data-usage-retry/);
  s.root.click("data-usage-retry", "");
  await tick(); await tick();
  assert.match(s.root.innerHTML, /Chamadas/);
  assert.equal(n, 2);
  s.h.destroy();
});

test("estados vazio e ingestão desativada", async () => {
  const empty = await setup(async () => ({ day: day(0) }));
  await empty.h.first;
  assert.match(empty.root.innerHTML, /Nenhuma chamada registrada/);
  empty.h.destroy();
  const off = await setup(async () => ({ day: day(0, false) }));
  await off.h.first;
  assert.match(off.root.innerHTML, /ingestão de uso está desativada/);
  off.h.destroy();
});

test("troca de janela recarrega com a janela escolhida", async () => {
  const s = await setup();
  await s.h.first;
  s.root.click("data-usage-window", "24h");
  await tick(); await tick();
  assert.equal(s.calls[s.calls.length - 1].window, "24h");
  assert.match(s.root.innerHTML, /data-usage-window="24h"[^>]*aria-pressed="true"/);
  s.h.destroy();
});

test("polling a cada tick só com a aba visível; oculta não faz requisição", async () => {
  const s = await setup();
  await s.h.first;
  const base = s.calls.length;
  s.timers.fire(); await tick();
  assert.equal(s.calls.length, base + 1);

  s.doc.hidden = true; s.doc.emit("visibilitychange");
  assert.equal(s.timers.active(), false, "timer parado quando oculto");
  s.timers.fire(); await tick();
  assert.equal(s.calls.length, base + 1, "nenhuma requisição enquanto oculto");

  s.doc.hidden = false; s.doc.emit("visibilitychange"); await tick();
  assert.equal(s.timers.active(), true);
  assert.equal(s.calls.length, base + 2, "retoma com atualização imediata");
  s.h.destroy();
});

test("tick não consulta quando o drawer está fechado e destrói se a raiz saiu do DOM", async () => {
  const s = await setup();
  await s.h.first;
  const base = s.calls.length;
  s.root.closest = () => ({ classList: { contains: () => false } });
  s.timers.fire(); await tick();
  assert.equal(s.calls.length, base);
  s.root.closest = () => null;
  s.root.isConnected = false;
  s.timers.fire();
  assert.equal(s.root.hasListener(), false);
  assert.equal(s.doc.count(), 0);
});

test("destroy aborta requisição em voo, para o timer e ignora resposta tardia", async () => {
  let release; let signal;
  const s = await setup((slug, o) => { signal = o.signal; return new Promise((r) => { release = () => r({ day: day(3) }); }); });
  assert.ok(signal && signal.aborted === false);
  s.h.destroy();
  assert.equal(signal.aborted, true);
  assert.equal(s.timers.active(), false);
  const before = s.root.innerHTML;
  release(); await tick();
  assert.equal(s.root.innerHTML, before);
  assert.equal(s.root.hasListener(), false);
});

test("cliente HTTP: URL com janela e groupBy, 3 agrupamentos e erro de status", async () => {
  const { loadUsage, fetchUsageSummary } = await mod("modules/usage-api.js");
  const urls = [];
  const ok = async (url) => { urls.push(url); return { ok: true, json: async () => ({ url }) }; };
  const out = await loadUsage("meu proj", { window: "14d", fetchImpl: ok });
  assert.equal(urls.length, 3);
  assert.ok(urls.every((u) => u.startsWith("/api/project/meu%20proj/usage/summary?window=14d&groupBy=")));
  assert.deepEqual(urls.map((u) => u.split("groupBy=")[1]).sort(), ["day", "model", "session"]);
  assert.ok(out.day && out.model && out.session);
  await assert.rejects(fetchUsageSummary("p", { window: "all", groupBy: "day", fetchImpl: async () => ({ ok: false, status: 503 }) }), /503/);
});

test("registro: aba Consumo no painel, desmonta ao re-renderizar e CSS importado", async () => {
  const panel = fs.readFileSync(path.resolve("ui/public/js/office-orchestration-panel.js"), "utf8");
  assert.match(panel, /data-tab="usage"/);
  assert.match(panel, /renderUsageTab\(activeProj\)/);
  assert.match(panel, /setupUsageTab\(\)/);
  assert.match(fs.readFileSync(path.resolve("ui/public/css/office.css"), "utf8"), /19-usage-panel\.css/);
  const tab = await mod("office3d/orchestration/tab-usage.js");
  assert.match(tab.renderUsageTab('a"b'), /id="usagePanelRoot" class="usage-root" data-slug="ab"/);
  const doc = { getElementById: () => null };
  assert.equal(tab.setupUsageTab(doc), null);
});
