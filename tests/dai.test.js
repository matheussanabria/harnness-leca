// @ts-check
const { test } = require("node:test");
const assert = require("node:assert/strict");
const DAI = require("../tools/lib/dai");
const { getProjectContext } = require("../tools/lib/engines/common");
const { createServer } = require("../ui/server");

// Os testes que leem agentes reais precisam da pasta do DAI desta máquina (DAI_PATH no .env, ou o caminho padrão).
// Em outra máquina ou no CI ela não existe: esses testes são pulados, e os que não dependem dela seguem rodando.
const NO_DAI = DAI.getDaiPath() ? false : "pasta do DAI não encontrada (defina DAI_PATH)";

test("DAI: lista agentes especializados com ícones e resumos", { skip: NO_DAI }, () => {
  const agents = DAI.listDaiAgents();
  assert.ok(Array.isArray(agents), "deve retornar um array de agentes");
  assert.ok(agents.length > 0, "deve encontrar agentes no DAI");
  const fe = agents.find((a) => a.id === "frontend-engineer");
  assert.ok(fe, "frontend-engineer deve estar presente");
  assert.equal(fe.icon, "🖥️");
  assert.equal(fe.title, "Frontend Engineer");
});

test("DAI: getDaiAgentPrompt recupera o conteúdo de AGENT.md", { skip: NO_DAI }, () => {
  const prompt = DAI.getDaiAgentPrompt("ux-ui-designer");
  assert.ok(prompt && prompt.length > 50, "deve retornar o texto do AGENT.md");
  assert.ok(prompt.includes("UX/UI designer sênior"), "deve conter o texto característico do agente");
  assert.equal(DAI.getDaiAgentPrompt("../tentativa-de-escape"), null, "deve sanitizar o id do agente");
});

test("DAI + Harness: getProjectContext injeta o papel do agente DAI", { skip: NO_DAI }, () => {
  const ctxWithAgent = getProjectContext("57multimarcas", { daiAgent: "frontend-engineer" });
  assert.ok(ctxWithAgent.includes("Papel do Agente DAI (frontend-engineer)"), "deve conter a seção do agente");
  assert.ok(ctxWithAgent.includes("engenheiro de frontend sênior"), "deve conter o conteúdo do agente");

  const ctxWithoutAgent = getProjectContext("57multimarcas");
  assert.ok(!ctxWithoutAgent.includes("Papel do Agente DAI"), "não deve injetar agente quando omitido");
});

test("Servidor UI: rota GET /api/dai responde agentes e workflows", { skip: NO_DAI }, async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(true)));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/dai`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.available);
    assert.ok(data.agents.length >= 10);
    assert.ok(data.workflows.length >= 4);
  } finally {
    server.close();
  }
});

// Sempre roda, com ou sem a pasta do DAI.
test("DAI: id de agente malformado ou ausente não devolve nada, e /api/dai responde mesmo sem o DAI", async () => {
  for (const bad of ["", null, undefined, "../x", "a/b", "a\b", "x".repeat(65), "com espaço", "agente-que-nao-existe-xyz"]) {
    assert.equal(DAI.getDaiAgentPrompt(/** @type {any} */ (bad)), null, JSON.stringify(bad));
  }
  assert.ok(!getProjectContext("57multimarcas", { daiAgent: "agente-que-nao-existe-xyz" }).includes("Papel do Agente DAI"));

  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(true)));
  const addr = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}/api/dai`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(typeof data.available, "boolean");
    assert.ok(Array.isArray(data.agents) && Array.isArray(data.workflows));
  } finally {
    server.close();
  }
});
