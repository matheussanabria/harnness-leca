// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const { RULESET, evaluateDor } = require("../ui/server/services/project-scrum-dor");

const REQUIRED_IDS = ["title", "description", "criteria-present", "criteria-verifiable"];
const ADVISORY_IDS = ["criteria-clear", "estimate", "epic", "priority", "open-questions"];
const ALL_IDS = [...REQUIRED_IDS, ...ADVISORY_IDS];

function completeStory() {
  return {
    title: "Titulo claro do teste",
    description: "a".repeat(40),
    acceptanceCriteria: ["c".repeat(20), "d".repeat(20)],
    points: 3,
    epicId: "epic-1",
    priority: "alta",
  };
}

function okResult() {
  const story = completeStory();
  return { story, result: evaluateDor(story) };
}

function checkById(result, id) {
  return result.checks.find((check) => check.id === id);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.getOwnPropertyNames(value).forEach((name) => deepFreeze(value[name]));
  }
  return value;
}

test("historia completa fica pronta com todas as nove checagens e ok", () => {
  const { story, result } = okResult();
  assert.equal(result.ready, true);
  assert.deepEqual(result.requiredFailed, []);
  assert.deepEqual(result.advisoryFailed, []);
  assert.deepEqual(result.checks.map((check) => check.id), ALL_IDS);
  for (const check of result.checks) {
    assert.equal(check.detail, "ok");
  }
  assert.equal(result.humanReview, true);
  assert.equal(result.ruleset, RULESET);
  assert.equal(story.description.length, 40);
});

test("cada checagem obrigatoria falha sozinha com os IDs esperados", () => {
  const cases = [
    { story: { ...completeStory(), title: "abc" }, expected: ["title"] },
    { story: { ...completeStory(), title: "Sem titulo" }, expected: ["title"] },
    { story: { ...completeStory(), title: "SÉM TITULO" }, expected: ["title"] },
    { story: { ...completeStory(), description: "a".repeat(19) }, expected: ["description"] },
    { story: { ...completeStory(), acceptanceCriteria: [] }, expected: ["criteria-present", "criteria-verifiable"] },
    { story: { ...completeStory(), acceptanceCriteria: ["curto"] }, expected: ["criteria-verifiable"] },
    {
      story: (() => {
        const story = completeStory();
        delete story.acceptanceCriteria;
        return story;
      })(),
      expected: ["criteria-present", "criteria-verifiable"],
    },
  ];
  for (const { story, expected } of cases) {
    const result = evaluateDor(story);
    assert.equal(result.ready, false, JSON.stringify(story.title));
    assert.deepEqual(result.requiredFailed, expected);
  }
});

test("criterio curto lista indexes 1-based ordenados no detalhe", () => {
  const story = completeStory();
  story.acceptanceCriteria = ["ok long enough text", "x", "another long enough one", "yy"];
  const result = evaluateDor(story);
  assert.equal(checkById(result, "criteria-verifiable").detail, "Criterios muito curtos: 2, 4");
});

test("falhas advisory nao bloqueiam a prontidao", () => {
  const story = {
    title: "Titulo claro do teste",
    description: "a".repeat(30),
    acceptanceCriteria: ["criterio com texto suficiente"],
  };
  const result = evaluateDor(story);
  assert.equal(result.ready, true);
  assert.deepEqual(result.advisoryFailed, ["estimate", "epic", "priority"]);
});

test("termos vagos sao marcados pelo index e prefixos nao confundem", () => {
  for (const vague of ["Deve ser rapido", "Interface amigável", "bom desempenho do sistema"]) {
    const story = { ...completeStory(), acceptanceCriteria: [vague] };
    const result = evaluateDor(story);
    const clear = checkById(result, "criteria-clear");
    assert.equal(clear.detail, "Termos vagos nos criterios: 1", vague);
    assert.deepEqual(result.advisoryFailed, ["criteria-clear"]);
  }
  const precise = { ...completeStory(), acceptanceCriteria: ["Retorna 200 e o corpo contem o id"] };
  assert.equal(checkById(evaluateDor(precise), "criteria-clear").detail, "ok");

  const prefixed = {
    ...completeStory(),
    acceptanceCriteria: ["Responde rapidamente", "O bombom aparece na lista"],
  };
  const flagged = evaluateDor(prefixed);
  assert.equal(checkById(flagged, "criteria-clear").detail, "Termos vagos nos criterios: 1");
});

test("marcadores de perguntas abertas sao detectados corretamente", () => {
  const flagged = [
    "TODO: definir a cor do botao principal",
    "O prazo tbd sera combinado com o time",
    "Layout a definir junto com o time design",
    "Comportamento ??? sem decisao registrada",
    "## Perguntas abertas\nFalta definir a cor do botao",
  ];
  for (const description of flagged) {
    const result = evaluateDor({ ...completeStory(), description });
    const open = checkById(result, "open-questions");
    assert.equal(open.ok, false, description);
    assert.equal(open.detail, "Pendencias abertas no texto", description);
  }
  const clean = [
    "## Perguntas abertas",
    "Todos os usuarios veem todo o historico",
  ];
  for (const description of clean) {
    const result = evaluateDor({ ...completeStory(), description });
    assert.equal(checkById(result, "open-questions").ok, true, description);
  }
});

test("entradas invalidas nunca lancam erro e ficam nao prontas", () => {
  const malformed = {
    acceptanceCriteria: "not an array",
    points: "3",
    title: 123,
  };
  for (const story of [null, undefined, "texto", 42, {}, malformed]) {
    assert.doesNotThrow(() => evaluateDor(story));
    assert.equal(evaluateDor(story).ready, false);
  }
});

test("avaliacao e pura: entrada congelada gera resultados identicos", () => {
  const story = deepFreeze(completeStory());
  const first = evaluateDor(story);
  const second = evaluateDor(story);
  assert.deepEqual(first, second);
  assert.equal(second.ready, true);
});

test("limites exatos de tamanho separam aprovacao e reprovacao", () => {
  const passCriterion = { ...completeStory(), acceptanceCriteria: ["0123456789"] };
  assert.deepEqual(evaluateDor(passCriterion).requiredFailed, []);
  const failCriterion = { ...completeStory(), acceptanceCriteria: ["012345678"] };
  assert.deepEqual(evaluateDor(failCriterion).requiredFailed, ["criteria-verifiable"]);

  const passDescription = { ...completeStory(), description: "a".repeat(20) };
  assert.deepEqual(evaluateDor(passDescription).requiredFailed, []);
  const failDescription = { ...completeStory(), description: "a".repeat(19) };
  assert.deepEqual(evaluateDor(failDescription).requiredFailed, ["description"]);

  const passTitle = { ...completeStory(), title: "ABCDE" };
  assert.deepEqual(evaluateDor(passTitle).requiredFailed, []);
  const failTitle = { ...completeStory(), title: "ABCD" };
  assert.deepEqual(evaluateDor(failTitle).requiredFailed, ["title"]);
});

test("estimate: so inteiro positivo conta (0, negativo, fracao e texto reprovam)", () => {
  const base = { title: "Titulo valido", description: "Descricao com mais de vinte caracteres.", acceptanceCriteria: ["Criterio com tamanho suficiente"] };
  for (const points of [0, -1, 2.5, "3", null, undefined, NaN]) {
    assert.ok(evaluateDor({ ...base, points }).advisoryFailed.includes("estimate"), `points=${String(points)}`);
  }
  for (const points of [1, 3, 21]) {
    assert.ok(!evaluateDor({ ...base, points }).advisoryFailed.includes("estimate"), `points=${points}`);
  }
});
