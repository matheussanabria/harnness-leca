// @ts-check
// Testes da paginação compartilhada do escritório e da Central de Sessões paginada.

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const MODULES = path.resolve("ui", "public", "js");
const load = (rel) => import(pathToFileURL(path.join(MODULES, rel)).href);

test("paginate limita a página, corrige página fora do intervalo e não muta a lista", async () => {
  const { paginate } = await load("shared/pagination.js");
  const items = Array.from({ length: 60 }, (_, i) => i);
  const p2 = paginate(items, 2, 25);
  assert.equal(p2.items.length, 25);
  assert.equal(p2.items[0], 25);
  assert.equal(p2.totalPages, 3);
  assert.equal(paginate(items, 99, 25).page, 3);
  assert.equal(paginate(items, -4, 25).page, 1);
  assert.equal(paginate([], 1).items.length, 0);
  assert.equal(paginate(null, 1).total, 0);
  assert.equal(items.length, 60);
});

test("renderPager não aparece com uma página só e usa ícones FontAwesome", async () => {
  const { paginate, renderPager } = await load("shared/pagination.js");
  assert.equal(renderPager(paginate([1, 2, 3], 1, 25)), "");
  const html = renderPager(paginate(Array.from({ length: 200 }, (_, i) => i), 5, 25), { key: "x" });
  assert.match(html, /data-pager="x"/);
  assert.match(html, /fa-chevron-left/);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /101-125 de 200/);
  assert.ok(!/[\u{1F300}-\u{1F9FF}]/u.test(html));
});

test("Central renderiza só a página atual, mas o resumo conta tudo", async () => {
  const { renderCentral, CENTRAL_PAGE_SIZE } = await load("modules/central-sessions-view.js");
  const sessions = Array.from({ length: 80 }, (_, i) => ({
    id: `s-${i}`, title: `Sessao ${i}`, primaryProvider: "claude", executionStatus: "running",
    workflowStatus: "none", attentionStatus: "none", lastActivityAt: new Date(2026, 0, 1, 0, i).toISOString(),
  }));
  const html = renderCentral({ slug: "p", view: "list", query: "", filters: {}, options: {}, sessions, detail: null, selectedId: "", generatedAt: "", source: "live", page: 2 });
  const rows = html.match(/class="central-row" role="row"/g) || [];
  assert.equal(rows.length, CENTRAL_PAGE_SIZE);
  assert.match(html, /26-50 de 80/);
});

test("Armário do escritório pagina o diário e mantém o total do dia", async () => {
  const { renderCabinetJournalItems, CABINET_PAGE_SIZE } = await load("office/office-cabinet-journal.js");
  const days = [{ day: "2026-11-01", sessions: Array.from({ length: 70 }, (_, i) => ({ titulo: `S${i}`, file: `f${i}.md`, agente: "claude", prompts: [] })) }];
  const html = renderCabinetJournalItems(days, [], "", 1);
  assert.equal((html.match(/class="chat-item-row"/g) || []).length, CABINET_PAGE_SIZE);
  assert.match(html, /\(70 sessões\)/);
  assert.match(html, /data-pager="cabinet"/);
  assert.equal((renderCabinetJournalItems(days, [], "S6", 1).match(/class="chat-item-row"/g) || []).length, 11);
});
