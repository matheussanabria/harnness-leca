// Lógica do diálogo de revisão de memória (ui/public/index.html), sem navegador: o trecho de JavaScript é extraído da
// página, roda num contexto isolado com um DOM mínimo simulado e fala com o servidor de verdade (em memória).
// Cobre filtros, paginação, ações, escape de HTML e o fluxo com o servidor; NÃO cobre layout nem CSS.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-uirev-"));
process.env.HARNESS_ROOT = TMP_ROOT;
const proj = path.join(TMP_ROOT, "projects", "demo");
fs.mkdirSync(path.join(proj, "context"), { recursive: true });
fs.mkdirSync(path.join(proj, "chats"), { recursive: true });
fs.mkdirSync(path.join(TMP_ROOT, "projects", "_template"), { recursive: true });
fs.writeFileSync(path.join(proj, "memory.md"), "# Memória do projeto\n\n- [2026-10-01] Fato antigo.\n");
test.after(() => fs.rmSync(TMP_ROOT, { recursive: true, force: true }));

// 30 memórias (uma com HTML), 6 regras, 4 decisões, 2 termos.
const make = (head, prefix, n) => `## ${head}\n` + Array.from({ length: n }, (_, i) => `- ${prefix} ${i + 1}${prefix === "Memória" && i === 0 ? ' <img src=x onerror="alert(1)"> & "aspas"' : ""}.`).join("\n") + "\n\n";
fs.writeFileSync(path.join(proj, "context", "extraido-memorias.md"),
  "<!-- sessao: s1 | 2026-10-15 -->\n## Conversa de teste (2026-10-15)\n\n" +
  make("Memórias", "Memória", 30) + make("Regras e preferências", "Regra", 6) + make("Decisões", "Decisão", 4) + make("Termos do domínio", "Termo", 2));

const { createServer } = require("../ui/server");
const html = fs.readFileSync(path.join(__dirname, "..", "ui", "public", "index.html"), "utf8").replace(/\r\n/g, "\n");

let server, base, ctx;
const el = () => ({ innerHTML: "", textContent: "", value: "", dataset: {}, onclick: null, oninput: null, focus() {}, setSelectionRange() {} });

test.before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;

  // O trecho de revisão e a função esc() vêm da própria página.
  const block = html.slice(html.indexOf("// ---------- revisão das sugestões de memória ----------"), html.indexOf("const showMem = () =>"));
  const escDef = html.match(/^const esc = .*$/m);
  assert.ok(block.length > 500 && escDef, "não achei o trecho de revisão / esc() em index.html");

  const elements = new Map();
  const sandbox = {
    $: (id) => { if (!elements.has(id)) elements.set(id, el()); return elements.get(id); },
    openDlg: () => { for (const id of ["rv", "rv-list", "rv-msg", "dbody"]) sandbox.$(id); },
    P: { slug: "demo", review: { pendentes: 0 } },
    load: async () => { sandbox.loaded = (sandbox.loaded || 0) + 1; },
    fetch: (p, init = {}) => fetch(base + p, { ...init, headers: { ...(init.headers || {}), Origin: base } }),
    URL, JSON, Math, Set, Promise,
  };
  ctx = vm.createContext(sandbox);
  vm.runInContext(escDef[0] + "\n" + block, ctx);
});
test.after(() => { server.closeAllConnections(); server.close(); });

const run = (code) => vm.runInContext(code, ctx);
const $ = (id) => ctx.$(id);
// Simula o clique num botão: o evento só precisa de target.closest(), como o do navegador.
const click = (act, { id, cat } = {}) => {
  const btn = { dataset: { act, cat }, closest: (sel) => (sel === ".rv-item" && id ? { dataset: { id } } : null) };
  return ctx.reviewClick({ target: { closest: (sel) => (sel === "[data-act]" ? btn : null) } });
};
const items = () => run("R.items");
const itemCount = () => ($("rv-list").innerHTML.match(/<div class="rv-item"/g) || []).length;

test("showReview carrega as sugestões, mostra a 1ª página e avisa o tamanho da memória", async () => {
  await ctx.showReview();
  assert.equal(items().length, 42);
  assert.equal(itemCount(), 25, "25 por página");
  assert.match($("rv").innerHTML, /memory\.md atual: 0\.\d KB/);
  assert.match($("rv").innerHTML, /Todas \(42\)/);
  assert.match($("rv").innerHTML, /Memórias \(30\)/);
  assert.match($("rv").innerHTML, /Decisões \(4\)/);
  assert.match($("rv-list").innerHTML, /1–25 de 42/);
  assert.equal(typeof $("dbody").onclick, "function", "cliques do diálogo tratados");
});

test("o texto das sugestões é escapado: HTML vindo de uma conversa não vira marcação", () => {
  const out = $("rv-list").innerHTML;
  assert.ok(!out.includes("<img"), "sem <img> cru");
  assert.match(out, /&lt;img src=x onerror=/);
  assert.ok(out.includes("&amp;") && out.includes("&quot;aspas&quot;") || out.includes("&amp; ") , "& e aspas escapados");
});

