// @ts-check
// Prompt do agente: regras do repositório + a história inteira + a lista de arquivos permitidos.

const RULES = [
  "Responda e comente em português do Brasil.",
  "Cada arquivo de código tem no máximo 300 linhas (meta de 150 a 250); divida em submódulos por responsabilidade.",
  "Proibido emoji no código e na interface; ícones só FontAwesome (`fa-solid` / `fa-regular`).",
  "Ao criar, mover ou remover arquivo, atualize o `MAPA.md` (caminho e o que faz, na tabela da área).",
  "Escreva teste de regressão para cada comportamento novo e rode só os seus testes com `node --test tests/<arquivo>.test.js`.",
  "Não faça commit, não troque de branch, não use `git add`, `git checkout` nem `git stash`. O revisor commita.",
  "Não toque em nenhum arquivo fora da lista permitida; se precisar, pare e explique o motivo no relatório final.",
  "Não leia nem escreva em `projects/` (dados locais) nem em `~`.",
  "Termine com um relatório curto: arquivos criados ou alterados, testes executados e o que ficou pendente.",
];

/** @param {{ id: string, title: string, body: string, allowed: string[], branch: string }} story */
function buildPrompt(story) {
  return [
    `Você vai implementar a história EP-${story.id} ("${story.title}") do repositório Harness Leca, na branch ${story.branch}.`,
    "",
    "## Regras do repositório",
    ...RULES.map((r) => `- ${r}`),
    "",
    "## Arquivos que você pode criar ou alterar",
    ...story.allowed.map((a) => `- ${a}`),
    "",
    "## História (especificação completa)",
    story.body,
  ].join("\n");
}

module.exports = { RULES, buildPrompt };
