// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const { COMBO_BY_TYPE, classifyTask, suggestCombo } = require("../tools/lib/hia/combo-map");

test("combo-map - classifica cada responsabilidade do SDLC", () => {
  const cases = [
    ["gere um diagrama mermaid do fluxo de login", "diagram"],
    ["escreva testes Jest para o servico de pagamento", "test"],
    ["faca code review deste diff", "review"],
    ["refatore o modulo de pedidos", "refactor"],
    ["investigue a causa raiz desta exception no log", "investigate"],
    ["atualize o README e o changelog", "docs"],
    ["monte o prototipo da tela de cadastro", "design"],
    ["orquestre a delegacao entre os subagentes", "orchestrate"],
    ["compare as bibliotecas de graficos", "research"],
    ["planeje a arquitetura do modulo de relatorios", "plan"],
    ["crie o endpoint de listagem de pacientes", "implement"],
    ["Explain what this problem is and help me fix it: Object is possibly 'null'.", "investigate"],
    ["app front end nao esta subindo, nao carrega o console", "investigate"],
    ["Precisamos ajustar nosso conversor para o modelo conta azul", "implement"],
    ["substituir para botao login no cabecalho", "implement"],
  ];
  for (const [prompt, expected] of cases) assert.equal(classifyTask(prompt), expected, prompt);
});

test("combo-map - pedidos operacionais e saudacoes ficam no combo geral", () => {
  for (const p of ["preciso fazer o push desse diretorio no github", "responda apenas OK", "Diga ola em poucas palavras"]) {
    assert.equal(classifyTask(p), "general", p);
  }
});

test("combo-map - prompt sem palavra-chave cai no combo geral", () => {
  const s = suggestCombo("bom dia, tudo bem?");
  assert.equal(s.type, "general");
  assert.equal(s.combo, "Harness");
  assert.equal(s.modelRef, "9router/Harness");
  assert.equal(s.source, "default");
});

test("combo-map - sugestao devolve o modelo no formato provedor/modelo do opencode", () => {
  const s = suggestCombo("escreva testes JUnit para o repositorio");
  assert.equal(s.combo, "harness-testes");
  assert.equal(s.modelRef, "9router/harness-testes");
  assert.equal(s.source, "keyword");
});

test("combo-map - mapa nao inclui combos de experimento nem entradas vazias", () => {
  for (const combo of Object.values(COMBO_BY_TYPE)) {
    assert.ok(combo && !/fusion|smart/.test(combo), combo);
  }
  assert.equal(new Set(Object.values(COMBO_BY_TYPE)).size, Object.keys(COMBO_BY_TYPE).length);
});
