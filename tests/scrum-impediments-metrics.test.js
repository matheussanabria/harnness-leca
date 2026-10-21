// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { getCanonicalLanes } = require("../ui/server/services/project-scrum-lanes");
const { setStoryImpediment } = require("../ui/server/services/project-scrum-ops");
const { loadProjectScrum } = require("../ui/server/services/project-scrum.service");

const ROOT = path.resolve(".");
const FILTERS_PATH = path.join(ROOT, "ui", "public", "js", "modules", "design-scrum-filters.js");
const METRICS_PATH = path.join(ROOT, "ui", "public", "js", "modules", "design-scrum-metrics.js");
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u;

function scrumData(stories) {
  return {
    schemaVersion: 2,
    migrationHistory: [],
    activeSprintId: "sprint-1",
    sprints: [{ id: "sprint-1", name: "Sprint 1" }],
    epics: [],
    stories,
    lanes: getCanonicalLanes(),
    lanesRevision: 0,
    transitionHistory: [],
    impedimentHistory: [],
  };
}

function story(id, overrides = {}) {
  return {
    id,
    key: id.toUpperCase(),
    title: `Historia ${id}`,
    sprintId: "sprint-1",
    status: "in_progress",
    laneId: "em-desenvolvimento",
    points: 3,
    assignee: "ana",
    origin: "local",
    ...overrides,
  };
}

