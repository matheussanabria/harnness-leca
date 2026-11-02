// @ts-check
// Captura de demanda como rascunho: idempotencia por dedupeKey, sugestoes de duplicatas e defesa contra mass assignment.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { createServer } = require("../ui/server");
const { getCanonicalLanes } = require("../ui/server/services/project-scrum-lanes");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "scrum-capture-http-"));
const projects = path.join(root, "projects");
process.env.HARNESS_PROJECTS_DIR = projects;
test.after(() => fs.rmSync(root, { recursive: true, force: true }));

const SLUG = "cap";
const storePath = () => path.join(projects, SLUG, "scrum.json");
const readStore = () => JSON.parse(fs.readFileSync(storePath(), "utf8"));
const readRaw = () => fs.readFileSync(storePath(), "utf8");
const writeRaw = (text) => fs.writeFileSync(storePath(), text, "utf8");

function writeProject(slug, stories) {
  const dir = path.join(projects, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "scrum.json"), JSON.stringify({
    schemaVersion: 2, migrationHistory: [], activeSprintId: "sprint-1", sprints: [{ id: "sprint-1", name: "Sprint 1" }],
    epics: [], stories, lanes: getCanonicalLanes(), lanesRevision: 0, transitionHistory: [],
  }), "utf8");
}

writeProject(SLUG, [
  { id: "US-1", key: "US-1", title: "Exportar relatorio mensal em CSV", sprintId: "sprint-1", status: "todo", laneId: "pronto-para-dev", origin: "local" },
  { id: "US-2", key: "US-2", title: "Listar pedidos de compras", sprintId: "sprint-1", status: "todo", laneId: "pronto-para-dev", origin: "local" },
]);
const originalUS1 = readStore().stories.find((story) => story.id === "US-1");

async function request(method, url, body) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    return await new Promise((resolve, reject) => {
      const payload = body === undefined ? null : JSON.stringify(body);
      const port = server.address().port;
      const req = http.request({
        host: "127.0.0.1", port, path: url, method,
        headers: payload === null ? {} : { "content-type": "application/json", origin: `http://127.0.0.1:${port}` },
      }, (res) => {
        let text = "";
        res.on("data", (chunk) => (text += chunk));
        res.on("end", () => resolve({ status: res.statusCode, text, json: (() => { try { return JSON.parse(text); } catch { return null; } })() }));
      });
      req.on("error", reject);
      req.end(payload);
    });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

const capture = (slug, body) => request("POST", `/api/project/${slug}/scrum/story/capture`, body);
const duplicates = (slug, title) => request("GET", `/api/project/${slug}/scrum/duplicates` + (title === undefined ? "" : `?title=${encodeURIComponent(title)}`));

test("capture: creates a draft story and persists it in scrum.json", async () => {
  const res = await capture(SLUG, { title: "Capturar pedido do chat" });
  assert.equal(res.status, 201);
  assert.equal(res.json.ok, true);
  assert.equal(res.json.duplicated, false);
  assert.equal(res.json.story.maturity, "draft");
  assert.equal(res.json.story.sprintId, null);
  assert.ok(Array.isArray(res.json.candidates));
  const store = readStore();
  assert.ok(store.stories.some((story) => story.title === "Capturar pedido do chat"));
});

test("capture: mass assignment in body cannot change maturity, sprint, status, id or revision", async () => {
  const res = await capture(SLUG, {
    title: "Historia infiltrada", maturity: "ready", sprintId: "sprint-1", status: "done", id: "US-1", storyRevision: 99,
  });
  assert.equal(res.status, 201);
  assert.equal(res.json.story.maturity, "draft");
  assert.equal(res.json.story.sprintId, null);
  assert.equal(res.json.story.status, "todo");
  assert.notEqual(res.json.story.id, "US-1");
  assert.notEqual(res.json.story.storyRevision, 99);
  assert.equal(res.json.story.storyRevision, undefined);
  const persisted = readStore().stories.find((story) => story.id === "US-1");
  assert.deepEqual(persisted, originalUS1);
});

