import test from "node:test";
import assert from "node:assert/strict";
import { dp } from "../ui/public/js/deploy/deploy-store.js";
import { renderGrid, renderStats, renderHistory } from "../ui/public/js/deploy/deploy-render.js";

/**
 * Cria um elemento fake com comportamento mínimo para testar manipulação de DOM/innerHTML.
 * @returns {any}
 */
function createFakeElement() {
  const children = [];
  return {
    innerHTML: "",
    textContent: "",
    className: "",
    appendChild(child) {
      children.push(child);
    },
    get children() {
      return children;
    },
  };
}

test("deploy-render: renderGrid exibe estado vazio com FontAwesome e sem emojis", () => {
  dp.deployConfig = { projects: [] };
  const fakeGrid = createFakeElement();

  renderGrid(fakeGrid);

  assert.ok(fakeGrid.innerHTML.includes("Nenhum projeto de deploy cadastrado"));
  assert.ok(fakeGrid.innerHTML.includes("fa-rocket"));
  assert.ok(fakeGrid.innerHTML.includes("fa-plus"));
  // Garante que emojis comuns foram banidos
  assert.equal(/[\u{1F300}-\u{1F9FF}]/u.test(fakeGrid.innerHTML), false);
});

test("deploy-render: renderGrid renderiza projetos, ambientes e webhooks sem estourar escapeAttr", () => {
  dp.deployConfig = {
    projects: [
      {
        id: "proj-1",
        name: "Projeto Saúde",
        description: "Sistema de dispensação",
        environments: [
          {
            id: "prod",
            name: "Produção",
            type: "production",
            webhookUrl: "https://vps.example.com/api/deploy/prod?token=secret123",
            method: "POST",
          },
          {
            id: "staging",
            name: "Staging",
            type: "staging",
            webhookUrl: "",
            method: "POST",
          },
        ],
      },
    ],
  };
  dp.deployHistory = [];

  const fakeGrid = createFakeElement();

  // Executa sem lançar ReferenceError: escapeAttr is not defined
  assert.doesNotThrow(() => {
    renderGrid(fakeGrid);
  });

  assert.equal(fakeGrid.children.length, 1);
  const card = fakeGrid.children[0];

  // Verifica elementos do projeto
  assert.ok(card.innerHTML.includes("Projeto Saúde"));
  assert.ok(card.innerHTML.includes("Sistema de dispensação"));
  assert.ok(card.innerHTML.includes("fa-box-archive"));
  assert.ok(card.innerHTML.includes("fa-pen-to-square"));
  assert.ok(card.innerHTML.includes("fa-trash"));

  // Verifica linha de produção com webhook configurado e escapeAttr aplicado
  assert.ok(card.innerHTML.includes("env-prod"));
  assert.ok(card.innerHTML.includes("fa-shield-halved"));
  assert.ok(card.innerHTML.includes("btn-deploy-prod"));
  assert.ok(card.innerHTML.includes("fa-rocket"));
  assert.ok(card.innerHTML.includes("window.copyToClipboard('https://vps.example.com/api/deploy/prod?token=secret123')"));
  assert.ok(card.innerHTML.includes("fa-copy"));
  assert.ok(card.innerHTML.includes("fa-terminal"));

  // Verifica linha de staging sem webhook
  assert.ok(card.innerHTML.includes("env-staging"));
  assert.ok(card.innerHTML.includes("fa-flask"));
  assert.ok(card.innerHTML.includes("disabled title=\"Configure o Webhook antes de disparar\""));

  // Garante que não há emojis
  assert.equal(/[\u{1F300}-\u{1F9FF}]/u.test(card.innerHTML), false);
});

test("deploy-render: renderHistory renderiza status com FontAwesome sem caracteres emoji", () => {
  dp.deployHistory = [
    {
      timestamp: "2026-10-19T14:30:00.000Z",
      projectId: "proj-1",
      projectName: "Projeto Saúde",
      envId: "prod",
      envName: "Produção",
      ok: true,
      status: 200,
      statusText: "OK",
      durationMs: 340,
      snippet: "Deploy disparado com sucesso",
    },
    {
      timestamp: "2026-10-19T14:35:00.000Z",
      projectId: "proj-1",
      projectName: "Projeto Saúde",
      envId: "staging",
      envName: "Staging",
      ok: false,
      status: 500,
      statusText: "Webhook Error",
      durationMs: 120,
      snippet: "Timeout ao acionar",
    },
  ];

  const fakeTbody = createFakeElement();
  renderHistory(fakeTbody);

  assert.equal(fakeTbody.children.length, 2);

  const rowSuccess = fakeTbody.children[0];
  assert.ok(rowSuccess.innerHTML.includes("status-chip-ok"));
  assert.ok(rowSuccess.innerHTML.includes("fa-check"));
  assert.ok(rowSuccess.innerHTML.includes("200 OK"));

  const rowError = fakeTbody.children[1];
  assert.ok(rowError.innerHTML.includes("status-chip-err"));
  assert.ok(rowError.innerHTML.includes("fa-xmark"));
  assert.ok(rowError.innerHTML.includes("500 Webhook Error"));

  // Zero emojis
  assert.equal(/[\u{1F300}-\u{1F9FF}]/u.test(rowSuccess.innerHTML), false);
  assert.equal(/[\u{1F300}-\u{1F9FF}]/u.test(rowError.innerHTML), false);
});
