// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const ollama = require("../tools/lib/engines/ollama");
const catalog = require("../tools/lib/engines/catalog.json");

test("Ollama Engine - estrutura básica", () => {
  assert.equal(ollama.id, "ollama");
  assert.equal(typeof ollama.stream, "function");
  assert.equal(typeof ollama.status, "function");
});

test("Ollama Engine - status quando daemon inacessível", async () => {
  const stat = await ollama.status(catalog.ollama);
  assert.ok(stat, "deve retornar objeto de status");
  assert.equal(typeof stat.available, "boolean");
  assert.ok(Array.isArray(stat.models));
  assert.ok(stat.defaultModel);
});

test("Ollama Engine - stream lida com erro de conexão graciosamente", async () => {
  let errorCaught = null;
  await new Promise((resolve) => {
    ollama.stream({
      prompt: "Olá teste",
      slug: "harness-leca",
      model: "qwen2.5-coder:1.5b",
      effort: "low",
      onChunk: () => {},
      onDone: () => resolve(null),
      onError: (err) => {
        errorCaught = err;
        resolve(null);
      },
    });
  });

  // Se o Ollama não estiver rodando localmente no momento do teste, deve chamar onError sem travar o processo
  if (errorCaught) {
    assert.ok(errorCaught instanceof Error || typeof errorCaught.message === "string");
  }
});