test("filtro por categoria, busca e paginação", () => {
  click("cat", { cat: "regra" });
  assert.equal(itemCount(), 6);
  assert.match($("rv-list").innerHTML, /1–6 de 6/);

  click("cat", { cat: "todas" });
  click("pag-prox");
  assert.equal(itemCount(), 17, "segunda página: 42 - 25");
  assert.match($("rv-list").innerHTML, /26–42 de 42/);

  run("R.page = 0");
  ctx.reviewInput({ target: { id: "rv-q", value: "termo 2" } });
  assert.equal(itemCount(), 1);
  assert.match($("rv-list").innerHTML, /Termo 2/);
  assert.equal(run("R.page"), 0, "a busca volta para a primeira página");

  ctx.reviewInput({ target: { id: "rv-q", value: "nada disso existe" } });
  assert.match($("rv-list").innerHTML, /Tudo revisado por aqui/);
  ctx.reviewInput({ target: { id: "outro-campo", value: "ignorado" } });
  assert.equal(run("R.q"), "nada disso existe", "só o campo de busca é tratado");
  ctx.reviewInput({ target: { id: "rv-q", value: "" } });
});

test("promover grava na memory.md pelo servidor e tira a sugestão da lista", async () => {
  const alvo = items().find((i) => i.texto.startsWith("Regra 1"));
  await click("promover", { id: alvo.id });
  assert.equal(items().length, 41);
  assert.ok(!items().some((i) => i.id === alvo.id));
  assert.match($("rv-msg").textContent, /1 promovida/);
  assert.match(fs.readFileSync(path.join(proj, "memory.md"), "utf8"), /^- \[\d{4}-\d{2}-\d{2}\] Regra: Regra 1\.$/m);
  assert.equal(run("P.review.pendentes"), 41, "contador do cartão atualizado");
  assert.ok(ctx.loaded >= 1, "o cartão de Memória é recarregado");
});

test("editar antes de promover grava o texto editado", async () => {
  const alvo = items().find((i) => i.texto.startsWith("Decisão 1"));
  click("cat", { cat: "decisao" }); // a decisão está na 2ª página da lista geral: filtra para ela aparecer
  await click("editar", { id: alvo.id });
  assert.equal(run("R.editing"), alvo.id);
  assert.match($("rv-list").innerHTML, /<textarea class="rv-edit" id="rv-edit">Decisão 1\./);
  $("rv-edit").value = "Decisão 1, ajustada pelo usuário.";
  await click("salvar", { id: alvo.id });
  assert.equal(run("R.editing"), null);
  assert.match(fs.readFileSync(path.join(proj, "memory.md"), "utf8"), /^- \[\d{4}-\d{2}-\d{2}\] Decisão: Decisão 1, ajustada pelo usuário\.$/m);
  click("cat", { cat: "todas" });
});

test("descartar um item e descartar a página inteira (com confirmação)", async () => {
  const alvo = items().find((i) => i.texto.startsWith("Termo 1"));
  await click("descartar", { id: alvo.id });
  assert.ok(!items().some((i) => i.id === alvo.id));
  assert.ok(!fs.readFileSync(path.join(proj, "memory.md"), "utf8").includes("Termo 1"), "descartar não grava na memória");

  const antes = items().length; // 39
  click("descartar-pagina");
  assert.match($("rv-list").innerHTML, /Confirmar: descartar estas 25/);
  assert.equal(items().length, antes, "sem confirmar, nada acontece");
  click("descartar-pagina-cancel");
  assert.match($("rv-list").innerHTML, /Descartar todas desta página/);

  click("descartar-pagina");
  await click("descartar-pagina-ok");
  assert.equal(items().length, antes - 25);
  assert.match($("rv-msg").textContent, /25 descartada/);
  assert.equal(itemCount(), antes - 25 > 25 ? 25 : antes - 25);
});

test("o que foi descartado não volta ao recarregar, e erros do servidor aparecem sem quebrar", async () => {
  await ctx.showReview();
  const restantes = items().length;
  assert.equal(restantes, 42 - 1 - 1 - 1 - 25, "promovidas + descartadas + página descartada saíram");

  // Ação sobre um id que não está mais pendente: o servidor ignora e a tela avisa.
  const fantasma = { id: "naoexiste000", acao: "promover" };
  await ctx.reviewApply([fantasma]);
  assert.match($("rv-msg").textContent, /já não estava/);
  assert.equal(items().length, restantes);

  // Servidor devolvendo erro: mensagem na tela, estado intacto, botão liberado.
  run("fetch = () => Promise.resolve({ ok: false, json: async () => ({ error: 'deu ruim' }) })");
  await ctx.reviewApply([{ id: items()[0].id, acao: "descartar" }]);
  assert.match($("rv-msg").textContent, /⚠ deu ruim/);
  assert.equal(items().length, restantes);
  assert.equal(run("R.busy"), false);
});
