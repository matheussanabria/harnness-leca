// @ts-check
// Testes do jira-query: leitura local do snapshot, busca e redacao de dados pessoais.
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");

const { redact, redactDeep, countRedactions } = require("../tools/lib/jira-redact");
const { searchIssues, findIssue, findSprint, sprintStories, parseSprintValue } = require("../tools/lib/jira-snapshot");
const { buildSummary, writeSummary, statusCounts } = require("../tools/lib/jira-summary");

// Contexto minimo: o script le um snapshot e um quadro local; aqui bastam objetos com a mesma forma.
const ctx = {
  slug: "exemplo",
  projectDir: "C:/tmp/exemplo",
  repoRoot: "C:/tmp/exemplo-repo",
  snapshotFile: "C:/tmp/exemplo-repo/doc/scrum/_jira-dis.json",
  snapshotAt: "2026-10-21T12:00:00.000Z",
  issues: new Map([
    ["DIS-1", {
      key: "DIS-1",
      title: "Saldo terapêutico nas entregas",
      type: "História",
      status: { id: "1", name: "A Fazer", category: "new" },
      epic: "DIS-9",
      assignee: "Fulano",
      creator: "Beltrano",
      priority: "Baixa",
      description: "Regra de saldo",
      created: "2026-01-01T00:00:00.000Z",
      updated: "2026-10-01T00:00:00.000Z",
      links: [{ direction: "outward", relation: "is blocked by", key: "DIS-2", title: "Depende", status: "SELECIONADO" }],
      comments: [{ author: "Leonel", created: "2026-02-02T00:00:00.000Z", body: "Ver CPF 46957448053 do paciente" }],
    }],
    ["DIS-2", {
      key: "DIS-2",
      title: "Cadastro de e-mail",
      type: "História",
      status: { id: "2", name: "Concluído", category: "done" },
      epic: null, assignee: null, creator: null, priority: null, description: "",
      created: null, updated: null, links: [],
      comments: [{ author: "X", created: null, body: "chame 51 3289-2770 ou fulano@exemplo.rs.gov.br" }],
    }],
  ]),
  board: {
    activeSprintId: "sprint-1",
    sprints: [{ id: "sprint-1", name: "Sprint 3", goal: "", startDate: "2026-10-21", endDate: "2026-11-04", status: "active" }],
    lanes: [{ id: "em-desenvolvimento", name: "Em desenvolvimento" }, { id: "pronto-para-dev", name: "Pronto para desenvolvimento" }],
    stories: [
      { id: "dis-1", key: "DIS-1", title: "Saldo terapêutico nas entregas", laneId: "pronto-para-dev", sprintId: "sprint-1", points: 2, status: "todo" },
      { id: "dis-2", key: "DIS-2", title: "Cadastro de e-mail", laneId: "em-desenvolvimento", sprintId: null, points: 1, status: "in_progress" },
    ],
  },
};

test("redact remove CPF, e-mail e telefone", () => {
  const out = redact("Ver CPF 469.574.480-53, e-mail a.b@exemplo.rs.gov.br, tel 51 3289-2770");
  assert.ok(!out.includes("46957448053"));
  assert.ok(!out.includes("469.574.480-53"));
  assert.ok(!out.includes("a.b@exemplo.rs.gov.br"));
  assert.ok(!out.includes("3289-2770"));
  assert.ok(out.includes("[CPF]"));
  assert.ok(out.includes("[e-mail]"));
  assert.ok(out.includes("[telefone]"));
});

test("redact com raw devolve o texto intacto", () => {
  const raw = "Ver CPF 46957448053";
  assert.equal(redact(raw, { raw: true }), raw);
  assert.equal(countRedactions(raw), 1);
});

test("redactDeep percorre objetos e listas", () => {
  const out = redactDeep({ a: ["CPF 46957448053"], b: { c: "x" } });
  assert.ok(!out.a[0].includes("46957448053"));
  assert.equal(out.b.c, "x");
});

test("findIssue acha pela chave, sem diferenciar caixa", () => {
  assert.equal(findIssue(ctx, "dis-1").title, "Saldo terapêutico nas entregas");
  assert.equal(findIssue(ctx, "DIS-404"), null);
});

