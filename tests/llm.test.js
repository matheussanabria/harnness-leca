// tools/lib/llm.js: o que dá para testar sem rede (parser de eventos, travas de custo e de entrada, sandbox do agente).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-llm-"));
process.env.HARNESS_ROOT = TMP_ROOT;
test.after(() => fs.rmSync(TMP_ROOT, { recursive: true, force: true }));

const L = require("../tools/lib/llm");

test("parseOpencodeEvents: junta os textos, ignora ruído e transforma erro do serviço em exceção", () => {
  const ok = [
    { type: "step_start" }, { type: "text", part: { type: "text", text: "## Memórias\n" } },
    { type: "tool", part: { type: "tool", tool: "read" } }, { type: "text", part: { type: "text", text: "- fato." } }, { type: "step_finish" },
  ].map((e) => JSON.stringify(e)).join("\n") + "\nlinha que nao e json\n";
  assert.equal(L.parseOpencodeEvents(ok), "## Memórias\n- fato.");
  assert.equal(L.parseOpencodeEvents(""), "");

  const err = JSON.stringify({ type: "error", error: { name: "APIError", data: { message: "limite de uso", statusCode: 429 } } });
  assert.throws(() => L.parseOpencodeEvents(err), /^Error: opencode: limite de uso \(HTTP 429\)$/);
  assert.throws(() => L.parseOpencodeEvents(JSON.stringify({ type: "error", error: { name: "Boom" } })), /opencode: Boom/);
});

test("isFreeOpencodeModel: só opencode/...-free passa sem pedir licença", () => {
  for (const ok of ["opencode/deepseek-v4.1-flash-free", "opencode/cat-jam-free", "opencode/nemotron-3.5-lightning-free"]) assert.ok(L.isFreeOpencodeModel(ok), ok);
  for (const no of ["opencode/big-pickle", "groq/llama-3.3-70b-versatile", "openrouter/gpt-free", "opencode/x-free/../y", "opencode/-free", "deepseek-free", "opencode/a b-free", ""]) {
    assert.ok(!L.isFreeOpencodeModel(no), `devia recusar: ${JSON.stringify(no)}`);
  }
  assert.ok(L.isFreeOpencodeModel(L.DEFAULT_OPENCODE_MODEL), "o padrão é gratuito");
});

test("askOpencode: modelo pago ou malformado é recusado ANTES de qualquer chamada", () => {
  assert.throws(() => L.askOpencode("x", "groq/llama-3.3-70b-versatile"), /não é um modelo gratuito/);
  assert.throws(() => L.askOpencode("x", "opencode/big-pickle"), /não é um modelo gratuito/);
  assert.throws(() => L.askOpencode("x", "sem-barra"), /--model inválido/);
  assert.throws(() => L.askOpencode("x", "opencode/ab; calc-free"), /--model inválido/);
  assert.throws(() => L.askOpencode("x", "opencode/../../x-free\nfoo"), /--model inválido/);
});

test("ask: motor desconhecido é erro claro; claude recusa --model com caracteres de shell", () => {
  assert.throws(() => L.ask({ engine: "gemini", prompt: "x" }), /não suportado na extração/);
  assert.throws(() => L.ask({ engine: "claude", model: "sonnet & calc", prompt: "x" }), /--model inválido/);
});

test("opencodeConfig: o agente extrator nega escrita, comandos, web e diretórios externos, e não compartilha a sessão", () => {
  const c = L.opencodeConfig();
  assert.equal(c.share, "disabled");
  assert.equal(c.autoupdate, false);
  for (const perm of [c.permission, c.agent.extrator.permission]) {
    for (const k of ["edit", "bash", "webfetch", "websearch", "task", "external_directory", "skill"]) assert.equal(perm[k], "deny", k);
    // A leitura NÃO é negada de propósito: o plano gratuito do OpenCode recusa (403) agentes sem nenhuma ferramenta.
    // O isolamento vem da pasta de trabalho vazia + external_directory negado.
    assert.ok(!("read" in perm) && !("glob" in perm) && !("grep" in perm));
  }
  assert.equal(c.agent.extrator.mode, "primary");
  assert.ok(!("prompt" in c.agent.extrator), "sem prompt customizado: o plano gratuito espera o do OpenCode");
  assert.ok(!("tools" in c.agent.extrator), "sem tools:false: zero ferramentas dá 403 no plano gratuito");
});

test("parseOpencodeEvents: erro com message e status no topo (limite de uso gratuito) mostra o motivo", () => {
  const err = JSON.stringify({ type: "error", error: { type: "provider.free-limit", message: "Free usage limit reached.", status: 429 } });
  assert.throws(() => L.parseOpencodeEvents(err), /^Error: opencode: Free usage limit reached\. \(HTTP 429\)$/);
});

test("askOpencode aceita ids com dois pontos (openrouter/...:free) e continua recusando metacaracteres de shell", () => {
  assert.throws(() => L.askOpencode("x", "openrouter/google/modelo:free; rm -rf", { allowPaid: true }), /inválido/);
  assert.throws(() => L.askOpencode("x", "opencode/modelo", {}), /não é um modelo gratuito/);
});
