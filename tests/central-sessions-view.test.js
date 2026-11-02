// @ts-check
// Testes — View e cliente da Central de Sessões (EP-09.03)

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(".");
const VIEW_PATH = path.join(ROOT, "ui", "public", "js", "modules", "central-sessions-view.js");
const API_PATH = path.join(ROOT, "ui", "public", "js", "modules", "central-sessions-api.js");
const CSS_PATH = path.join(ROOT, "ui", "public", "css", "design", "23-central-sessoes.css");

const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u;

async function loadView() {
  return import(pathToFileURL(VIEW_PATH).href);
}

async function loadApi() {
  return import(pathToFileURL(API_PATH).href);
}

const SESSIONS = [
  {
    id: "s1",
    title: "Auditoria do quadro",
    primaryProvider: "claude",
    projectId: "saude-dispensacao",
    projectConfidence: "explicit",
    executionStatus: "running",
    workflowStatus: "running",
    attentionStatus: "none",
    lastObservedAt: "2026-10-21T10:00:00.000Z",
  },
  {
    id: "s2",
    title: "Deploy do protótipo",
    primaryProvider: "gemini",
    projectId: "saude-dispensacao",
    projectConfidence: "inferred",
    executionStatus: "failed",
    workflowStatus: "blocked",
    attentionStatus: "open",
    lastObservedAt: "2026-10-21T12:00:00.000Z",
  },
];

function baseParams(overrides = {}) {
  return {
    slug: "saude-dispensacao",
    view: "list",
    query: "",
    filters: {},
    options: { provider: [], executionStatus: [], workflowStatus: [], attentionStatus: [], projectConfidence: [] },
    sessions: SESSIONS,
    detail: null,
    selectedId: "",
    generatedAt: "2026-10-21T12:30:00.000Z",
    source: "live",
    ...overrides,
  };
}

test("Central - a visão em lista mostra cabeçalho, filtros e tabela com rótulos de estado", async () => {
  const { renderCentral } = await loadView();
  const html = renderCentral(baseParams());

  assert.match(html, /Central de Sessões/);
  assert.match(html, /id="centralSearch"/);
  assert.match(html, /id="centralRefresh"/);
  assert.match(html, /Auditoria do quadro/);
  assert.match(html, /Deploy do protótipo/);
  assert.match(html, /Executando/);
  assert.match(html, /Bloqueado/);
  assert.match(html, /Atenção necessária/);
  assert.match(html, /vínculo explícito/);
  assert.doesNotMatch(html, EMOJI_REGEX);
});

test("Central - a visão Kanban mostra as raias com contagem e cartões", async () => {
  const { renderCentral } = await loadView();
  const html = renderCentral(baseParams({ view: "kanban" }));

  assert.match(html, /class="central-kanban"/);
  assert.match(html, /Não classificado/);
  assert.match(html, /Implementação/);
  assert.match(html, /Aguardando aprovação/);
  assert.match(html, /central-card/);
  assert.doesNotMatch(html, EMOJI_REGEX);
});

test("Central - o painel de detalhe mostra a sessão selecionada e sinaliza a ausência de seleção", async () => {
  const { renderCentral } = await loadView();
  const vazio = renderCentral(baseParams());
  assert.match(vazio, /Selecione uma sessão/);

  const comDetalhe = renderCentral(
    baseParams({
      selectedId: "s2",
      detail: {
        artifacts: [{ path: "chats/2026-10-21-x.md" }],
        executions: [{ id: "e1", status: "failed" }],
        events: [{ type: "execution.failed", at: "2026-10-21T12:00:00.000Z" }],
      },
    }),
  );
  assert.match(comDetalhe, /Deploy do protótipo/);
  assert.match(comDetalhe, /chats\/2026-10-21-x\.md/);
  assert.match(comDetalhe, /execution\.failed/);
});

test("Central - estado vazio por filtro e por ausência de sessões", async () => {
  const { renderCentral } = await loadView();
  const semSessoes = renderCentral(baseParams({ sessions: [] }));
  assert.match(semSessoes, /Nenhuma sessão para os filtros atuais/);
});

test("Central - o cliente HTTP consulta o read model congelado e repassa os filtros", async () => {
  const { createHttpSessionClient } = await loadApi();
  const chamadas = [];
  const client = createHttpSessionClient({
    fetchImpl: async (url) => {
      chamadas.push(url);
      return { ok: true, json: async () => ({ sessions: [], totals: { total: 0 } }) };
    },
  });

  const payload = await client.listSessions("meu-projeto", { provider: "claude", q: "auditoria" });
  assert.equal(payload.totals.total, 0);
  assert.match(chamadas[0], /\/api\/project\/meu-projeto\/sessions\?/);
  assert.match(chamadas[0], /provider=claude/);
  assert.match(chamadas[0], /q=auditoria/);
});

