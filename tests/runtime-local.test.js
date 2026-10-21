// @ts-check
// Testes Unitários e de Integração — Local AI Runtime (EP-05.01)

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// A inferência local exige RAM livre. Aqui o perfil de memória é fixado como apto para
// que o resultado não dependa da carga da máquina em que a suíte roda.
const hwPath = require.resolve("../tools/lib/hia/hardware-profiler");
const realHardware = require(hwPath);
require.cache[hwPath] = {
  id: hwPath,
  filename: hwPath,
  loaded: true,
  exports: {
    ...realHardware,
    getMemoryProfile: () => ({ ...realHardware.getMemoryProfile(), freeMb: 8192, safeForInference: true }),
    getHardwareSnapshot: () => ({ ...realHardware.getHardwareSnapshot(), viable: true, alert: undefined }),
  },
};

const { isLocalUrl, getBaseUrl, checkHealth, generateStructured } = require("../tools/lib/runtime/ollama-client");
const { validateClassification } = require("../tools/lib/runtime/schema");
const { classifyTask } = require("../tools/lib/runtime/classifier");
const { recordInference, LOG_FILE } = require("../tools/lib/runtime/telemetry");
const { interceptShadowRequest } = require("../tools/lib/runtime/shadow");

test("Local AI Runtime - Validação de URLs locais", () => {
  assert.equal(isLocalUrl("http://localhost:11434"), true);
  assert.equal(isLocalUrl("http://127.0.0.1:11434"), true);
  assert.equal(isLocalUrl("http://[::1]:11434"), true);
  assert.equal(isLocalUrl("http://api.openai.com/v1"), false);
  assert.equal(isLocalUrl("https://evil.com"), false);
  assert.equal(isLocalUrl("not-a-url"), false);
});

test("Local AI Runtime - Validador de Schema Estrito", () => {
  // Caso Válido
  const validPayload = {
    tipo: "bug",
    complexidade: "baixa",
    modulo: "diario",
    executorSugerido: "local_llm",
    justificativa: "Correção de filtro sem impacto externo",
  };
  const res1 = validateClassification(validPayload);
  assert.equal(res1.valid, true);
  assert.equal(res1.errors.length, 0);
  assert.deepEqual(res1.value, validPayload);

  // Caso Inválido: Tipo fora do enum
  const invalidTipo = { ...validPayload, tipo: "unknown_type" };
  const res2 = validateClassification(invalidTipo);
  assert.equal(res2.valid, false);
  assert.match(res2.errors[0], /'tipo' inválido/);

  // Caso Inválido: Campo ausente
  const missingField = { tipo: "bug" };
  const res3 = validateClassification(missingField);
  assert.equal(res3.valid, false);
  assert.ok(res3.errors.length >= 4);
});

test("Local AI Runtime - Mock de Health Check do Ollama", async () => {
  const originalFetch = globalThis.fetch;
  try {
    // 1. Simula daemon online
    // @ts-ignore
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ version: "0.5.1" }),
    });
    const health = await checkHealth(500);
    assert.equal(health.ok, true);
    assert.equal(health.version, "0.5.1");

    // 2. Simula daemon offline
    // @ts-ignore
    globalThis.fetch = async () => {
      throw new Error("ECONNREFUSED");
    };
    const offlineHealth = await checkHealth(500);
    assert.equal(offlineHealth.ok, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Local AI Runtime - Mock de Inferência Estruturada e Métricas", async () => {
  const originalFetch = globalThis.fetch;
  try {
    // @ts-ignore
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        model: "qwen3.5:4b",
        response: JSON.stringify({
          tipo: "feature",
          complexidade: "media",
          modulo: "chat",
          executorSugerido: "local_llm",
          justificativa: "Nova funcionalidade de classificação",
        }),
        total_duration: 500000000,
        load_duration: 10000000,
        prompt_eval_duration: 200000000,
        eval_duration: 290000000,
        prompt_eval_count: 85,
        eval_count: 32,
      }),
    });

    const result = await generateStructured({
      prompt: "Adicionar botão de exportar",
      minFreeMemMb: 0, // Ignora restrição de hardware no mock
    });

    assert.equal(result.data.tipo, "feature");
    assert.equal(result.metrics.tokensPrompt, 85);
    assert.equal(result.metrics.tokensGenerated, 32);
    assert.equal(result.metrics.totalDurationMs, 500);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Local AI Runtime - Classificação com Mock e Validação", async () => {
  const originalFetch = globalThis.fetch;
  try {
    // @ts-ignore
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        response: JSON.stringify({
          tipo: "refactor",
          complexidade: "baixa",
          modulo: "diario",
          executorSugerido: "local_llm",
          justificativa: "Extração de função pura sem quebra",
        }),
      }),
    });

    const res = await classifyTask({ text: "Extrair lógicas repetidas" });
    assert.equal(res.success, true);
    assert.equal(res.classification?.tipo, "refactor");
    assert.equal(res.isAutomatedExecution, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Local AI Runtime - Gravação Sanitizada na Telemetria", () => {
  const correlationId = "test-" + Date.now();
  recordInference({
    correlationId,
    model: "qwen3.5:4b",
    valid: true,
    tipo: "bug",
    complexidade: "baixa",
    executorSugerido: "local_llm",
    modulo: "runtime",
    totalDurationMs: 250,
    tokensPrompt: 70,
    tokensGenerated: 15,
  });

  assert.ok(fs.existsSync(LOG_FILE));
  const content = fs.readFileSync(LOG_FILE, "utf8");
  const matchingLine = content
    .split("\n")
    .filter(Boolean)
    .find((l) => l.includes(correlationId));

  assert.ok(matchingLine, "Registro deve existir no log de telemetria");
  const parsed = JSON.parse(matchingLine);
  assert.equal(parsed.tipo, "bug");
  assert.equal(parsed.valid, true);
  assert.equal(parsed.prompt, undefined, "Prompt cru NUNCA deve ser gravado");
});

test("Local AI Runtime - Shadow Interceptor não quebra mesmo com falha do modelo", (t, done) => {
  const originalFetch = globalThis.fetch;
  // @ts-ignore
  globalThis.fetch = async () => {
    throw new Error("Ollama connection timed out");
  };

  assert.doesNotThrow(() => {
    interceptShadowRequest({
      prompt: "Teste de shadow com falha",
      slug: "saude-dispensacao",
      actualEngine: "claude",
    });
  });

  setTimeout(() => {
    globalThis.fetch = originalFetch;
    done();
  }, 50);
});
