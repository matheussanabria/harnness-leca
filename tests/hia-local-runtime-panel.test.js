// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(".");
const MODULE_PATH = path.join(ROOT, "ui", "public", "js", "modules", "chat-hia-local-runtime.js");

const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u;

async function loadModule() {
  return import(pathToFileURL(MODULE_PATH).href);
}

const SAMPLE = {
  totalInferences: 4,
  validInferences: 3,
  invalidInferences: 1,
  totalPromptTokens: 1200,
  totalGeneratedTokens: 800,
  avgDurationMs: 1500,
  byType: { bug: 2, docs: 1, feature: 1 },
  bySuggestedExecutor: { local_llm: 3, script: 1 },
};

test("painel HIA - bloco de runtime local renderiza métricas agregadas", async () => {
  const { renderLocalRuntime } = await loadModule();
  const html = renderLocalRuntime(SAMPLE);

  assert.match(html, /Runtime local \(Ollama\)/);
  assert.match(html, /4<\/div>/); // total de inferências
  assert.match(html, /75%/); // taxa de validade (3 de 4)
  assert.match(html, /2\.000/); // tokens somados (1200 + 800)
  assert.match(html, /1,5 s/); // duração média formatada
  assert.match(html, /Correção/); // rótulo traduzido de "bug"
  assert.match(html, /Motor local/); // rótulo traduzido de "local_llm"
  assert.doesNotMatch(html, EMOJI_REGEX);
});

test("painel HIA - bloco de runtime local trata payload vazio e ausente", async () => {
  const { renderLocalRuntime } = await loadModule();

  assert.equal(renderLocalRuntime(null), "");
  assert.equal(renderLocalRuntime(undefined), "");

  const empty = renderLocalRuntime({
    totalInferences: 0,
    validInferences: 0,
    invalidInferences: 0,
    totalPromptTokens: 0,
    totalGeneratedTokens: 0,
    avgDurationMs: 0,
    byType: {},
    bySuggestedExecutor: {},
  });
  assert.match(empty, /Nenhuma inferência local registrada/);
  assert.doesNotMatch(empty, EMOJI_REGEX);
});

test("painel HIA - distribuição ordena por contagem decrescente", async () => {
  const { renderLocalRuntime } = await loadModule();
  const html = renderLocalRuntime({
    ...SAMPLE,
    byType: { feature: 1, bug: 5, docs: 2 },
  });

  const bugIndex = html.indexOf("Correção");
  const docsIndex = html.indexOf("Documentação");
  const featureIndex = html.indexOf("Funcionalidade");
  assert.ok(bugIndex > 0 && docsIndex > bugIndex && featureIndex > docsIndex);
});
