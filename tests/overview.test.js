// Visão geral (GET /api/overview + página /overview) e ação do sistema POST /api/sync do ui/server.js,
// com o servidor em memória (porta livre) e uma raiz do harness temporária.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-ov-"));
process.env.HARNESS_ROOT = TMP_ROOT;
const projects = path.join(TMP_ROOT, "projects");
const proj = (slug) => path.join(projects, slug);
fs.mkdirSync(path.join(proj("_template")), { recursive: true });
fs.mkdirSync(path.join(TMP_ROOT, "global"), { recursive: true });
fs.writeFileSync(path.join(projects, ".active"), "beta\n");
fs.writeFileSync(path.join(TMP_ROOT, "global", "instructions.md"), "global");

// alpha: 2 conversas (a mais recente primeiro na visão geral), contexto e memória.
// beta: 1 conversa antiga e NENHUM arquivo em chats/ com atividade recente.
const chat = (titulo, sessao, inicio, fim) =>
  `---\ntitulo: "${titulo}"\nsessao: ${sessao}\nagente: "claude"\ninicio: ${inicio}\nfim: ${fim}\n---\n# ${titulo}\n\n## Voc\u00ea\n\noi\n`;
const makeProject = (slug, chats) => {
  fs.mkdirSync(path.join(proj(slug), "chats"), { recursive: true });
  fs.mkdirSync(path.join(proj(slug), "context"), { recursive: true });
  fs.writeFileSync(path.join(proj(slug), "instructions.md"), `# regras ${slug}\n`);
  fs.writeFileSync(path.join(proj(slug), "memory.md"), `- fato de ${slug}\n`);
  for (const [name, content, when] of chats) {
    const file = path.join(proj(slug), "chats", name);
    fs.writeFileSync(file, content);
    fs.utimesSync(file, when, when);
  }
};
makeProject("alpha", [
  ["2026-01-01-antiga.md", chat("Conversa antiga", "sessao-a1", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"), new Date("2026-01-01T12:00:00Z")],
  ["2026-02-01-recente.md", chat("Conversa recente", "sessao-a2", "2026-02-01T00:00:00Z", "2026-02-01T09:30:00Z"), new Date("2026-02-01T09:30:00Z")],
]);
fs.writeFileSync(path.join(proj("alpha"), "context", "ref.md"), "contexto\n");
makeProject("beta", [
  ["2025-12-01-beta.md", chat("Beta antiga", "sessao-b1", "2025-12-01T00:00:00Z", "2025-12-01T00:00:00Z"), new Date("2025-12-01T10:00:00Z")],
]);
test.after(() => fs.rmSync(TMP_ROOT, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));

const { createServer } = require("../ui/server");

let server, base;
test.before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => { server.closeAllConnections(); server.close(); });

const get = (p) => fetch(base + p);
const post = (p, body) => fetch(base + p, {
  method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify(body),
});
// Eventos SSE de /api/sync: um bloco "data: {...}\n\n" por linha de log e um "done" no fim.
const events = (text) => text.split("\n\n").filter((b) => b.startsWith("data: ")).map((b) => JSON.parse(b.slice(6)));

test("GET /api/overview: resumo por projeto, projeto ativo e ordenação por atividade", async () => {
  const ov = await (await get("/api/overview")).json();
  assert.equal(ov.total, 2, "_template não conta");
  assert.equal(ov.active, "beta");
  assert.equal(ov.page, 1);
  assert.equal(ov.pages, 1);
  assert.deepEqual(ov.projects.map((p) => p.slug), ["alpha", "beta"], "quem teve chat mais recente vem primeiro");

  const [alpha, beta] = ov.projects;
  assert.equal(alpha.active, false);
  assert.equal(alpha.chats, 2);
  assert.equal(alpha.lastChat, "2026-02-01");
  assert.deepEqual(alpha.extraction, { total: 2, ok: 0, nova: 2, alterada: 0 }, "sem estado extraído, tudo pendente");
  assert.equal(alpha.context, 1);
  assert.equal(alpha.scheduled, 0);
  assert.ok(alpha.memoryBytes > 0 && alpha.instructionsBytes > 0);
  assert.equal(alpha.review.pendentes, 0);

  assert.equal(beta.active, true, "marcado como ativo em projects/.active");
  assert.equal(beta.chats, 1);
  assert.equal(beta.lastChat, "2025-12-01");
  assert.equal(beta.context, 0);
});

test("GET /api/overview: paginação com page/pageSize e limites de valores ruins", async () => {
  const p1 = await (await get("/api/overview?page=1&pageSize=1")).json();
  assert.equal(p1.total, 2);
  assert.equal(p1.pageSize, 1);
  assert.equal(p1.pages, 2);
  assert.deepEqual(p1.projects.map((p) => p.slug), ["alpha"]);

  const p2 = await (await get("/api/overview?page=2&pageSize=1")).json();
  assert.deepEqual(p2.projects.map((p) => p.slug), ["beta"]);
  assert.equal(p2.projects[0].active, true);

  const alem = await (await get("/api/overview?page=99&pageSize=1")).json();
  assert.equal(alem.page, 2, "página além do fim cai na última");
  assert.equal(alem.projects.length, 1);

  const zero = await (await get("/api/overview?page=0&pageSize=0")).json();
  assert.equal(zero.page, 1);
  assert.equal(zero.pageSize, 10, "pageSize 0 usa o padrão");

  const enorme = await (await get("/api/overview?pageSize=9999")).json();
  assert.equal(enorme.pageSize, 50, "teto de pageSize");

  const lixo = await (await get("/api/overview?page=abc&pageSize=xyz")).json();
  assert.equal(lixo.page, 1);
  assert.equal(lixo.pageSize, 10);
});

// O resumo fica em cache entre as requisições; uma conversa nova precisa aparecer sem reiniciar o servidor.
test("GET /api/overview: conversa nova invalida o cache do resumo", async () => {
  const antes = await (await get("/api/overview")).json();
  const alpha = antes.projects[0];
  assert.equal(alpha.slug, "alpha");
  assert.equal(alpha.chats, 2);

  const novo = path.join(proj("alpha"), "chats", "2026-03-01-nova.md");
  try {
    fs.writeFileSync(novo, chat("Recém-chegada", "sessao-a3", "2026-03-01T00:00:00Z", "2026-03-01T08:00:00Z"));
    const depois = await (await get("/api/overview")).json();
    assert.equal(depois.projects[0].slug, "alpha", "a atividade nova mantém o projeto no topo");
    assert.equal(depois.projects[0].chats, 3);
    assert.equal(depois.projects[0].lastChat, "2026-03-01");
    assert.equal(depois.projects[0].extraction.nova, 3);
  } finally {
    fs.rmSync(novo, { force: true });
  }
});

test("página /overview é servida (com e sem .html) e traz a lista de ações", async () => {
  for (const url of ["/overview", "/overview.html"]) {
    const res = await get(url);
    assert.equal(res.status, 200, url);
    assert.match(res.headers.get("content-type"), /text\/html/);
    const html = await res.text();
    assert.match(html, /Visão geral dos projetos/);
    assert.match(html, /Sincronizar todos os motores e conversas/);
    assert.match(html, /js\/overview\.js/);
  }
  assert.equal((await get("/overview/../server.js")).status, 404);
});

test("POST /api/sync: recusa motor desconhecido antes de disparar o processo", async () => {
  const ruim = await post("/api/sync", { engines: ["claude", "wat"] });
  assert.equal(ruim.status, 400);
  assert.match((await ruim.json()).error, /Motor inválido/);

  const texto = await post("/api/sync", { engines: "gpt" });
  assert.equal(texto.status, 400);
});

test("POST /api/sync: roda tools/sync.js em streaming (log SSE + done) e recusa concorrência", async () => {
  // dry-run: nada é gravado; o teste só observa o log e o código de saída.
  const r1 = await post("/api/sync", { engines: ["claude"], dryRun: true });
  assert.equal(r1.status, 200);
  assert.match(r1.headers.get("content-type"), /text\/event-stream/);

  // Enquanto a primeira ainda roda, uma segunda é recusada (uma sincronização por vez).
  const r2 = await post("/api/sync", { engines: ["claude"] });
  assert.equal(r2.status, 409);
  assert.match((await r2.json()).error, /em andamento/);

  const evs = events(await r1.text());
  const done = evs.find((e) => e.type === "done");
  assert.ok(done, "termina com evento done");
  assert.equal(done.code, 0, "tools/sync.js saiu com 0");
  assert.ok(done.ms > 0);
  const log = evs.filter((e) => e.type === "log").map((e) => e.line).join("\n");
  assert.match(log, /Sincronizando claude/, "a linha de abertura do CLI chega ao navegador");
  assert.match(log, /alpha/, "o resumo por projeto aparece no log");

  // Depois de concluída, uma nova sincronização volta a ser aceita (livre o travo).
  const r3 = await post("/api/sync", { engines: ["gemini"], dryRun: true });
  assert.equal(r3.status, 200);
  const evs3 = events(await r3.text());
  assert.equal(evs3.find((e) => e.type === "done").code, 0);
  assert.match(evs3.filter((e) => e.type === "log").map((e) => e.line).join("\n"), /Sincronizando gemini/);
});

test("POST /api/sync sem projetos responde 400 (e não dispara o CLI)", async () => {
  // slugs() lê projects/ a cada chamada: dá para esvaziar a pasta na raiz temporária e restaurar em seguida.
  const names = fs.readdirSync(projects, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "_template").map((d) => d.name);
  assert.ok(names.length, "o fixture deveria ter projetos");
  const park = fs.mkdtempSync(path.join(os.tmpdir(), "harness-ov-park-"));
  try {
    for (const d of names) fs.renameSync(path.join(projects, d), path.join(park, d));
    const res = await post("/api/sync", {});
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /Nenhum projeto/);
  } finally {
    for (const d of names) fs.renameSync(path.join(park, d), path.join(projects, d));
    fs.rmSync(park, { recursive: true, force: true });
  }
});