test("searchIssues ignora acento e acha em título, descrição e comentário", () => {
  assert.equal(searchIssues(ctx, "saldo terapeutico")[0].issue.key, "DIS-1");
  assert.equal(searchIssues(ctx, "REGRA DE SALDO")[0].where, "descricao");
  assert.equal(searchIssues(ctx, "cpf")[0].where, "comentario");
});

test("searchIssues respeita o limite", () => {
  assert.equal(searchIssues(ctx, "e-mail", { limit: 1 }).length, 1);
});

test("findSprint aceita id, nome exato e nome parcial", () => {
  assert.equal(findSprint(ctx, "sprint-1").name, "Sprint 3");
  assert.equal(findSprint(ctx, "Sprint 3").id, "sprint-1");
  assert.equal(findSprint(ctx, "sprint").id, "sprint-1");
  assert.equal(findSprint(ctx, "inexistente"), null);
});

test("sprintStories devolve só as histórias alocadas na sprint", () => {
  const sprint = findSprint(ctx, "Sprint 3");
  const stories = sprintStories(ctx, sprint);
  assert.equal(stories.length, 1);
  assert.equal(stories[0].key, "DIS-1");
});

test("statusCounts conta status do Jira e raias do quadro local", () => {
  const { byJira, byLane } = statusCounts(ctx);
  assert.equal(byJira.get("A Fazer"), 1);
  assert.equal(byJira.get("Concluído"), 1);
  assert.equal(byLane.get("Pronto para desenvolvimento"), 1);
});

test("buildSummary gera o panorama sem comentários nem dados pessoais", () => {
  const md = buildSummary(ctx);
  assert.ok(md.includes("# Panorama do Jira"));
  assert.ok(md.includes("Sprint 3"));
  assert.ok(md.includes("DIS-1"));
  assert.ok(md.includes("A Fazer"));
  assert.ok(!md.includes("CPF"));
  assert.ok(!md.includes("46957448053"));
  assert.ok(!md.includes("Ver CPF"));
});

test("buildSummary não deixa o caminho absoluto do repositório vazar", () => {
  const md = buildSummary(ctx);
  assert.ok(!md.includes("C:/tmp/exemplo-repo"));
  assert.ok(md.includes("doc/scrum/_jira-dis.json"));
});

test("o script não depende de rede nem de token: nada de URL ou Authorization", () => {
  const source = require("node:fs").readFileSync(path.join(__dirname, "..", "tools", "jira-query.js"), "utf8");
  assert.ok(!/https?:\/\//.test(source.replace(/jira-query\.js/g, "")));
  assert.ok(!/Authorization/i.test(source));
  assert.ok(!/process\.env\.[A-Z_]*TOKEN/i.test(source));
});

test("writeSummary grava o panorama no destino informado", () => {
  const fs = require("node:fs");
  const os = require("node:os");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-jira-resumo-"));
  const target = path.join(dir, "context", "jira-resumo.md");
  writeSummary(ctx, target);
  const md = fs.readFileSync(target, "utf8");
  assert.ok(md.includes("# Panorama do Jira — exemplo"));
  assert.ok(md.includes("DIS-1"));
  assert.ok(!md.includes("46957448053"));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("parseSprintValue entende o formato antigo (Server) e o objeto (Cloud)", () => {
  const legacy = "com.atlassian.greenhopper.service.sprint.Sprint@44c0119c[id=556,name=Sprint 41,state=ACTIVE,startDate=2026-10-13T14:14:00.000-03:00,endDate=2026-10-29T14:14:00.000-03:00,goal=<null>]";
  const server = parseSprintValue(legacy);
  assert.equal(server.jiraId, "556");
  assert.equal(server.name, "Sprint 41");
  assert.equal(server.state, "active");
  const cloud = parseSprintValue({ id: 77, name: "Sprint 42", state: "future", startDate: "2026-11-01", endDate: "2026-11-15" });
  assert.equal(cloud.jiraId, "77");
  assert.equal(cloud.state, "future");
  assert.equal(parseSprintValue({ name: "sem id" }), null);
  assert.equal(parseSprintValue("texto qualquer"), null);
});
