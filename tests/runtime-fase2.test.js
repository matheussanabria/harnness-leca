// @ts-check
// Testes Unitários — Local AI Runtime Fase 2 (EP-09.01)
// Extração estruturada de conhecimento e roteamento HIA Local-First

const test = require("node:test");
const assert = require("node:assert/strict");

// A inferência local exige RAM livre: o perfil de memória é fixado como apto para
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

const { validateExtraction, extractKnowledge } = require("../tools/lib/runtime/extractor");
const { routeTask } = require("../tools/lib/hia/router");

test("Local AI Runtime Fase 2 - Validação de Schema de Extração", () => {
  // Caso Válido
  const validPayload = {
    decisoes: ["Adotar Ollama para tarefas estruturadas"],
    regras: ["Proibido exceder 300 linhas por arquivo", "Proibido usar emojis na interface"],
    termos: ["HIA", "Shadow Mode", "Prompt Caching"],
    resumo: "Definição arquitetural do runtime local sem impacto nos motores de nuvem.",
  };
  const res1 = validateExtraction(validPayload);
  assert.equal(res1.valid, true);
  assert.equal(res1.errors.length, 0);
  assert.deepEqual(res1.value, validPayload);

  // Caso Inválido: Campo obrigatório nulo ou não array
  const invalidPayload = {
    decisoes: "Não é um array",
    regras: [],
    termos: [],
    resumo: "",
  };
  const res2 = validateExtraction(invalidPayload);
  assert.equal(res2.valid, false);
  assert.ok(res2.errors.length >= 2);
});

test("Local AI Runtime Fase 2 - Mock de Extração Estruturada com Ollama", async () => {
  const originalFetch = globalThis.fetch;
  try {
    // @ts-ignore
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        model: "qwen3.5:4b",
        response: JSON.stringify({
          decisoes: ["Manter Claude como motor primário"],
          regras: ["Nunca executar ações automáticas da LLM"],
          termos: ["DAI", "Harness"],
          resumo: "Resumo da decisão técnica tomada.",
        }),
        total_duration: 800000000,
        prompt_eval_count: 120,
        eval_count: 45,
      }),
    });

    const result = await extractKnowledge({
      text: "Decidimos manter o Claude e não executar ações automáticas.",
    });

    assert.equal(result.success, true);
    assert.equal(result.extraction?.decisoes[0], "Manter Claude como motor primário");
    assert.equal(result.extraction?.regras[0], "Nunca executar ações automáticas da LLM");
    assert.equal(result.extraction?.termos.length, 2);
    assert.equal(result.metrics?.tokensPrompt, 120);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Local AI Runtime Fase 2 - HIA Router delega extração estruturada para Local-First", () => {
  const decision = routeTask({
    prompt: "extrair entidades e decisões da conversa em json",
  });

  assert.equal(decision.destination, "local_llm");
  assert.equal(decision.targetId, "ollama:qwen3.5:4b");
  assert.match(decision.reason, /Ollama local preservando cota/);
  assert.equal(decision.estimatedTokensSaved, 800);
});
