// @ts-check
const os = require("os");
const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const test = require("node:test");
const assert = require("node:assert/strict");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "leca-skill-bindings-"));
process.env.HARNESS_ROOT = TMP_ROOT;

const SLUG = "projeto-teste";
const LANE = "em-desenvolvimento";
const SKILL_A = "project-harness:bdd-scenarios";
const SKILL_B = "project-harness:ux-design-process";

function seedProject() {
  const projectDir = path.join(TMP_ROOT, "projects", SLUG);
  for (const [name, description] of [
    ["bdd-scenarios", "Cenarios BDD em Gherkin"],
    ["ux-design-process", "Processo de design de experiencia"],
  ]) {
    const dir = path.join(projectDir, ".agents", "skills", name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`);
  }
  return projectDir;
}

const {
  BINDINGS_REL,
  MAX_SKILLS_PER_LANE,
  normalizeSkillKey,
  readBindingState,
  buildBindingReport,
  setSkillBinding,
} = require("../ui/server/services/skill-bindings.service");
const { getCanonicalLanes } = require("../ui/server/services/project-scrum-lanes");
const {
  apiProjectSkillBindingsUpdate,
} = require("../ui/server/controllers/skill-bindings.controller");

function fakeRes() {
  return {
    headersSent: false,
    writableEnded: false,
    status: 0,
    body: "",
    setHeader() {},
    writeHead(code) { this.status = code; this.headersSent = true; },
    end(body) { this.body = body; this.writableEnded = true; },
  };
}

function fakeReq({ local = true, body = null } = {}) {
  const req = Readable.from(body == null ? [] : [JSON.stringify(body)]);
  // @ts-ignore
  req.socket = { remoteAddress: local ? "127.0.0.1" : "192.168.1.50" };
  // @ts-ignore
  req.headers = {};
  return req;
}

const PROJECT_DIR = seedProject();
const LANES = getCanonicalLanes();
const SKILL_KEYS = new Set([SKILL_A, SKILL_B]);

test("skill-bindings: leitura tolerante e chave de skill normalizada", () => {
  const empty = readBindingState(PROJECT_DIR);
  assert.deepEqual(empty.items, {});
  assert.equal(empty.error, "");

  assert.equal(normalizeSkillKey(SKILL_A), SKILL_A);
  assert.equal(normalizeSkillKey(""), "");
  assert.equal(normalizeSkillKey("sem-alvo"), "");
  assert.equal(normalizeSkillKey("alvo:com:dois"), "");

  fs.writeFileSync(path.join(PROJECT_DIR, BINDINGS_REL), "{ nao e json");
  const broken = readBindingState(PROJECT_DIR);
  assert.deepEqual(broken.items, {});
  assert.ok(broken.error.length > 0, "manifesto inválido deve virar aviso");
  fs.rmSync(path.join(PROJECT_DIR, BINDINGS_REL), { force: true });
});

test("skill-bindings: add, remove e relatório de vínculos", () => {
  const lanes = LANES.map((lane) => lane.id);
  assert.equal(lanes.length, 12);

  const added = setSkillBinding(PROJECT_DIR, { action: "add", laneId: LANE, skillKey: SKILL_A }, LANES, SKILL_KEYS);
  assert.equal(added.changed, true);
  assert.deepEqual(added.items[LANE], [SKILL_A]);

  const again = setSkillBinding(PROJECT_DIR, { action: "add", laneId: LANE, skillKey: SKILL_A }, LANES, SKILL_KEYS);
  assert.equal(again.changed, false);
  assert.deepEqual(again.items[LANE], [SKILL_A]);

  setSkillBinding(PROJECT_DIR, { action: "add", laneId: "backlog", skillKey: SKILL_B }, LANES, SKILL_KEYS);
  const report = buildBindingReport(PROJECT_DIR, LANES, SKILL_KEYS);
  assert.equal(report.items[LANE].includes(SKILL_A), true);
  assert.equal(report.items.backlog.includes(SKILL_B), true);
  assert.deepEqual(report.lanes.map((lane) => lane.id), lanes);
  assert.equal(report.totals.bindings, 2);

  const removed = setSkillBinding(PROJECT_DIR, { action: "remove", laneId: LANE, skillKey: SKILL_A }, LANES, SKILL_KEYS);
  assert.equal(removed.changed, true);
  assert.equal(removed.items[LANE], undefined);
});

test("skill-bindings: órfãos e validações de raia/skill", () => {
  fs.writeFileSync(
    path.join(PROJECT_DIR, BINDINGS_REL),
    JSON.stringify({ version: 1, items: { [LANE]: [SKILL_A, "project-harness:nao-existe"] } }),
  );
  const report = buildBindingReport(PROJECT_DIR, LANES, SKILL_KEYS);
  assert.deepEqual(report.items[LANE], [SKILL_A]);
  assert.deepEqual(report.unresolved, [{ laneId: LANE, skillKey: "project-harness:nao-existe" }]);
  assert.equal(report.totals.unresolved, 1);

  assert.throws(() => setSkillBinding(PROJECT_DIR, { action: "add", laneId: "inexistente", skillKey: SKILL_A }, LANES, SKILL_KEYS), /Raia/);
  assert.throws(() => setSkillBinding(PROJECT_DIR, { action: "add", laneId: LANE, skillKey: "project-harness:nao-existe" }, LANES, SKILL_KEYS), /Skill/);
  assert.throws(() => setSkillBinding(PROJECT_DIR, { action: "abrir", laneId: LANE, skillKey: SKILL_A }, LANES, SKILL_KEYS), /Ação/);

  const many = { version: 1, items: { [LANE]: Array.from({ length: MAX_SKILLS_PER_LANE + 5 }, (_, i) => `project-harness:skill-${i}`) } };
  fs.writeFileSync(path.join(PROJECT_DIR, BINDINGS_REL), JSON.stringify(many));
  assert.equal(readBindingState(PROJECT_DIR).items[LANE].length, MAX_SKILLS_PER_LANE);
});

test("skill-bindings: HTTP expõe raias/skills e valida o projeto", async () => {
  fs.rmSync(path.join(PROJECT_DIR, BINDINGS_REL), { force: true });
  const { createServer } = require("../ui/server");
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const get = await fetch(`${base}/api/project/${SLUG}/skill-bindings`);
    assert.equal(get.status, 200);
    const body = await get.json();
    assert.equal(body.version, 1);
    assert.equal(body.lanes.length, 12);
    assert.equal(body.skills.includes(SKILL_A), true);

    const missing = await fetch(`${base}/api/project/nao-existe/skill-bindings`);
    assert.equal(missing.status, 404);

    const invalid = await fetch(`${base}/api/project/${"a".repeat(70)}/skill-bindings`);
    assert.equal(invalid.status, 400);
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

test("skill-bindings: alteração só vem do loopback", async () => {
  fs.rmSync(path.join(PROJECT_DIR, BINDINGS_REL), { force: true });

  const added = fakeRes();
  await apiProjectSkillBindingsUpdate({
    req: fakeReq({ local: true, body: { action: "add", laneId: LANE, skillKey: SKILL_A } }),
    res: added,
    params: [SLUG],
  });
  assert.equal(added.status, 200);
  assert.deepEqual(JSON.parse(added.body).items[LANE], [SKILL_A]);

  const remote = fakeRes();
  await apiProjectSkillBindingsUpdate({
    req: fakeReq({ local: false, body: { action: "add", laneId: LANE, skillKey: SKILL_B } }),
    res: remote,
    params: [SLUG],
  });
  assert.equal(remote.status, 403);

  const badSkill = fakeRes();
  await apiProjectSkillBindingsUpdate({
    req: fakeReq({ local: true, body: { action: "add", laneId: LANE, skillKey: "project-harness:nao-existe" } }),
    res: badSkill,
    params: [SLUG],
  });
  assert.equal(badSkill.status, 400);

  const badLane = fakeRes();
  await apiProjectSkillBindingsUpdate({
    req: fakeReq({ local: true, body: { action: "add", laneId: "inexistente", skillKey: SKILL_A } }),
    res: badLane,
    params: [SLUG],
  });
  assert.equal(badLane.status, 400);

  const badJson = fakeRes();
  await apiProjectSkillBindingsUpdate({
    req: fakeReq({ local: true, body: null }),
    res: badJson,
    params: [SLUG],
  });
  assert.equal(badJson.status, 400);
});

test("skill-bindings: rota registrada, limite de 300 linhas e sem emojis", () => {
  const router = fs.readFileSync(path.join(__dirname, "..", "ui/server/router.js"), "utf8");
  assert.match(router, /skillBindingRoutes/);

  const routes = fs.readFileSync(path.join(__dirname, "..", "ui/server/routes/skill-bindings.routes.js"), "utf8");
  assert.ok(routes.includes("/^\\/api\\/project\\/([\\w-]+)\\/skill-bindings$/"));

  const files = [
    "ui/server/services/skill-bindings.service.js",
    "ui/server/controllers/skill-bindings.controller.js",
    "ui/server/routes/skill-bindings.routes.js",
    "tests/skill-bindings.test.js",
    "ui/server/router.js",
  ];
  for (const file of files) {
    const text = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.ok(text.split(/\r?\n/).length < 300, `${file} passou de 300 linhas`);
    assert.equal(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text), false, `${file} contém emoji`);
  }
});
