// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const {
  DAI_AGENTS,
  BUILTIN_AGENTS,
  STAGES,
} = require("../ui/server/services/orchestration/agent-stage-definitions");
const {
  STAGE_CATALOG_VERSION,
  getAgentStageCatalog,
  getStage,
  agentsForStage,
  stagesForAgent,
  isValidStage,
  isKnownAgent,
} = require("../ui/server/services/orchestration/agent-stage-catalog");
const {
  apiOrchestrationAgentStages,
  apiOrchestrationAgentStage,
} = require("../ui/server/controllers/orchestration-agent-stages.controller");

const FIXED = new Date("2026-10-21T12:00:00.000Z");
const STAGE_IDS = ["start", "story", "bdd", "prototype", "modeling", "dev", "tests", "review", "commit-pr", "deploy"];
const KNOWN_AGENT_SET = new Set([...DAI_AGENTS, ...BUILTIN_AGENTS]);

test("agent-stage-catalog: cobre as dez etapas na ordem canônica", () => {
  const catalog = getAgentStageCatalog({ now: FIXED });
  assert.equal(catalog.version, STAGE_CATALOG_VERSION);
  assert.equal(catalog.version, 1);
  assert.equal(catalog.checkedAt, FIXED.toISOString());
  assert.deepEqual(catalog.stages.map((stage) => stage.id), STAGE_IDS);
  assert.equal(catalog.stages.some((stage) => stage.id === "done"), false);

  catalog.stages.forEach((stage, index) => {
    assert.equal(stage.order, index, `${stage.id} fora de ordem`);
    assert.ok(stage.label.length > 0, `${stage.id} sem label`);
    assert.ok(stage.executors.length >= 0);
    assert.ok(stage.gate.length > 0, `${stage.id} sem gate`);
    assert.ok(Array.isArray(stage.skills) && Array.isArray(stage.writes));
    for (const agent of stage.agents) {
      assert.ok(KNOWN_AGENT_SET.has(agent.id), `${agent.id} não é agente canônico`);
      assert.ok(["executor", "support"].includes(agent.role), `${agent.id} com papel inválido`);
      assert.equal(typeof agent.required, "boolean");
      assert.equal(typeof agent.builtin, "boolean");
    }
  });
});

test("agent-stage-catalog: associa executores e apoios por etapa", () => {
  const story = agentsForStage("story");
  assert.equal(story.find((agent) => agent.id === "business-analyst")?.role, "executor");
  assert.equal(story.find((agent) => agent.id === "business-analyst")?.required, true);
  assert.equal(story.find((agent) => agent.id === "product-owner")?.role, "support");

  assert.deepEqual(agentsForStage("bdd").map((agent) => agent.id), ["qa-engineer"]);
  assert.deepEqual(agentsForStage("deploy").map((agent) => agent.id), ["devops-engineer"]);
  assert.deepEqual(agentsForStage("start"), []);
  assert.deepEqual(agentsForStage("commit-pr"), []);

  const review = agentsForStage("review");
  const codeReview = review.find((agent) => agent.id === "code-review");
  assert.equal(codeReview?.role, "executor");
  assert.equal(codeReview?.builtin, true);
  assert.equal(review.some((agent) => agent.id === "security-engineer" && agent.role === "support"), true);
});

test("agent-stage-catalog: responde consultas por etapa e por agente", () => {
  assert.equal(isValidStage("modeling"), true);
  assert.equal(isValidStage("done"), false);
  assert.equal(agentsForStage("inexistente"), null);
  assert.equal(getStage("inexistente"), null);
  assert.equal(getStage("dev")?.executors[0], "software-developer");

  assert.deepEqual(stagesForAgent("qa-engineer"), ["bdd", "tests"]);
  assert.deepEqual(stagesForAgent("devops-engineer"), ["deploy"]);
  assert.deepEqual(stagesForAgent("inexistente"), []);
  assert.equal(isKnownAgent("software-architect"), true);
  assert.equal(isKnownAgent("code-review"), true);
  assert.equal(isKnownAgent("inexistente"), false);

  const catalog = getAgentStageCatalog({ now: FIXED });
  assert.equal(catalog.agents["code-review"].builtin, true);
  assert.deepEqual(catalog.agents["code-review"].stages, ["review"]);
  assert.deepEqual(agentsForStage("story").map((agent) => agent.id), ["business-analyst", "product-owner"]);
});

test("agent-stage-catalog: HTTP expõe etapas e retorna 404 para etapa desconhecida", async () => {
  const { createServer } = require("../ui/server");
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const all = await fetch(`${base}/api/orchestration/agent-stages`);
    assert.equal(all.status, 200);
    const body = await all.json();
    assert.equal(body.version, 1);
    assert.equal(body.stages.length, 10);
    assert.deepEqual(body.stages.map((stage) => stage.id), STAGE_IDS);
    assert.equal(body.agents["qa-engineer"].stages.includes("tests"), true);

    const deploy = await fetch(`${base}/api/orchestration/agent-stages/deploy`);
    assert.equal(deploy.status, 200);
    const deployBody = await deploy.json();
    assert.deepEqual(deployBody.stage.executors, ["devops-engineer"]);

    const commitPr = await fetch(`${base}/api/orchestration/agent-stages/commit-pr`);
    assert.equal(commitPr.status, 200);
    assert.deepEqual((await commitPr.json()).stage.agents, []);

    const missing = await fetch(`${base}/api/orchestration/agent-stages/done`);
    assert.equal(missing.status, 404);
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

test("agent-stage-catalog: controller, rotas e limites estruturais", () => {
  assert.equal(apiOrchestrationAgentStages.name, "apiOrchestrationAgentStages");
  assert.equal(apiOrchestrationAgentStage.name, "apiOrchestrationAgentStage");
  assert.equal(STAGES.length, STAGE_IDS.length);

  const router = fs.readFileSync(path.join(__dirname, "..", "ui/server/router.js"), "utf8");
  assert.match(router, /orchestrationRoutes/);

  const routes = fs.readFileSync(path.join(__dirname, "..", "ui/server/routes/orchestration.routes.js"), "utf8");
  assert.match(routes, /apiOrchestrationAgentStages/);
  assert.match(routes, /apiOrchestrationAgentStage\b/);
  assert.ok(routes.includes("/^\\/api\\/orchestration\\/agent-stages\\/([\\w-]+)$/"));

  const files = [
    "ui/server/services/orchestration/agent-stage-definitions.js",
    "ui/server/services/orchestration/agent-stage-catalog.js",
    "ui/server/controllers/orchestration-agent-stages.controller.js",
    "ui/server/routes/orchestration.routes.js",
    "tests/agent-stage-catalog.test.js",
  ];
  for (const file of files) {
    const text = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.ok(text.split(/\r?\n/).length < 300, `${file} passou de 300 linhas`);
    assert.equal(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text), false, `${file} contém emoji`);
  }

  const definitions = fs.readFileSync(
    path.join(__dirname, "..", "ui/server/services/orchestration/agent-stage-definitions.js"),
    "utf8",
  );
  assert.doesNotMatch(definitions, /require\("(fs|node:fs)"\)/);
  assert.doesNotMatch(definitions, /process\.env/);
  assert.doesNotMatch(definitions, /readFileSync|readdirSync|existsSync/);
});
