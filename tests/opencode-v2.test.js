// Cliente da API v2 do opencode (tools/lib/opencode-v2.js) contra um servidor HTTP falso com senha.
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const V2 = require("../tools/lib/opencode-v2");

const AUTH = "Basic " + Buffer.from("opencode:segredo").toString("base64");

/** Servidor falso: guarda as chamadas e responde conforme `routes["METODO /caminho"]`. */
function fake(routes) {
  const calls = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      calls.push({ method: req.method, url: req.url, auth: req.headers.authorization, body: body ? JSON.parse(body) : undefined });
      const key = `${req.method} ${req.url.split("?")[0].replace(/ses_[A-Za-z0-9]+/, "ses_X")}`;
      const r = routes[key];
      res.setHeader("content-type", "application/json");
      if (!r) { res.statusCode = 404; return res.end(JSON.stringify({ message: "rota " + key })); }
      res.statusCode = r.status || 200;
      res.end(JSON.stringify(r.body));
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, calls, base: `http://127.0.0.1:${server.address().port}` })));
}
const close = (s) => new Promise((r) => { s.server.closeAllConnections?.(); s.server.close(r); });
const withAuth = (t, fn) => {
  const prev = process.env.OPENCODE_SERVER_PASSWORD;
  process.env.OPENCODE_SERVER_PASSWORD = "segredo";
  t.after(() => { if (prev === undefined) delete process.env.OPENCODE_SERVER_PASSWORD; else process.env.OPENCODE_SERVER_PASSWORD = prev; });
  return fn();
};

test("summarizeTurn: raciocínio, texto e fim vêm do turno certo (mensagens da mais nova para a mais antiga)", () => {
  const data = [
    { type: "idle", outcome: "succeeded", time: { created: 300 } },
    { type: "assistant", time: { created: 250 }, finish: "stop", content: [{ type: "reasoning", text: "penso " }, { type: "reasoning", text: "mais" }, { type: "text", text: "ok" }] },
    { type: "user", text: "pergunta", time: { created: 200 } },
    { type: "idle", outcome: "succeeded", time: { created: 100 } }, // turno anterior: ignorado
    { type: "assistant", time: { created: 90 }, content: [{ type: "text", text: "resposta velha" }] },
  ];
  const t = V2.summarizeTurn(data, 200);
  assert.deepEqual(t, { reasoning: "penso mais", text: "ok", done: true, outcome: "succeeded", error: "", finish: "stop" });
});

test("summarizeTurn: turno em andamento não está pronto; falha traz a mensagem do servidor", () => {
  const running = V2.summarizeTurn([{ type: "assistant", time: { created: 5 }, content: [{ type: "text", text: "par" }] }], 1);
  assert.equal(running.done, false);
  assert.equal(running.text, "par");
  const failed = V2.summarizeTurn([{ type: "idle", outcome: "failed", time: { created: 9 }, error: { type: "provider.no-route", message: "Model unavailable: x/y" } }], 1);
  assert.equal(failed.done, true);
  assert.equal(failed.error, "Model unavailable: x/y");
});

test("summarizeTurn: vários blocos do assistente se juntam; cota de tokens sem texto vira erro", () => {
  const multi = V2.summarizeTurn([
    { type: "idle", outcome: "succeeded", time: { created: 9 } },
    { type: "assistant", time: { created: 8 }, content: [{ type: "text", text: "B" }] },
    { type: "assistant", time: { created: 5 }, content: [{ type: "text", text: "A" }] },
  ], 1);
  assert.equal(multi.text, "A\n\nB");
  const length = V2.summarizeTurn([
    { type: "idle", outcome: "succeeded", time: { created: 9 } },
    { type: "assistant", time: { created: 5 }, finish: "length", content: [{ type: "reasoning", text: "x" }] },
  ], 1);
  assert.match(length.error, /esgotou a cota/);
});

