// @ts-check
// Erros dos motores traduzidos para a interface (tools/lib/engines/errors.js) e o parser de erros do Claude Code.
const test = require("node:test");
const assert = require("node:assert/strict");

const { describeError, sanitize } = require("../tools/lib/engines/errors");
const E = require("../tools/lib/engines");

const d = (err, engine = "claude") => describeError(err, { engine });
const fakeKey = "sk-" + "ant-" + "a".repeat(30); // montada na hora: o hook de segredos barra o literal

test("erros conhecidos viram título, mensagem e dica em português", () => {
  const cases = [
    ["Claude AI usage limit reached|1760000000", "limit", "claude"],
    ["API Error: 429 rate_limit_error", "limit", "claude"],
    ["Invalid API key · Please run /login", "auth", "claude"],
    ["Error: No conversation found with session ID: 0b8c", "session", "claude"],
    ["Prompt is too long", "context", "claude"],
    ["Google Gemini API retornou HTTP 400: API key not valid. Please pass a valid API key.", "auth", "gemini"],
    ["Google Gemini API retornou HTTP 503: The model is overloaded", "overloaded", "gemini"],
    ["connect ECONNREFUSED 127.0.0.1:63186", "server_down", "opencode"],
    ["OpenCode erro: upstream connection lost", "upstream", "opencode"],
    ["upstream closed", "upstream", "opencode"],
    ["fetch failed", "network", "gemini"],
    ["fetch failed", "local_offline", "ollama"],
    ["connect ECONNREFUSED 127.0.0.1:11434", "local_offline", "ollama"],
    ["model claude-x not found", "model", "claude"],
    ["error_max_turns", "max_turns", "claude"],
    ["Google Gemini API retornou HTTP 500: boom", "http", "gemini"],
  ];
  for (const [msg, code, engine] of cases) {
    const r = d(new Error(msg), engine);
    assert.equal(r.code, code, `${msg} -> ${r.code}`);
    assert.equal(r.expected, true);
    assert.ok(r.title && r.message, msg);
    assert.doesNotMatch(r.message, /ECONN|HTTP \d|undefined/, "a mensagem é nossa, não o texto cru");
  }
});

test("modelo local sem daemon não manda conferir a internet", () => {
  const local = d(new Error("fetch failed"), "ollama");
  assert.equal(local.title, "Ollama desligado");
  assert.match(local.hint || "", /ollama serve/);
  assert.doesNotMatch(local.hint || "", /internet/i);

  const cloud = d(new Error("fetch failed"), "gemini");
  assert.match(cloud.hint || "", /internet/i, "motores de nuvem mantêm a dica de conexão");
});

test("a dica de login depende do motor", () => {
  assert.match(d("Invalid API key", "claude").hint || "", /\/login/);
  assert.match(d("API key not valid", "gemini").hint || "", /GEMINI_API_KEY/);
  assert.match(d("Unauthorized 401", "opencode").hint || "", /opencode auth login/);
});

test("limite de uso mostra quando renova, se o erro disser", () => {
  assert.match(d("You've hit your limit · resets 3pm").message, /renova 3pm/);
  assert.doesNotMatch(d("rate limit exceeded").message, /renova/);
  assert.equal(d("rate limit").retryable, true);
  assert.equal(d("No conversation found with session ID: x").retryable, false);
});

test("erro desconhecido: mensagem genérica, detalhe limpo e marcado como não esperado", () => {
  const r = d(new Error(`algo bizarro em C:\\Users\\fulano\\git\\proj\\src\\x.js ${fakeKey} e fulano@empresa.com`));
  assert.equal(r.code, "unknown");
  assert.equal(r.expected, false);
  assert.match(r.message, /Claude Code devolveu um erro que o harness não reconheceu/);
  assert.ok(r.detail);
  assert.doesNotMatch(r.detail, /fulano|sk-ant|C:\\Users/, "sem segredo, e-mail nem caminho da máquina");
  assert.match(r.detail, /…\/x\.js/);
});

test("PublicError mantém o texto original, ganhando só título e dica", () => {
  const r = d(new E.PublicError("Claude Code não encontrado no PATH (defina CLAUDE_BIN em global/.env)."));
  assert.equal(r.code, "not_found");
  assert.equal(r.message, "Claude Code não encontrado no PATH (defina CLAUDE_BIN em global/.env).");
  assert.equal(r.detail, undefined);
  const t = d(new E.PublicError("Tempo limite de inatividade excedido (OpenCode sem novos dados por mais de 3 minutos)"), "opencode");
  assert.equal(t.code, "timeout");
  assert.match(t.message, /3 minutos/);
});

test("sanitize: sem stack trace, uma linha, tamanho limitado", () => {
  const out = sanitize("Error: falhou\n    at foo (C:\\x\\y\\z.js:1:1)\n    at bar (/home/u/p/q.js:2:2)\ndepois");
  assert.equal(out, "Error: falhou depois");
  assert.ok(sanitize("x".repeat(1000)).length <= 400);
  assert.equal(sanitize(undefined), "");
});

// ---------- parser do Claude Code ----------

const parse = (...events) => {
  const chunks = [];
  const p = E.createClaudeStreamParser((c) => chunks.push(c), null);
  events.forEach((e) => p.line(JSON.stringify(e)));
  return { p, chunks, errors: chunks.filter((c) => c.type === "error") };
};

test("parser: resultado com is_error vira erro tratado, e não texto de resposta", () => {
  const { p, chunks, errors } = parse(
    { type: "system", session_id: "s1" },
    { type: "result", subtype: "success", is_error: true, result: "Claude AI usage limit reached|1760000000", session_id: "s1" },
  );
  assert.equal(p.text, "", "a mensagem de erro não vira resposta");
  assert.equal(p.errored, true);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, "limit");
  assert.match(errors[0].error, /cota|plano/, "o campo error leva a mensagem em português");
  assert.ok(errors[0].title && errors[0].hint);
  assert.ok(!chunks.some((c) => c.type === "text"));
});

test("parser: erro depois de uma resposta parcial mantém o texto e avisa o erro", () => {
  const { p, errors } = parse(
    { type: "assistant", message: { id: "m1", content: [{ type: "text", text: "Começando..." }] } },
    { type: "result", subtype: "error_max_turns", is_error: true },
  );
  assert.equal(p.text, "Começando...");
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, "max_turns");
});

test("parser: result normal continua funcionando como antes", () => {
  const { p, errors } = parse({ type: "result", subtype: "success", is_error: false, result: "Pronto.", session_id: "s2" });
  assert.equal(p.text, "Pronto.");
  assert.equal(errors.length, 0);
  assert.equal(p.errored, false);
});