test("Central - o cliente HTTP reporta falha sem devolver payload falso", async () => {
  const { createHttpSessionClient } = await loadApi();
  const client = createHttpSessionClient({
    fetchImpl: async () => ({ ok: false, status: 500, statusText: "Erro" }),
  });
  await assert.rejects(() => client.listSessions("meu-projeto"), /Falha ao consultar/);
});

test("Central - o adaptador determinístico filtra pelo mesmo contrato do modelo", async () => {
  const { createMockSessionClient } = await loadApi();
  const client = createMockSessionClient(SESSIONS);
  const payload = await client.listSessions("meu-projeto", { provider: "claude" });
  assert.equal(payload.sessions.length, 1);
  assert.equal(payload.source, "mock");
  const detalhe = await client.getSession("meu-projeto", "s2");
  assert.equal(detalhe.session.id, "s2");
  assert.equal(await client.getSession("meu-projeto", "nao-existe"), null);
});

test("Central - os arquivos novos seguem o limite de linhas e não usam emojis", () => {
  const files = [
    path.join(ROOT, "ui", "public", "js", "modules", "central-sessions.js"),
    path.join(ROOT, "ui", "public", "js", "modules", "central-sessions-model.js"),
    path.join(ROOT, "ui", "public", "js", "modules", "central-sessions-view.js"),
    path.join(ROOT, "ui", "public", "js", "modules", "central-sessions-api.js"),
    path.join(ROOT, "ui", "public", "css", "design", "23-central-sessoes.css"),
    path.join(ROOT, "ui", "public", "css", "design", "24-central-kanban.css"),
  ];
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    assert.ok(source.split("\n").length < 300, `${file} abaixo de 300 linhas`);
    assert.doesNotMatch(source, EMOJI_REGEX, `${file} sem emojis`);
  }
  assert.ok(fs.existsSync(CSS_PATH));
});

function manySessions(total) {
  return Array.from({ length: total }, (_, index) => ({
    id: "k" + index,
    title: "Sessão " + index,
    primaryProvider: "claude",
    projectId: "saude-dispensacao",
    projectConfidence: "explicit",
    executionStatus: "running",
    workflowStatus: "running",
    attentionStatus: "none",
    lastObservedAt: "2026-10-21T10:00:00.000Z",
  }));
}

test("Kanban - com 80 sessões cada raia mostra no máximo 5 cards, botão de mais e sem paginador", async () => {
  const { renderCentral } = await loadView();
  const html = renderCentral(baseParams({ view: "kanban", sessions: manySessions(80) }));

  assert.match(html, /class="central-kanban"/);
  assert.equal((html.match(/class="central-card"/g) || []).length, 5);
  assert.match(html, /data-lane-more="implementation"/);
  assert.match(html, /fa-solid fa-angles-down/);
  assert.match(html, /Mostrar mais \(75\)/);
  assert.doesNotMatch(html, /data-pager="central"/);
  assert.doesNotMatch(html, /central-notice/);
});

test("Kanban - o limite por raia respeita laneLimits e soma o passo de 5", async () => {
  const { renderCentral } = await loadView();
  const html = renderCentral(
    baseParams({ view: "kanban", sessions: manySessions(80), laneLimits: { implementation: 15 } }),
  );
  assert.equal((html.match(/class="central-card"/g) || []).length, 15);
  assert.match(html, /Mostrar mais \(65\)/);
});

test("Kanban - acima de 100 sessões cai na lista com aviso e botão para forçar o Kanban", async () => {
  const { renderCentral } = await loadView();
  const html = renderCentral(baseParams({ view: "kanban", sessions: manySessions(150) }));

  assert.match(html, /class="central-notice"/);
  assert.match(html, /fa-solid fa-triangle-exclamation/);
  assert.match(html, /data-kanban-force/);
  assert.match(html, /Mostrar Kanban mesmo assim/);
  assert.match(html, /class="central-list"/);
  assert.doesNotMatch(html, /class="central-kanban"/);
  assert.match(html, /data-pager="central"/);
});

test("Kanban - kanbanForce renderiza o Kanban acima do teto, sem o aviso", async () => {
  const { renderCentral } = await loadView();
  const html = renderCentral(baseParams({ view: "kanban", sessions: manySessions(150), kanbanForce: true }));

  assert.match(html, /class="central-kanban"/);
  assert.doesNotMatch(html, /central-notice/);
  assert.equal((html.match(/class="central-card"/g) || []).length, 5);
  assert.doesNotMatch(html, /data-pager="central"/);
});