test("capture: same dedupeKey returns the same story and leaves the file untouched", async () => {
  const before = readRaw();
  const first = await capture(SLUG, { title: "Corrigir cupom fiscal", dedupeKey: "intake:chat-42" });
  assert.equal(first.status, 201);
  const afterFirst = readRaw();
  const second = await capture(SLUG, { title: "Corrigir cupom fiscal", dedupeKey: "intake:chat-42" });
  assert.equal(second.status, 200);
  assert.equal(second.json.duplicated, true);
  assert.deepEqual(second.json.candidates, []);
  assert.equal(second.json.story.id, first.json.story.id);
  const store = JSON.parse(afterFirst);
  assert.equal(store.stories.filter((story) => story.dedupeKey === "intake:chat-42").length, 1);
  assert.equal(readRaw(), afterFirst);
  assert.notEqual(readRaw(), before);
});

test("capture: near-duplicate title yields a candidate but never blocks the creation", async () => {
  const before = JSON.parse(readRaw());
  assert.equal(before.stories.some((story) => story.id === "US-1"), true);
  const res = await capture(SLUG, { title: "Exportar o relatório mensal CSV" });
  assert.equal(res.status, 201);
  assert.equal(res.json.duplicated, false);
  const candidate = res.json.candidates.find((item) => item.id === "US-1");
  assert.ok(candidate);
  assert.equal(candidate.title, "Exportar relatorio mensal em CSV");
  const after = JSON.parse(readRaw());
  assert.equal(after.stories.some((story) => story.id === "US-1"), true);
  assert.equal(after.stories.some((story) => story.title === "Exportar o relatório mensal CSV"), true);
});

test("capture: colliding key is dropped and the existing US-1 keeps its title", async () => {
  const res = await capture(SLUG, { title: "Other thing", key: "US-1" });
  assert.equal(res.status, 201);
  const persisted = readStore();
  const existing = persisted.stories.find((story) => story.id === "US-1");
  assert.equal(existing.title, "Exportar relatorio mensal em CSV");
  assert.ok(persisted.stories.some((story) => story.title === "Other thing" && story.id !== "US-1"));
  const candidate = res.json.candidates.find((item) => item.reason === "key");
  assert.ok(candidate);
});

test("capture: invalid title or dedupeKey answers 400 and writes nothing", async () => {
  const before = readRaw();
  const cases = [
    {},
    { title: "   " },
    { title: 123 },
    { title: "Dedupe com espaco", dedupeKey: "bad key" },
    { title: "Dedupe longo demais", dedupeKey: "a".repeat(81) },
  ];
  for (const body of cases) {
    const res = await capture(SLUG, body);
    assert.equal(res.status, 400);
    assert.equal(typeof res.json.error, "string");
  }
  assert.equal(readRaw(), before);
});

test("capture: title longer than the maximum answers 400 and writes nothing", async () => {
  const before = readRaw();
  const res = await capture(SLUG, { title: "x".repeat(201) });
  assert.equal(res.status, 400);
  assert.equal(typeof res.json.error, "string");
  assert.equal(readRaw(), before);
});

test("capture: unknown project answers 404", async () => {
  const res = await capture("ghost", { title: "Projeto inexistente" });
  assert.equal(res.status, 404);
});

test("duplicates: similar title returns the candidate, no title is 400, unrelated title is empty", async () => {
  const similar = await duplicates(SLUG, "Exportar o relatório mensal CSV");
  assert.equal(similar.status, 200);
  assert.equal(similar.json.ok, true);
  const candidate = similar.json.candidates.find((item) => item.id === "US-1");
  assert.ok(candidate);
  assert.equal(candidate.key, "US-1");
  assert.equal(typeof candidate.reason, "string");
  assert.equal(typeof candidate.score, "number");
  assert.ok(Object.keys(candidate).every((name) => ["id", "key", "title", "reason", "score"].includes(name)));
  const missing = await duplicates(SLUG);
  assert.equal(missing.status, 400);
  assert.equal(typeof missing.json.error, "string");
  const unrelated = await duplicates(SLUG, "ornek baglanti kaleydoskop");
  assert.equal(unrelated.status, 200);
  assert.deepEqual(unrelated.json.candidates, []);
});

test("capture: a captured draft never lands in the active sprint", async () => {
  const res = await capture(SLUG, { title: "Historia fora do sprint", sprintId: "sprint-1" });
  assert.equal(res.status, 201);
  const store = readStore();
  const sprint = store.sprints.find((item) => item.id === store.activeSprintId);
  assert.equal(sprint.id, "sprint-1");
  if (sprint.stories) {
    assert.equal(sprint.stories.includes(res.json.story.id), false);
  }
  const persisted = store.stories.find((story) => story.id === res.json.story.id);
  assert.notEqual(persisted.sprintId, "sprint-1");
  assert.equal(persisted.sprintId, null);
});
