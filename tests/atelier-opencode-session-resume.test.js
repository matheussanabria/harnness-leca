// @ts-check
// Retomar a conversa do Ateliê: só uma sessão que o servidor diz não existir (404) é trocada por outra.
// Erro de autenticação ou de rede não pode abrir sessão nova em silêncio (perderia o histórico a cada mensagem).
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildOpenCodeModelTurn, isSessionGone } = require("../ui/server/services/atelier-engine-adapters.service.js");

const SESSION = "ses_abc123";

/** fetch falso: `routes` mapeia "METHOD /caminho" para o status; o resto devolve 500 (encerra o turno cedo). */
function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, init = {}) => {
    const route = `${init.method || "GET"} ${new URL(url).pathname.replace(/^\/api/, "")}`;
    calls.push(route);
    const status = routes[route] ?? 500;
    const ok = status >= 200 && status < 300;
    const body = route === "POST /session" ? { data: { id: "ses_nova" } } : { data: [] };
    return { ok, status, text: async () => JSON.stringify(ok ? body : { message: `HTTP ${status}` }) };
  };
  return { fn, calls };
}

async function runOnce(routes) {
  const { fn, calls } = fakeFetch(routes);
  const events = [];
  const turn = buildOpenCodeModelTurn({ sessionId: SESSION, model: "9router/Harness", fetchFn: /** @type {any} */ (fn) });
  await turn([{ role: "user", text: "oi" }], undefined, (e) => events.push(e)).catch(() => {});
  return { calls, events };
}

test("isSessionGone: só 404 e 410 contam como sessão inexistente", () => {
  assert.equal(isSessionGone({ status: 404 }), true);
  assert.equal(isSessionGone({ status: 410 }), true);
  for (const status of [400, 401, 403, 500, 502]) assert.equal(isSessionGone({ status }), false, String(status));
  assert.equal(isSessionGone(new Error("ECONNREFUSED")), false);
});

test("401 ao conferir a sessão: mantém a mesma sessão e avisa, sem criar outra", async () => {
  const { calls, events } = await runOnce({ [`POST /session/${SESSION}/model`]: 401, [`GET /session/${SESSION}/message`]: 401 });
  assert.ok(!calls.includes("POST /session"), "não criou sessão nova");
  const session = events.find((e) => e.type === "session");
  assert.equal(session?.sessionId, SESSION);
  assert.ok(events.some((e) => e.type === "session_check_failed"));
});

test("falha só ao trocar o modelo: a sessão e o histórico continuam", async () => {
  const { calls, events } = await runOnce({ [`POST /session/${SESSION}/model`]: 400, [`GET /session/${SESSION}/message`]: 200 });
  assert.ok(!calls.includes("POST /session"));
  assert.equal(events.find((e) => e.type === "session")?.sessionId, SESSION);
});

test("404: sessão apagada no servidor, abre uma nova e informa o id", async () => {
  const { calls, events } = await runOnce({ [`POST /session/${SESSION}/model`]: 200, [`GET /session/${SESSION}/message`]: 404, "POST /session": 200 });
  assert.ok(calls.includes("POST /session"));
  assert.equal(events.find((e) => e.type === "session")?.sessionId, "ses_nova");
});

test("sessão saudável: reaproveita sem criar outra", async () => {
  const { calls, events } = await runOnce({ [`POST /session/${SESSION}/model`]: 200, [`GET /session/${SESSION}/message`]: 200 });
  assert.ok(!calls.includes("POST /session"));
  assert.equal(events.find((e) => e.type === "session")?.sessionId, SESSION);
});