test("sessão e prompt: rotas /api, modelo na criação, senha em todas as chamadas", async (t) => {
  const s = await fake({
    "POST /api/session": { body: { data: { id: "ses_abc123" } } },
    "POST /api/session/ses_X/model": { body: {} },
    "POST /api/session/ses_X/prompt": { body: { data: { id: "msg_1", time: { created: 777 } } } },
    "POST /api/session/ses_X/interrupt": { body: {} },
  });
  t.after(() => close(s));
  await withAuth(t, async () => {
    const id = await V2.createSession(s.base, { model: "9router/Harness", agent: "plan" });
    assert.equal(id, "ses_abc123");
    await V2.setSessionModel(s.base, id, "glm-5.3-flash-free");
    const sent = await V2.sendPrompt(s.base, id, "oi");
    assert.deepEqual(sent, { id: "msg_1", created: 777 });
    await V2.interrupt(s.base, id);
  });
  assert.deepEqual(s.calls[0].body, { model: { id: "Harness", providerID: "9router" }, agent: "plan" });
  assert.deepEqual(s.calls[1].body, { model: { id: "glm-5.3-flash-free", providerID: "opencode" } });
  assert.deepEqual(s.calls[2].body, { text: "oi" });
  assert.ok(s.calls.every((c) => c.auth === AUTH), "toda chamada leva a senha");
});

test("readTurn e erros: lê as mensagens do turno; HTTP de erro vira OpenCodeApiError com a mensagem do servidor", async (t) => {
  const s = await fake({
    "GET /api/session/ses_X/message": { body: { data: [{ type: "idle", outcome: "succeeded", time: { created: 5 } }, { type: "assistant", time: { created: 4 }, content: [{ type: "text", text: "feito" }] }] } },
    "POST /api/session/ses_X/prompt": { status: 404, body: { message: "Session not found" } },
  });
  t.after(() => close(s));
  await withAuth(t, async () => {
    const turn = await V2.readTurn(s.base, "ses_abc", 1);
    assert.equal(turn.text, "feito");
    assert.equal(turn.done, true);
    await assert.rejects(() => V2.sendPrompt(s.base, "ses_abc", "x"), (e) => e instanceof V2.OpenCodeApiError && e.status === 404 && /Session not found/.test(e.message));
  });
  assert.match(s.calls[0].url, /limit=100/);
});

test("listModels: provedor embutido sem prefixo, os demais como provedor/modelo, sem repetidos", async (t) => {
  const s = await fake({
    "GET /api/model": { body: { data: [
      { id: "glm-5.3-flash-free", modelID: "glm-5.3-flash-free", providerID: "opencode", name: "GLM 5.3 Flash" },
      { id: "Harness", modelID: "Harness", providerID: "9router", name: "Harness" },
      { id: "openai/gpt-6", modelID: "openai/gpt-6", providerID: "openrouter", name: "GPT-6" },
      { id: "Harness", modelID: "Harness", providerID: "9router", name: "Harness" },
    ] } },
  });
  t.after(() => close(s));
  const models = await withAuth(t, () => V2.listModels(s.base));
  assert.deepEqual(models, [
    { id: "glm-5.3-flash-free", name: "GLM 5.3 Flash", desc: "Modelo Gratuito" },
    { id: "9router/Harness", name: "Harness", desc: "9router" },
    { id: "openrouter/openai/gpt-6", name: "GPT-6", desc: "openrouter" },
  ]);
});

test("createSession: regras de permissão da sessão vão no corpo (e só quando pedidas)", async (t) => {
  const s = await fake({ "POST /api/session": { body: { data: { id: "ses_perm1" } } } });
  t.after(() => close(s));
  const rules = [{ action: "shell", resource: "*", effect: "deny" }];
  await withAuth(t, async () => {
    await V2.createSession(s.base, { model: "9router/Harness", permissions: rules });
    await V2.createSession(s.base, { model: "9router/Harness" });
  });
  assert.deepEqual(s.calls[0].body.permissions, rules);
  assert.equal("permissions" in s.calls[1].body, false);
});

test("ateliê: a lista de bloqueios cobre o shell (o modelo contornava write/edit/bash por ele) e não bloqueia leitura", () => {
  const { NO_NATIVE_WRITES } = require("../ui/server/services/atelier-engine-adapters.service");
  const denied = new Set(NO_NATIVE_WRITES.map((r) => r.action));
  for (const a of ["write", "edit", "shell", "bash", "patch", "apply_patch", "multiedit"]) assert.ok(denied.has(a), `nega ${a}`);
  for (const a of ["read", "glob", "grep", "list"]) assert.ok(!denied.has(a), `não nega ${a} (leitura do Design System)`);
  assert.ok(NO_NATIVE_WRITES.every((r) => r.effect === "deny" && r.resource === "*"));
});
