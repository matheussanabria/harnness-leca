// Testes unitários para o frontend do Atelier Agent Runtime (EP-15.05).
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  renderAtelierPlanCard,
  renderAtelierQuestionCard,
  renderAtelierToolCallBadge,
  getStepStatusIcon,
} = require("../ui/public/js/modules/prototype-atelier-agent-ui");

test("prototype-atelier-agent-ui: getStepStatusIcon retorna ícones FontAwesome válidos sem emojis", () => {
  const pendingIcon = getStepStatusIcon("pending");
  const inProgressIcon = getStepStatusIcon("in_progress");
  const doneIcon = getStepStatusIcon("done");

  assert.match(pendingIcon, /fa-regular fa-circle/);
  assert.match(inProgressIcon, /fa-solid fa-spinner fa-spin/);
  assert.match(doneIcon, /fa-solid fa-circle-check/);

  // Proibição estrita de emojis
  for (const icon of [pendingIcon, inProgressIcon, doneIcon]) {
    assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(icon), "Não deve conter emojis");
  }
});

test("prototype-atelier-agent-ui: renderAtelierPlanCard gera lista acessível de passos e suposições", () => {
  const plan = {
    steps: [
      { id: "step_1", title: "Definir grid e cabeçalho", status: "done" },
      { id: "step_2", title: "Criar tabela de produtos", status: "in_progress" },
      { id: "step_3", title: "Ajustar paginação", status: "pending" },
    ],
    assumptions: ["Design System DIS em uso", "Tabela suporta ordenação por coluna"],
  };

  const html = renderAtelierPlanCard(plan);

  assert.match(html, /atelier-plan-card/);
  assert.match(html, /1\/3 concluído\(s\)/);
  assert.match(html, /Definir grid e cabeçalho/);
  assert.match(html, /Criar tabela de produtos/);
  assert.match(html, /Ajustar paginação/);
  assert.match(html, /Suposições/);
  assert.match(html, /Design System DIS em uso/);
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(html), "Não deve conter emojis");
});

test("prototype-atelier-agent-ui: renderAtelierQuestionCard gera card interativo com botões de opções", () => {
  const questionPayload = {
    question: "Deseja que a tabela tenha busca global ou filtros por coluna?",
    options: ["Busca global no topo", "Filtros avançados por coluna", "Ambos"],
    context: "A lista de prescrições pode ter até 200 itens por página.",
  };

  const html = renderAtelierQuestionCard(questionPayload);

  assert.match(html, /atelier-question-card/);
  assert.match(html, /Deseja que a tabela tenha busca global/);
  assert.match(html, /data-answer="Busca global no topo"/);
  assert.match(html, /data-answer="Filtros avançados por coluna"/);
  assert.match(html, /data-answer="Ambos"/);
  assert.match(html, /A lista de prescrições pode ter até 200 itens/);
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(html), "Não deve conter emojis");
});

test("prototype-atelier-agent-ui: renderAtelierToolCallBadge gera badge com nomes amigáveis e FontAwesome", () => {
  const b1 = renderAtelierToolCallBadge("atelier_write_screen", "executing");
  const b2 = renderAtelierToolCallBadge("atelier_patch_styles", "done");
  const b3 = renderAtelierToolCallBadge("atelier_ask_user", "executing");

  assert.match(b1, /Escrevendo tela/);
  assert.match(b1, /fa-gear fa-spin/);

  assert.match(b2, /Aplicando estilos/);
  assert.match(b2, /fa-check/);

  assert.match(b3, /Aguardando resposta/);
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(b1 + b2 + b3), "Não deve conter emojis");
});