function withProject(data, run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "scrum-impediments-"));
  const project = path.join(root, "project");
  fs.mkdirSync(project, { recursive: true });
  const file = path.join(project, "scrum.json");
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  try { return run({ root, project, file }); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test("EP-05.05: impedimentos, filtros e metricas", async (t) => {
  await t.test("ativar impedimento sem motivo falha sem alterar o arquivo", () => withProject(scrumData([story("us-1")]), ({ project, file }) => {
    const original = fs.readFileSync(file, "utf8");
    assert.throws(
      () => setStoryImpediment("test", project, project, "us-1", true, "   "),
      /motivo do impedimento/
    );
    assert.equal(fs.readFileSync(file, "utf8"), original);
  }));

  await t.test("ativar e resolver persistem estado e historico", () => withProject(scrumData([story("us-1")]), ({ project, file }) => {
    setStoryImpediment("test", project, project, "us-1", true, "Aguardando acesso ao sistema", "2026-10-20T10:00:00.000Z");
    let stored = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(stored.stories[0].impediment.active, true);
    assert.equal(stored.stories[0].impediment.reason, "Aguardando acesso ao sistema");
    assert.equal(stored.stories[0].impediment.since, "2026-10-20T10:00:00.000Z");
    assert.equal(stored.impedimentHistory.length, 1);
    assert.equal(stored.impedimentHistory[0].active, true);
    assert.equal(stored.impedimentHistory[0].storyKey, "US-1");

    setStoryImpediment("test", project, project, "us-1", false, "", "2026-10-20T11:00:00.000Z");
    stored = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(stored.stories[0].impediment, null);
    assert.equal(stored.impedimentHistory.length, 2);
    assert.equal(stored.impedimentHistory[1].active, false);
    assert.equal(stored.impedimentHistory[1].reason, "Aguardando acesso ao sistema");
  }));

  await t.test("mesmo estado nao duplica historico", () => withProject(scrumData([story("us-1")]), ({ project, file }) => {
    setStoryImpediment("test", project, project, "us-1", true, "Bloqueio", "2026-10-20T10:00:00.000Z");
    setStoryImpediment("test", project, project, "us-1", true, "Bloqueio", "2026-10-20T10:05:00.000Z");
    const stored = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(stored.impedimentHistory.length, 1);
  }));

  await t.test("resumo compoe bloqueios e taxa de impedimento", () => withProject(scrumData([
    story("us-1", { impediment: { active: true, reason: "Sem acesso", since: "2026-10-20T10:00:00.000Z" } }),
    story("us-2", { assignee: "bruno", points: 5 }),
  ]), ({ root, project }) => {
    const result = loadProjectScrum("test", project, root);
    assert.equal(result.scrum.summary.blockedStoriesCount, 1);
    assert.equal(result.scrum.summary.blockedPointsTotal, 3);
    assert.equal(result.scrum.summary.impedimentRate, 50);
    assert.equal(result.scrum.stories[0].impediment.active, true);
  }));

  await t.test("filtros combinam texto normalizado, responsavel e impedimento", async () => {
    const { storyMatchesFilters, applyStoryFilters, listStoryAssignees } = await import(pathToFileURL(FILTERS_PATH).href);
    const stories = [
      story("us-1", { title: "Ajustar autorização", impediment: { active: true, reason: "Acesso" } }),
      story("us-2", { title: "Revisar prescricao", assignee: "bruno" }),
    ];
    assert.equal(storyMatchesFilters(stories[0], { query: "autorizacao" }), true);
    assert.equal(storyMatchesFilters(stories[1], { query: "autorizacao" }), false);
    assert.equal(storyMatchesFilters(stories[0], { assignee: "bruno" }), false);
    assert.equal(storyMatchesFilters(stories[1], { assignee: "bruno" }), true);
    assert.deepEqual(applyStoryFilters(stories, { onlyImpediments: true }).map((item) => item.id), ["us-1"]);
    assert.deepEqual(listStoryAssignees(stories), ["ana", "bruno"]);
  });

  await t.test("metricas somam pontos, conclusao e bloqueios por raia", async () => {
    const { computeStoryMetrics, renderScrumMetricsBar } = await import(pathToFileURL(METRICS_PATH).href);
    const lanes = getCanonicalLanes();
    const stories = [
      story("us-1", { status: "done", points: 5 }),
      story("us-2", { status: "todo", laneId: "pronto-para-dev", points: 2, impediment: { active: true, reason: "Acesso" } }),
      story("us-3", { points: 3 }),
    ];
    const metrics = computeStoryMetrics(stories, lanes);
    assert.equal(metrics.totalStories, 3);
    assert.equal(metrics.totalPoints, 10);
    assert.equal(metrics.doneStories, 1);
    assert.equal(metrics.blockedStories, 1);
    assert.equal(metrics.blockedPoints, 2);
    assert.equal(metrics.byLane["em-desenvolvimento"].stories, 2);
    assert.equal(metrics.byLane["pronto-para-dev"].blocked, 1);
    const html = renderScrumMetricsBar(metrics);
    assert.ok(html.includes("Impedidas"));
    assert.ok(html.includes("1 · 2 pts"));
  });

  await t.test("UI conecta barra, cartao, drawer e CSS sem emojis", () => {
    const files = {
      view: path.join(ROOT, "ui", "public", "js", "modules", "design-scrum-view.js"),
      card: path.join(ROOT, "ui", "public", "js", "modules", "design-scrum-story-card.js"),
      drawer: path.join(ROOT, "ui", "public", "js", "modules", "design-scrum-story-drawer.js"),
      css: path.join(ROOT, "ui", "public", "css", "design", "13-scrum-filters-metrics.css"),
      cssIndex: path.join(ROOT, "ui", "public", "css", "design.css"),
    };
    for (const [name, file] of Object.entries(files)) {
      assert.ok(fs.existsSync(file), `${name} ausente`);
      const content = fs.readFileSync(file, "utf8");
      assert.ok(content.split("\n").length <= 300, `${name} passou de 300 linhas`);
      assert.equal(EMOJI_REGEX.test(content), false, `${name} contem emojis`);
    }
    assert.ok(fs.readFileSync(files.view, "utf8").includes("scrumFiltersBar"));
    assert.ok(fs.readFileSync(files.card, "utf8").includes("toggleStoryImpedimentById"));
    assert.ok(fs.readFileSync(files.drawer, "utf8").includes("Impedimento"));
    assert.ok(fs.readFileSync(files.cssIndex, "utf8").includes("13-scrum-filters-metrics.css"));
  });
});
