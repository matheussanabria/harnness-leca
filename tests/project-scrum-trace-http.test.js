// @ts-check
// Rotas somente-leitura de evidencia da historia: commits com trailer "Story:" e avaliacao de Definition of Ready.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { sandboxGit, initSandboxRepo } = require("./helpers/git-sandbox");
const { createServer } = require("../ui/server");
const { getCanonicalLanes } = require("../ui/server/services/project-scrum-lanes");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "scrum-trace-http-"));
const projects = path.join(root, "projects");
const repo = path.join(root, "code-repo");
process.env.HARNESS_PROJECTS_DIR = projects;
test.after(() => fs.rmSync(root, { recursive: true, force: true }));

function git(args) {
  const result = sandboxGit(repo, args);
  assert.equal(result.status, 0, result.stderr);
}

function story(id, extra = {}) {
  return { id, key: id, title: `Historia ${id}`, sprintId: "sprint-1", status: "todo", laneId: "pronto-para-dev", origin: "local", ...extra };
}

function writeProject(slug, stories, repoPath) {
  const dir = path.join(projects, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "scrum.json"), JSON.stringify({
    schemaVersion: 2, migrationHistory: [], activeSprintId: "sprint-1", sprints: [{ id: "sprint-1", name: "Sprint 1" }],
    epics: [], stories, lanes: getCanonicalLanes(), lanesRevision: 0, transitionHistory: [],
  }), "utf8");
  if (repoPath) fs.writeFileSync(path.join(dir, "mcp.json"), JSON.stringify({ repo: repoPath }), "utf8");
}

fs.mkdirSync(repo, { recursive: true });
initSandboxRepo(repo, { name: "Tester", email: "tester@example.invalid" });
git(["commit", "-q", "--allow-empty", "-m", "feat: linked work", "-m", "Story: US-1"]);
git(["commit", "-q", "--allow-empty", "-m", "chore: unrelated"]);

writeProject("proj", [
  story("US-1", {
    description: "O usuario precisa exportar o relatorio mensal em CSV para conferir no Excel.",
    acceptanceCriteria: ["O botao Exportar gera um arquivo .csv", "O arquivo contem todas as colunas visiveis"],
    points: 3, epicId: "epic-1", priority: "alta",
  }),
  story("US-2"),
], repo);
writeProject("norepo", [story("US-1")]);

async function get(url, headers = {}) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    return await new Promise((resolve, reject) => {
      const req = http.request({ host: "127.0.0.1", port: server.address().port, path: url, headers }, (res) => {
        let text = "";
        res.on("data", (chunk) => (text += chunk));
        res.on("end", () => resolve({ status: res.statusCode, text, json: (() => { try { return JSON.parse(text); } catch { return null; } })() }));
      });
      req.on("error", reject);
      req.end();
    });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

test("commits: devolve apenas o commit com trailer da historia, verificado, sem caminhos", async () => {
  const res = await get("/api/project/proj/scrum/story/US-1/commits");
  assert.equal(res.status, 200);
  assert.equal(res.json.available, true);
  assert.equal(res.json.commits.length, 1);
  const [commit] = res.json.commits;
  assert.match(commit.sha, /^[0-9a-f]{40}$/);
  assert.equal(commit.subject, "feat: linked work");
  assert.equal(commit.verified, true);
  assert.deepEqual(res.json.byStory["US-1"], [commit.sha]);
  assert.equal(res.text.includes(repo.replace(/\\/g, "/")) || res.text.includes(repo), false, "a resposta nao expoe o caminho do repositorio");
});

test("commits: historia sem trailer volta lista vazia", async () => {
  const res = await get("/api/project/proj/scrum/story/US-2/commits");
  assert.equal(res.status, 200);
  assert.deepEqual(res.json.commits, []);
});

test("commits: projeto sem repositorio configurado nao cai no repositorio do Harness", async () => {
  const res = await get("/api/project/norepo/scrum/story/US-1/commits");
  assert.equal(res.status, 200);
  assert.equal(res.json.available, false);
  assert.equal(res.json.reason, "no-repo");
  assert.deepEqual(res.json.commits, []);
});

test("rotas: historia ou projeto inexistente respondem 404", async () => {
  assert.equal((await get("/api/project/proj/scrum/story/NOPE-9/commits")).status, 404);
  assert.equal((await get("/api/project/proj/scrum/story/NOPE-9/dor")).status, 404);
  assert.equal((await get("/api/project/ghost/scrum/story/US-1/commits")).status, 404);
});

test("dor: historia completa esta pronta e a incompleta lista o que falta", async () => {
  const ok = await get("/api/project/proj/scrum/story/US-1/dor");
  assert.equal(ok.status, 200);
  assert.equal(ok.json.dor.ready, true);
  assert.equal(ok.json.maturity, "ready");
  assert.equal(ok.json.dor.humanReview, true);
  const weak = await get("/api/project/proj/scrum/story/US-2/dor");
  assert.equal(weak.json.dor.ready, false);
  assert.ok(weak.json.dor.requiredFailed.includes("description"));
  assert.ok(weak.json.dor.requiredFailed.includes("criteria-present"));
});

test("rotas novas ficam atras do portao: por tunel sem PIN configurado sao recusadas", async () => {
  const tunnel = { host: "abcd.trycloudflare.com", "cf-connecting-ip": "198.51.100.77" };
  assert.equal((await get("/api/project/proj/scrum/story/US-1/commits", tunnel)).status, 403);
  assert.equal((await get("/api/project/proj/scrum/story/US-1/dor", tunnel)).status, 403);
});
