// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");

// A rota local depende da RAM livre no momento. Aqui o hardware é fixado como apto para
// exercitar o caminho local de forma determinística em qualquer máquina.
const hwPath = require.resolve("../tools/lib/hia/hardware-profiler");
const realHardware = require(hwPath);
require.cache[hwPath] = {
  id: hwPath,
  filename: hwPath,
  loaded: true,
  exports: { ...realHardware, getHardwareSnapshot: () => ({ ...realHardware.getHardwareSnapshot(), viable: true }) },
};

const { routeTask, matchDeterministicTool } = require("../tools/lib/hia/router");

test("HIA Router - matchDeterministicTool reconhece ferramentas determinísticas", () => {
  assert.equal(matchDeterministicTool("qual o status do git?"), "git.status");
  assert.equal(matchDeterministicTool("roda o check de sintaxe do projeto"), "repo.check");
  assert.equal(matchDeterministicTool("quem está com claim na história DIS-01?"), "coordination.status");
  assert.equal(matchDeterministicTool("listar arquivos de contexto deste projeto"), "context.list");
  assert.equal(matchDeterministicTool("crie um novo componente React com Tailwind"), null);
});

test("HIA Router - briefing de implementação com anexo não vira Script-First", () => {
  const prompt = "Vamos testar esse nosso protótipo\n\nVamos implementar 1 nova tela, é a nova página de pesquisar paciente\n\nWhatsApp Image 2026-10-20 at 14.37.45 (1).jpeg\nlembre de rodar o check e validar o json";
  assert.equal(matchDeterministicTool(prompt), null);
  assert.equal(routeTask({ prompt, requestedEngine: "claude" }).destination, "cloud");
});

test("HIA Router - prioriza Script-First para comandos determinísticos", () => {
  const dec = routeTask({ prompt: "qual o status do git atual?" });
  assert.equal(dec.destination, "script");
  assert.equal(dec.targetId, "git.status");
  assert.equal(dec.deterministic, true);
  assert.ok(dec.estimatedTokensSaved > 0);
});

test("HIA Router - respeita HIA_ROUTING_ENABLED=false", () => {
  const oldVal = process.env.HIA_ROUTING_ENABLED;
  try {
    process.env.HIA_ROUTING_ENABLED = "false";
    const dec = routeTask({ prompt: "qual o status do git?", requestedEngine: "claude" });
    assert.equal(dec.destination, "cloud");
    assert.equal(dec.targetId, "claude");
  } finally {
    process.env.HIA_ROUTING_ENABLED = oldVal;
  }
});

test("HIA Router - preserva motor de chat quando há histórico em andamento", () => {
  const dec = routeTask({
    prompt: "me explique mais sobre isso",
    requestedEngine: "opencode",
    hasHistory: true,
  });
  assert.equal(dec.destination, "cloud");
  assert.equal(dec.targetId, "opencode");
});

// O despachante grava telemetria em disco; nos testes a escrita é substituída por um dublê.
function stubTelemetry(t) {
  const telemetryPath = require.resolve("../tools/lib/hia/telemetry");
  const original = require.cache[telemetryPath];
  require.cache[telemetryPath] = {
    id: telemetryPath,
    filename: telemetryPath,
    loaded: true,
    exports: { recordExecution() {}, getTelemetryMetrics: () => ({}) },
  };
  t.after(() => {
    if (original) require.cache[telemetryPath] = original;
    else delete require.cache[telemetryPath];
  });
}

test("HIA Dispatcher - rota local_llm executa o motor Ollama e assina o turno", async (t) => {
  const E = require("../tools/lib/engines");
  const originalOllama = E.engines.get("ollama");
  t.after(() => E.engines.set("ollama", originalOllama));
  stubTelemetry(t);

  let received = null;
  E.engines.set("ollama", {
    id: "ollama",
    status: async () => ({ available: true, models: [], defaultModel: "qwen3.5:4b" }),
    stream: (opts) => {
      received = opts;
      opts.onChunk({ type: "text", text: "resumo" });
      opts.onDone({ fullText: "resumo" });
    },
  });

  const { handleChatWithHia } = require("../ui/server/services/hia-chat-dispatcher.service");
  const chunks = [];
  let done = null;
  let fallbacks = 0;
  const handled = await handleChatWithHia({
    engine: "claude",
    prompt: "resuma em poucas palavras o texto abaixo",
    slug: "harness-leca",
    sink: {
      onChunk: (d) => chunks.push(d),
      onDone: (d) => { done = d; },
      onError: (err) => { throw err; },
    },
    fallbackStream: () => { fallbacks++; },
  });

  assert.equal(handled, true);
  assert.equal(fallbacks, 0, "motor local respondeu: não deve cair para a nuvem");
  assert.equal(received.model, "qwen3.5:4b", "modelo do targetId chega ao motor local");
  assert.match(chunks[0].text, /^\[HIA Local-First\]/);
  assert.ok(chunks.some((c) => c.text === "resumo" && c.hiaRoute === "local_llm"), "texto do motor local é marcado");
  assert.equal(done.hiaRoute, "local_llm");
  assert.equal(done.hiaModel, "qwen3.5:4b");
  assert.ok(done.sessionId, "a sessão local é devolvida para a interface");
});

test("HIA Dispatcher - Ollama indisponível cai para o motor em nuvem sem quebrar o chat", async (t) => {
  const E = require("../tools/lib/engines");
  const originalOllama = E.engines.get("ollama");
  t.after(() => E.engines.set("ollama", originalOllama));
  stubTelemetry(t);

  E.engines.set("ollama", {
    id: "ollama",
    status: async () => ({ available: false, models: [], defaultModel: "qwen3.5:4b" }),
    stream: (opts) => opts.onError(new Error("connect ECONNREFUSED")),
  });

  const { handleChatWithHia } = require("../ui/server/services/hia-chat-dispatcher.service");
  const chunks = [];
  let fallbacks = 0;
  const handled = await handleChatWithHia({
    engine: "claude",
    prompt: "classifique o texto abaixo",
    slug: "harness-leca",
    sink: { onChunk: (d) => chunks.push(d), onDone: () => {}, onError: (err) => { throw err; } },
    fallbackStream: () => { fallbacks++; },
  });

  assert.equal(handled, false);
  assert.equal(fallbacks, 1, "sem resposta local, o motor pedido assume a conversa");
  assert.ok(chunks.some((c) => /Ollama local indisponível/.test(c.text)), "usuário é avisado da queda para a nuvem");
});

test("HIA Router - rota cloud sugere o combo do 9Router sem trocar motor nem destino", () => {
  const dec = routeTask({ prompt: "investigue a causa raiz desta exception no servico de pedidos", requestedEngine: "opencode" });
  assert.equal(dec.destination, "cloud");
  assert.equal(dec.targetId, "opencode");
  assert.equal(dec.suggestedCombo?.combo, "harness-bugs");
  assert.equal(dec.suggestedCombo?.modelRef, "9router/harness-bugs");
});

test("HIA Router - decisoes script nao carregam sugestao de combo", () => {
  assert.equal(routeTask({ prompt: "qual o status do git atual?" }).suggestedCombo, undefined);
});
