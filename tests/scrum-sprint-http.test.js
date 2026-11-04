// @ts-check
// Sprint lifecycle routes and the CLI that exposes the same service (actor rules for agents).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { spawnSync } = require("node:child_process");
const { createServer } = require("../ui/server");
const { getCanonicalLanes } = require("../ui/server/services/project-scrum-lanes");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "scrum-sprint-http-"));
const projects = path.join(root, "projects");
process.env.HARNESS_PROJECTS_DIR = projects;
test.after(() => fs.rmSync(root, { recursive: true, force: true }));

const story = (id, sprintId, laneId = "pronto-para-dev", points = 3) => ({ id, key: id, title: `Story ${id}`, sprintId, status: "todo", laneId, points, origin: "local" });
const dir = path.join(projects, "proj");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "scrum.json"), JSON.stringify({
  schemaVersion: 2, migrationHistory: [], activeSprintId: "s1",
  sprints: [{ id: "s1", name: "S1", goal: "Ship", status: "planned" }, { id: "s2", name: "S2", goal: "More", status: "planned" }],
  epics: [], stories: [story("a", "s1", "concluido", 5), story("b", "s1"), story("c", "s2")],
  lanes: getCanonicalLanes(), lanesRevision: 0, transitionHistory: [],
}), "utf8");

async function post(url, body) {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    return await new Promise((resolve, reject) => {
      const payload = JSON.stringify(body || {});
      const { port } = server.address();
      const headers = { "content-type": "application/json", "content-length": Buffer.byteLength(payload), origin: `http://127.0.0.1:${port}` };
      const req = http.request({ host: "127.0.0.1", port, path: url, method: "POST", headers }, (res) => {
        let text = "";
        res.on("data", (chunk) => (text += chunk));
        res.on("end", () => resolve({ status: res.statusCode, json: JSON.parse(text) }));
      });
      req.on("error", reject);
      req.end(payload);
    });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

const cli = path.join(__dirname, "..", "tools", "scrum.js");
const run = (...args) => {
  const r = spawnSync(process.execPath, [cli, ...args, "--project", "proj"], { env: { ...process.env, HARNESS_PROJECTS_DIR: projects }, encoding: "utf8" });
  return { code: r.status, out: r.stdout, err: r.stderr };
};

test("cli: agents can plan but not start or close a sprint", () => {
  const agent = ["--actor", "agent:codex:run1"];
  assert.equal(run("sprint", "start", "s1", ...agent).code, 3);
  assert.equal(run("sprint", "close", "s1", ...agent).code, 3);
  assert.equal(run("sprint", "start", "s1").code, 1, "actor required");
  const planned = run("sprint", "plan", "s2", "--add", "b", ...agent);
  assert.equal(planned.code, 0, planned.err);
  const moved = JSON.parse(planned.out);
  assert.deepEqual(moved.added, ["b"]);
  const back = run("sprint", "plan", "s1", "--add", "b", "--remove", "c", ...agent);
  assert.equal(back.code, 0, back.err);
  const listed = JSON.parse(run("sprint", "list").out);
  assert.equal(listed.sprints.find((s) => s.id === "s1").stories, 2);
});

test("http: start then close; a second start answers 409; close reports the summary", async () => {
  const started = await post("/api/project/proj/scrum/sprint/s1/start", { actor: "human:matheus" });
  assert.equal(started.status, 200);
  assert.equal(started.json.scrum.sprints.find((s) => s.id === "s1").status, "active");
  const conflict = await post("/api/project/proj/scrum/sprint/s2/start", { actor: "human:matheus" });
  assert.equal(conflict.status, 409);
  const bad = await post("/api/project/proj/scrum/sprint/s1/close", { actor: "bot" });
  assert.equal(bad.status, 400);
  const closed = await post("/api/project/proj/scrum/sprint/s1/close", { actor: "human:matheus" });
  assert.equal(closed.status, 200);
  const s1 = closed.json.scrum.sprints.find((s) => s.id === "s1");
  assert.deepEqual([s1.status, s1.summary.completedPoints, s1.summary.carriedPoints], ["closed", 5, 3]);
  assert.equal(closed.json.scrum.summary.velocity.average, 5);
  assert.equal((await post("/api/project/proj/scrum/sprint/nope/start", {})).status, 400);
  assert.equal((await post("/api/project/ghost/scrum/sprint/s1/start", {})).status, 404);
});
