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

test("default page size is 5 and only the presets are accepted", async () => {
  const { DEFAULT_PAGE_SIZE, PAGE_SIZE_PRESETS, getPageSize, setPageSize, normalizePageSize } =
    await load("shared/pagination.js");
  assert.equal(DEFAULT_PAGE_SIZE, 5);
  assert.deepEqual([...PAGE_SIZE_PRESETS], [5, 10, 25, 50]);
  assert.equal(getPageSize("fresh-list"), 5);
  setPageSize("fresh-list", 25);
  assert.equal(getPageSize("fresh-list"), 25);
  setPageSize("fresh-list", 7);
  assert.equal(getPageSize("fresh-list"), 5, "size outside the presets falls back to the default");
  assert.equal(normalizePageSize("10"), 10);
  assert.equal(normalizePageSize(null), 5);
});

test("renderPager mostra o seletor de tamanho quando a lista passa de 5 itens", async () => {
  const { paginate, renderPager } = await load("shared/pagination.js");
  assert.equal(renderPager(paginate([1, 2, 3], 1, 25)), "");
  const html = renderPager(paginate(Array.from({ length: 200 }, (_, i) => i), 5, 25), { key: "x" });
  assert.match(html, /data-pager="x"/);
  assert.match(html, /fa-chevron-left/);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /101-125 de 200/);
  assert.match(html, /data-page-size="x"/);
  assert.match(html, /<option value="5"/);
  assert.match(html, /<option value="10"/);
  assert.match(html, /<option value="25" selected/);
  assert.match(html, /<option value="50"/);
  assert.ok(!/[\u{1F300}-\u{1F9FF}]/u.test(html));
});

test("renderPager mostra o seletor mesmo com uma página só", async () => {
  const { paginate, renderPager } = await load("shared/pagination.js");
  const html = renderPager(paginate(Array.from({ length: 6 }, (_, i) => i), 1, 25), { key: "single" });
  assert.match(html, /data-page-size="single"/);
  assert.match(html, /1-6 de 6/);
});

test("Central renderiza só a página atual, mas o resumo conta tudo", async () => {
  const { renderCentral } = await load("modules/central-sessions-view.js");
  const { setPageSize } = await load("shared/pagination.js");
  const sessions = Array.from({ length: 80 }, (_, i) => ({
    id: `s-${i}`, title: `Sessao ${i}`, primaryProvider: "claude", executionStatus: "running",
    workflowStatus: "none", attentionStatus: "none", lastActivityAt: new Date(2026, 0, 1, 0, i).toISOString(),
  }));
  const params = { slug: "p", view: "list", query: "", filters: {}, options: {}, sessions, detail: null, selectedId: "", generatedAt: "", source: "live" };

  const withDefault = renderCentral({ ...params, page: 2 });
  assert.equal((withDefault.match(/class="central-row" role="row"/g) || []).length, 5);
  assert.match(withDefault, /6-10 de 80/);

  setPageSize("central", 25);
  const html = renderCentral({ ...params, page: 2 });
  assert.equal((html.match(/class="central-row" role="row"/g) || []).length, 25);
  assert.match(html, /26-50 de 80/);
});

test("Armário do escritório pagina o diário e mantém o total do dia", async () => {
  const { renderCabinetJournalItems } = await load("office/office-cabinet-journal.js");
  const { setPageSize } = await load("shared/pagination.js");
  setPageSize("cabinet", 25);
  const days = [{ day: "2026-11-01", sessions: Array.from({ length: 70 }, (_, i) => ({ titulo: `S${i}`, file: `f${i}.md`, agente: "claude", prompts: [] })) }];
  const html = renderCabinetJournalItems(days, [], "", 1);
  assert.equal((html.match(/class="chat-item-row"/g) || []).length, 25);
  assert.match(html, /\(70 sessões\)/);
  assert.match(html, /data-pager="cabinet"/);
  assert.equal((renderCabinetJournalItems(days, [], "S6", 1).match(/class="chat-item-row"/g) || []).length, 11);
});

test("pagedHtml lembra a página por chave, corrige página inválida e numera pelo índice absoluto", async () => {
  const { pagedHtml, setPage, getPage, setPageSize } = await load("shared/pagination.js");
  const items = Array.from({ length: 30 }, (_, i) => i);
  setPageSize("t1", 10);
  setPage("t1", 2);
  const out = pagedHtml(items, "t1", (item, index) => `<i>${index}:${item}</i>`, { pageSize: 25 });
  assert.equal((out.html.match(/<i>/g) || []).length, 10, "o tamanho por chamada é ignorado");
  assert.match(out.html, /<i>10:10<\/i>/);
  assert.match(out.pager, /data-pager="t1"/);
  setPage("t1", 99);
  pagedHtml(items, "t1", String);
  assert.equal(getPage("t1"), 3);
  assert.equal(getPage("outra"), 1);
});

test("bindPagers salva o tamanho, volta para a página 1 e chama onChange", async () => {
  const { bindPagers, setPage, getPage, getPageSize, setPageSizeSaver } = await load("shared/pagination.js");
  const saved = [];
  setPageSizeSaver((key, size) => saved.push([key, size]));

  const listeners = {};
  const select = { value: "25", addEventListener: (type, fn) => { listeners[type] = fn; } };
  const nav = {
    getAttribute: () => "lista-teste",
    querySelectorAll: () => [],
    querySelector: (selector) => (selector === "[data-page-size]" ? select : null),
  };
  const container = { querySelectorAll: () => [nav] };
  const changes = [];

  setPage("lista-teste", 3);
  bindPagers(container, (key, page) => changes.push([key, page]));
  listeners.change();

  assert.deepEqual(saved, [["lista-teste", 25]]);
  assert.equal(getPageSize("lista-teste"), 25);
  assert.equal(getPage("lista-teste"), 1);
  assert.deepEqual(changes, [["lista-teste", 1]]);
  setPageSizeSaver(null);
});

test("Backlog e épicos do Scrum paginam e o Fluxo/rotinas/artefatos usam pagedHtml", async () => {
  const fs = require("node:fs");
  const { setPage, setPageSize } = await load("shared/pagination.js");
  const { renderProductBacklog, renderEpicsWorkspace } = await load("modules/design-scrum-backlog.js");
  const stories = Array.from({ length: 60 }, (_, i) => ({ id: `st${i}`, key: `K-${i}`, title: `T${i}`, epicId: "e1", status: "todo", points: 1 }));
  const epics = Array.from({ length: 20 }, (_, i) => ({ id: `e${i}`, title: `E${i}` }));
  const scrum = { epics, stories, sprints: [], lanes: [], activeSprintId: "" };
  setPageSize("scrum-backlog", 25);
  setPageSize("scrum-epics", 10);
  setPage("scrum-backlog", 1);
  const backlog = renderProductBacklog(scrum);
  assert.equal((backlog.match(/story-key-badge/g) || []).length, 25);
  assert.match(backlog, /data-pager="scrum-backlog"/);
  assert.equal((renderEpicsWorkspace(scrum).match(/class="scrum-epic-card"/g) || []).length, 10);
  for (const file of ["design-routines.js", "design-artifacts.js", "design-workflows-view.js"]) {
    const src = fs.readFileSync(path.join(MODULES, "modules", file), "utf8");
    assert.match(src, /pagedHtml/, `${file} deve paginar`);
    assert.doesNotMatch(src, /pageSize:\s*\d+/, `${file} não deve fixar o tamanho da página`);
  }
});
