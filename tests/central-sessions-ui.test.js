// @ts-check
// Testes do redesenho visual da Central de Sessões: cabeçalho, toolbar, lista e módulos.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.resolve(".");
const MODULES = path.join(ROOT, "ui", "public", "js", "modules");
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u;

const SESSIONS = [
  {
    id: "claude:e108ead2",
    title: "Auditoria do quadro",
    primaryProvider: "claude",
    projectId: "saude-dispensacao",
    projectConfidence: "explicit",
    executionStatus: "running",
    workflowStatus: "none",
    attentionStatus: "none",
    activity: "processing",
    presence: "connected",
    origin: "external",
    lastActivityAt: "2026-10-21T10:00:00.000Z",
    lastObservedAt: "2026-10-21T10:00:00.000Z",
  },
  {
    id: "gemini:run2",
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

function params(overrides = {}) {
  return {
    slug: "saude-dispensacao",
    view: "list",
    query: "",
    filters: {},
    options: {
      providers: [{ id: "claude", label: "claude" }],
      executionStatus: [{ id: "running", label: "Executando" }],
      workflowStatus: [{ id: "blocked", label: "Bloqueado" }],
      attentionStatus: [{ id: "open", label: "Atenção necessária" }],
      projectConfidence: [{ id: "inferred", label: "inferido" }],
    },
    sessions: SESSIONS,
    detail: null,
    selectedId: "",
    generatedAt: "2026-10-21T12:30:00.000Z",
    source: "live",
    ...overrides,
  };
}

async function loadView() {
  return import(pathToFileURL(path.join(MODULES, "central-sessions-view.js")).href);
}

test("Central - cabeçalho e resumo usam três cards com rótulos acessíveis", async () => {
  const { renderCentral } = await loadView();
  const html = renderCentral(params());
  assert.equal((html.match(/central-stat__value/g) || []).length, 3);
  assert.match(html, /aria-label="2 sessões no total"/);
  assert.match(html, /aria-label="1 com atenção necessária"/);
  assert.match(html, /aria-label="1 com vínculo inferido"/);
  assert.match(html, /class="central-header"/);
});

test("Central - toolbar mantém busca, atualização, filtros e alternância de visão", async () => {
  const { renderCentral } = await loadView();
  const html = renderCentral(params());
  for (const id of [
    "centralSearch",
    "centralRefresh",
    "centralFilterProvider",
    "centralFilterExecution",
    "centralFilterWorkflow",
    "centralFilterAttention",
    "centralFilterConfidence",
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /class="central-toolbar"/);
  assert.match(html, /data-view="list"/);
  assert.match(html, /data-view="kanban"/);
  assert.match(html, /central-filter__label/);
});

test("Central - a linha em lista tem seis colunas, motor e tempo relativo com tooltip", async () => {
  const { renderCentral } = await loadView();
  const html = renderCentral(params());
  for (const cell of ["session", "project", "status", "workflow", "attention", "origin"]) {
    assert.match(html, new RegExp(`central-cell--${cell}`));
  }
  assert.match(html, /class="central-row"/);
  assert.match(html, /data-engine="claude"/);
  assert.match(html, /data-engine="gemini"/);
  assert.match(html, /central-row__id/);
  assert.match(html, /central-row__time" title="[^"]+"/);
  assert.match(html, /central-muted/);
  assert.match(html, /central-badge--alert/);
});

test("Central - módulos do redesenho respeitam limite de linhas, sem emojis e com folga do dock", () => {
  const files = [
    "central-sessions-view.js",
    "central-sessions-toolbar.js",
    "central-sessions-card.js",
    "central-sessions-format.js",
    "central-sessions-presence.js",
  ].map((name) => path.join(MODULES, name));
  files.push(path.join(ROOT, "ui", "public", "css", "design", "23-central-sessoes.css"));
  files.push(path.join(ROOT, "ui", "public", "css", "design", "24-central-kanban.css"));
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    assert.ok(source.split("\n").length < 300, `${file} abaixo de 300 linhas`);
    assert.doesNotMatch(source, EMOJI_REGEX, `${file} sem emojis`);
  }
  const css = fs.readFileSync(path.join(ROOT, "ui", "public", "css", "design", "23-central-sessoes.css"), "utf8");
  assert.match(css, /padding:\s*14px 14px 88px/);
});

test("Central lembra Kanban, página e filtros quando o painel remonta", async () => {
  globalThis.window ??= { addEventListener() {}, removeEventListener() {}, location: { href: "" } };
  globalThis.document ??= { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
  const mod = await import(pathToFileURL(path.join(MODULES, "central-sessions.js")).href);
  const client = { listSessions: async () => ({ sessions: [], generatedAt: "", source: "live" }), getSession: async () => null };
  const makeContainer = () => ({ innerHTML: "", querySelector: () => null, querySelectorAll: () => [] });
  const first = await mod.mountCentral(makeContainer(), { slug: "mem-test", client, autoLive: false, state: { view: "kanban", page: 2, filters: { provider: "claude" } } });
  assert.equal(first.state.view, "kanban");
  const second = await mod.mountCentral(makeContainer(), { slug: "mem-test", client, autoLive: false, state: { query: "", selectedId: "" } });
  assert.equal(second.state.view, "kanban");
  assert.equal(second.state.page, 2);
  assert.deepEqual(second.state.filters, { provider: "claude" });
});

test("Central - mudança de status SSE troca só o badge, sem redesenhar o painel", async () => {
  globalThis.window ??= { addEventListener() {}, removeEventListener() {}, location: { href: "" } };
  globalThis.document ??= { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
  const mod = await import(pathToFileURL(path.join(MODULES, "central-sessions.js")).href);
  const client = { listSessions: async () => ({ sessions: [], generatedAt: "", source: "live" }), getSession: async () => null };
  const sources = [];
  class FakeEventSource {
    constructor(url) {
      this.url = url;
      sources.push(this);
    }
    addEventListener() {}
    close() {}
  }
  const previous = globalThis.EventSource;
  globalThis.EventSource = FakeEventSource;
  try {
    let innerWrites = 0;
    const badge = {
      outerHTML: "",
      writes: [],
    };
    Object.defineProperty(badge, "outerHTML", {
      get: () => "",
      set: (value) => badge.writes.push(value),
    });
    const container = {
      _html: "",
      querySelector: (selector) => (selector === ".central-live-badge" ? badge : null),
      querySelectorAll: () => [],
    };
    Object.defineProperty(container, "innerHTML", {
      get: () => container._html,
      set: (value) => {
        innerWrites += 1;
        container._html = value;
      },
    });
    await mod.mountCentral(container, { slug: "status-test", client, state: {} });
    assert.equal(sources.length, 1, "uma assinatura SSE por montagem");
    const writesAfterMount = innerWrites;
    const badgeWritesAfterMount = badge.writes.length;

    sources[0].onopen();
    sources[0].onopen();

    assert.equal(innerWrites, writesAfterMount, "status não redesenha o painel inteiro");
    assert.equal(badge.writes.length, badgeWritesAfterMount + 2, "badge trocado a cada status");
    assert.match(badge.writes.at(-1), /central-live-badge--connected/);
  } finally {
    globalThis.EventSource = previous;
  }
});
