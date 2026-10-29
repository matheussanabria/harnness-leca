// Turno em streaming da API v2 (tools/lib/opencode-v2-turn.js): eventos SSE, silêncio com sessão ativa, falhas, queda do SSE, aborto.
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { runTurn, TurnError } = require("../tools/lib/opencode-v2-turn");

const SID = "ses_turno1";
const ev = (type, data) => `data: ${JSON.stringify({ id: "evt", type, data: { sessionID: SID, ...data } })}\n\n`;

/**
 * Servidor falso. `script(sse)` roda quando o prompt chega e escreve eventos; `messages` é o corpo de GET /message.
 * @param {{ script?: (sse: http.ServerResponse) => void, sse?: boolean, active?: boolean, messages?: any[] }} cfg
 */
function fake({ script = () => {}, sse = true, active = true, messages = [] } = {}) {
  const calls = [];
  let stream = null;
  const server = http.createServer((req, res) => {
    calls.push(`${req.method} ${req.url.split("?")[0]}`);
    res.setHeader("content-type", "application/json");
    if (req.url === "/api/event") {
      if (!sse) { res.statusCode = 404; return res.end("{}"); }
      res.setHeader("content-type", "text/event-stream");
      stream = res;
      return res.write(`data: ${JSON.stringify({ type: "server.connected", data: {} })}\n\n`);
    }
    if (req.method === "POST" && req.url === `/api/session/${SID}/prompt`) {
      res.end(JSON.stringify({ data: { id: "msg_1", time: { created: 1000 } } }));
      setTimeout(() => script(stream), 20);
      return;
    }
    if (req.url === "/api/session/active") return res.end(JSON.stringify({ data: active ? { [SID]: { type: "running" } } : {} }));
    if (req.url.startsWith(`/api/session/${SID}/message`)) return res.end(JSON.stringify({ data: typeof messages === "function" ? messages() : messages }));
    if (req.url === `/api/session/${SID}/interrupt`) return res.end("{}");
    res.statusCode = 404; res.end(JSON.stringify({ message: "rota " + req.url }));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, calls, base: `http://127.0.0.1:${server.address().port}` })));
}
const close = (s) => new Promise((r) => { s.server.closeAllConnections?.(); s.server.close(r); });
const OPTS = { tickMs: 20, syncMs: 100 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test("streaming: raciocínio e texto chegam por deltas, na ordem, e o turno termina em execution.succeeded", async (t) => {
  const s = await fake({ script: async (sse) => {
    sse.write(ev("session.execution.started", {}));
    sse.write(ev("session.reasoning.delta", { delta: "penso " }));
    sse.write(ev("session.reasoning.delta", { delta: "bem" }));
    sse.write(ev("session.text.delta", { delta: "ola, " }));
    await sleep(30);
    sse.write(ev("session.text.delta", { delta: "mundo" }));
    sse.write(ev("session.execution.succeeded", {}));
  }, messages: [{ type: "idle", outcome: "succeeded", time: { created: 2000 } }, { type: "assistant", time: { created: 1500 }, content: [{ type: "reasoning", text: "penso bem" }, { type: "text", text: "ola, mundo" }] }] });
  t.after(() => close(s));
  const order = [];
  const r = await runTurn(s.base, SID, "oi", { ...OPTS, onReasoning: (d) => order.push("R:" + d), onText: (d) => order.push("T:" + d) });
  assert.deepEqual(order, ["R:penso ", "R:bem", "T:ola, ", "T:mundo"], "sem duplicar com a leitura de /message");
  assert.equal(r.text, "ola, mundo");
  assert.equal(r.reasoning, "penso bem");
  assert.equal(r.aborted, false);
});

test("falha: execution.failed vira TurnError com a mensagem do servidor", async (t) => {
  const s = await fake({ script: (sse) => sse.write(ev("session.execution.failed", { error: { type: "provider.no-route", message: "Model unavailable: x/y" } })),
    messages: [{ type: "idle", outcome: "failed", time: { created: 2000 }, error: { message: "Model unavailable: x/y" } }] });
  t.after(() => close(s));
  await assert.rejects(runTurn(s.base, SID, "oi", OPTS), (e) => e instanceof TurnError && /OpenCode erro: Model unavailable: x\/y/.test(e.message));
});

test("silêncio longo não é morte: com a sessão ativa no servidor o turno espera e ainda entrega o texto", async (t) => {
  let finished = false;
  const s = await fake({ active: true, script: async (sse) => {
    await sleep(400); // mais que o idleMs abaixo
    finished = true;
    sse.write(ev("session.text.delta", { delta: "chegou" }));
    sse.write(ev("session.execution.succeeded", {}));
  }, messages: () => (finished ? [{ type: "idle", outcome: "succeeded", time: { created: 2000 } }, { type: "assistant", time: { created: 1500 }, content: [{ type: "text", text: "chegou" }] }] : []) });
  t.after(() => close(s));
  const r = await runTurn(s.base, SID, "oi", { ...OPTS, idleMs: 150 });
  assert.equal(r.text, "chegou");
  assert.ok(s.calls.includes("GET /api/session/active"), "consultou se a sessão ainda estava ativa");
});

test("silêncio com a sessão parada no servidor estoura o tempo de inatividade", async (t) => {
  const s = await fake({ active: false, script: () => {} });
  t.after(() => close(s));
  await assert.rejects(runTurn(s.base, SID, "oi", { ...OPTS, idleMs: 150 }), (e) => e instanceof TurnError && /inatividade/.test(e.message));
});

test("sem canal de eventos (SSE indisponível): cai para a leitura de /message e ainda conclui", async (t) => {
  const s = await fake({ sse: false, messages: [
    { type: "idle", outcome: "succeeded", time: { created: 2000 } },
    { type: "assistant", time: { created: 1500 }, content: [{ type: "reasoning", text: "r" }, { type: "text", text: "so no fim" }] },
  ] });
  t.after(() => close(s));
  const got = [];
  const r = await runTurn(s.base, SID, "oi", { ...OPTS, onText: (d) => got.push(d) });
  assert.equal(r.text, "so no fim");
  assert.deepEqual(got, ["so no fim"]);
});

test("aborto: devolve o parcial, marca aborted e manda interrupt ao servidor", async (t) => {
  const s = await fake({ script: (sse) => sse.write(ev("session.text.delta", { delta: "parcial" })) });
  t.after(() => close(s));
  const ac = new AbortController();
  const p = runTurn(s.base, SID, "oi", { ...OPTS, signal: ac.signal, onText: () => ac.abort() });
  const r = await p;
  assert.equal(r.aborted, true);
  assert.equal(r.text, "parcial");
  await sleep(50);
  assert.ok(s.calls.includes(`POST /api/session/${SID}/interrupt`));
});

test("silêncio: avisa periodicamente (onWaiting) enquanto a sessão segue ativa", async (t) => {
  let finished = false;
  const s = await fake({ active: true, script: async (sse) => {
    await sleep(500);
    finished = true;
    sse.write(ev("session.execution.succeeded", {}));
  }, messages: () => (finished ? [{ type: "idle", outcome: "succeeded", time: { created: 2000 } }] : []) });
  t.after(() => close(s));
  const waits = [];
  await runTurn(s.base, SID, "oi", { ...OPTS, waitingMs: 150, onWaiting: (sec) => waits.push(sec) });
  assert.ok(waits.length >= 2, `avisou ${waits.length}x durante 500 ms de silêncio`);
  assert.ok(waits.every((n) => Number.isInteger(n) && n >= 0));
});
