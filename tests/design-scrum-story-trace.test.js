// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");
const mod = (name) => import(pathToFileURL(path.join(root, "ui/public/js/modules", name)).href);
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const DOR_OK = {
  ready: true, requiredFailed: [], advisoryFailed: [], humanReview: true,
  checks: [{ id: "title", severity: "required", ok: true, detail: "ok" }],
};
const DOR_FAIL = {
  ready: false, requiredFailed: ["criteria-present"], advisoryFailed: ["epic"], humanReview: true,
  checks: [
    { id: "criteria-present", severity: "required", ok: false, detail: "Nenhum criterio de aceite" },
    { id: "epic", severity: "advisory", ok: false, detail: "Sem epico" },
  ],
};

test("maturidade: valor desconhecido ou ausente cai em pronta e nunca vira markup", async () => {
  const { maturityHtml } = await mod("design-scrum-story-trace-view.js");
  assert.match(maturityHtml("draft"), /is-draft/);
  assert.match(maturityHtml("refining"), /Em refinamento/);
  assert.match(maturityHtml(undefined), /is-ready/);
  const hostile = maturityHtml('"><script>alert(1)</script>');
  assert.doesNotMatch(hostile, /<script/);
  assert.match(hostile, /is-ready/);
});

test("DoR: lista obrigatorios e recomendados, detalhe so quando falha, aviso de revisao humana", async () => {
  const { dorHtml } = await mod("design-scrum-story-trace-view.js");
  const failed = dorHtml(DOR_FAIL);
  assert.match(failed, /Faltam itens obrigatorios: criteria-present/);
  assert.match(failed, /data-check="criteria-present"/);
  assert.match(failed, /obrigatorio/);
  assert.match(failed, /recomendado/);
  assert.match(failed, /Nenhum criterio de aceite/);
  assert.match(failed, /revisao humana/);
  const ok = dorHtml(DOR_OK);
  assert.match(ok, /Itens obrigatorios atendidos/);
  assert.doesNotMatch(ok, /<em>/);
  assert.match(dorHtml(null), /indisponivel/);
});

test("commits: lista, vazio, indisponivel e SHA nao verificado destacado", async () => {
  const { commitsHtml } = await mod("design-scrum-story-trace-view.js");
  const commit = (verified) => ({
    sha: "a".repeat(40), shortSha: "aaaaaaa", subject: "feat: <b>x</b>", authorName: "t", committedAt: "2026-11-01", verified,
  });
  const listed = commitsHtml({ available: true, commits: [commit(true)] });
  assert.match(listed, /aaaaaaa/);
  assert.doesNotMatch(listed, /<b>x<\/b>/, "o assunto do commit e escapado");
  assert.doesNotMatch(listed, /story-commit-unverified/);
  assert.match(commitsHtml({ available: true, commits: [commit(false)] }), /story-commit-unverified/);
  assert.match(commitsHtml({ available: true, commits: [] }), /data-trace="commits-empty"/);
  const down = commitsHtml({ available: false, reason: "git-unavailable", commits: [] });
  assert.match(down, /commits-unavailable/);
  assert.match(down, /git-unavailable/);
});

function fakeRoot() {
  const body = { innerHTML: "" };
  return { body, root: { querySelector: (selector) => (selector === "#storyTraceBody" ? body : null) } };
}

function fakeState(name) {
  return import(pathToFileURL(path.join(root, "ui/public/js/shared/state.js")).href).then((m) => {
    m.state.P = { name };
    return m.state;
  });
}

const json = (status, data) => ({ ok: status < 400, status, json: async () => data });

test("carregador: chama as duas rotas da historia com slug e id codificados e preenche o corpo", async () => {
  await fakeState("meu projeto");
  const { loadStoryTrace } = await mod("design-scrum-story-trace.js");
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(url);
    return url.endsWith("/dor")
      ? json(200, { ok: true, maturity: "draft", dor: DOR_FAIL })
      : json(200, { ok: true, available: true, commits: [] });
  };
  const { root: panel, body } = fakeRoot();
  await loadStoryTrace(panel, { id: "S 1/x" });
  assert.deepEqual(urls.sort(), [
    "/api/project/meu%20projeto/scrum/story/S%201%2Fx/commits",
    "/api/project/meu%20projeto/scrum/story/S%201%2Fx/dor",
  ]);
  assert.match(body.innerHTML, /is-draft/);
  assert.match(body.innerHTML, /Faltam itens obrigatorios/);
});

test("carregador: erro de rota vira mensagem escapada, sem lancar", async () => {
  await fakeState("p");
  const { loadStoryTrace } = await mod("design-scrum-story-trace.js");
  globalThis.fetch = async () => json(500, { error: "<img src=x onerror=1>" });
  const { root: panel, body } = fakeRoot();
  await loadStoryTrace(panel, { id: "S1" });
  assert.match(body.innerHTML, /Nao foi possivel carregar/);
  assert.doesNotMatch(body.innerHTML, /<img/);
});

test("carregador: resposta de uma historia antiga nao sobrescreve a atual", async () => {
  await fakeState("p");
  const { loadStoryTrace } = await mod("design-scrum-story-trace.js");
  /** @type {Array<() => void>} */
  const releases = [];
  globalThis.fetch = (url) => new Promise((resolve) => {
    const story = url.includes("/story/OLD/") ? "OLD" : "NEW";
    releases.push(() => resolve(url.endsWith("/dor")
      ? json(200, { ok: true, maturity: story === "OLD" ? "draft" : "refining", dor: DOR_OK })
      : json(200, { ok: true, available: true, commits: [] })));
  });
  const { root: panel, body } = fakeRoot();
  const first = loadStoryTrace(panel, { id: "OLD" });
  const second = loadStoryTrace(panel, { id: "NEW" });
  releases.reverse().forEach((release) => release());
  await Promise.all([first, second]);
  assert.match(body.innerHTML, /Em refinamento/, "vale a ultima historia aberta");
  assert.doesNotMatch(body.innerHTML, /is-draft/);
});

test("carregador: sem o corpo da secao no painel nao faz requisicao", async () => {
  const { loadStoryTrace } = await mod("design-scrum-story-trace.js");
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return json(200, {}); };
  await loadStoryTrace({ querySelector: () => null }, { id: "S1" });
  assert.equal(calls, 0);
});

test("drawer liga a secao e o CSS esta importado", () => {
  const drawer = read("ui/public/js/modules/design-scrum-story-drawer.js");
  assert.match(drawer, /traceSectionPlaceholder\(\)/);
  assert.match(drawer, /void loadStoryTrace\(drawer, story\)/);
  assert.match(read("ui/public/css/design.css"), /32-scrum-story-trace\.css/);
  assert.doesNotMatch(read("ui/public/js/modules/design-scrum-story-trace-view.js"), /[\u{1F300}-\u{1FAFF}]/u, "sem emojis");
});