// ---------- a página /overview em si: o JavaScript roda num DOM simulado, contra o servidor de verdade ----------
test("overview.html: a lista renderiza e o sync geral termina em 'concluído'", async () => {
  const vm = require("vm");
  const page = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "overview.html"), "utf8").replace(/\r\n/g, "\n");
  const jsDir = path.join(__dirname, "..", "ui", "public", "js");
  const script = fs.readFileSync(path.join(jsDir, "overview.js"), "utf8").replace(/\r\n/g, "\n");
  const syncScript = fs.readFileSync(path.join(jsDir, "overview-sync.js"), "utf8").replace(/\r\n/g, "\n");
  assert.ok(script.length > 2000 && syncScript.includes("runSyncAll"), "não achei o script da página");

  const els = new Map();
  const el = () => ({
    innerHTML: "", textContent: "", className: "", value: "", checked: false, disabled: false,
    scrollTop: 0, scrollHeight: 0, onclick: null, hidden: false,
    setAttribute() {},
  });
  const checkedEngines = [{ value: "claude" }]; // só o Claude, para o dry-run do teste ser rápido
  const sandbox = {
    $: (id) => { if (!els.has(id)) els.set(id, el()); return els.get(id); },
    document: {
      getElementById: (id) => sandbox.$(id),
      querySelectorAll: (sel) => (sel === ".eng:checked" ? checkedEngines : []),
      addEventListener() {},
      body: { classList: { add() {}, remove() {} } },
    },
    location: { search: "", pathname: "/overview" },
    history: { replaceState() {} },
    fetch: (p, init = {}) => fetch(base + p, { ...init, headers: { ...(init.headers || {}), Origin: base } }),
    URLSearchParams, TextDecoder, JSON, Number, String, Math, Array, Date, setTimeout, clearTimeout,
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(script, ctx);
  vm.runInContext(syncScript, ctx);

  // loadOverview() roda solto no fim do script: espera a tabela encher.
  const until = async (cond, ms = 5000) => { const end = Date.now() + ms; while (!cond() && Date.now() < end) await new Promise((r) => setTimeout(r, 20)); return cond(); };
  assert.ok(await until(() => sandbox.$("rows").innerHTML.includes("alpha")), "as linhas chegam");

  const rows = sandbox.$("rows").innerHTML;
  assert.match(rows, /alpha[\s\S]*beta/, "alpha primeiro (atividade mais recente)");
  assert.match(rows, /status-badge badge-active/, "o projeto ativo ganha o selo");
  const cards = sandbox.$("cards").innerHTML;
  for (const slug of ["alpha", "beta"]) {
    assert.ok(rows.includes(`data-slug="${slug}"`) && cards.includes(`data-slug="${slug}"`), `${slug} na tabela e nos cards`);
    assert.ok(rows.includes(`data-sync="${slug}"`) && cards.includes(`data-sync="${slug}"`), `${slug}: ação de sync nos dois layouts`);
  }
  assert.equal(sandbox.$("ovList").hidden, false, "a lista aparece quando há projetos");
  assert.ok(!/onclick=/.test(rows + cards), "sem handlers inline");
  assert.match(rows, /2 pendente/, "exposição das pendências de extração");
  assert.match(sandbox.$("pagerInfo").textContent, /Mostrando 1–2 de 2/);
  assert.match(sandbox.$("sub").innerHTML, /2 projetos no harness/);
  assert.equal(sandbox.$("btnPrev").disabled, true, "não há página anterior");
  assert.equal(sandbox.$("btnNext").disabled, true, "não há próxima");

  // Ação do sistema: dry-run do Claude, com o log SSE chegando linha a linha.
  sandbox.$("dryRun").checked = true;
  await vm.runInContext("runSyncAll()", ctx);
  const log = sandbox.$("log").innerHTML;
  assert.match(log, /Sincronizando claude/, "a abertura do CLI aparece no log da página");
  assert.match(sandbox.$("runState").textContent, /concluído/);
  assert.match(sandbox.$("runState").className, /ok/);
  assert.equal(sandbox.$("btnRun").disabled, false, "o botão volta a ficar disponível");
});
