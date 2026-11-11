const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { parseWorkflowManifest, readDai } = require("../tools/lib/playbook/dai-source");
const { loadPlaybook, compareWithDai } = require("../tools/lib/playbook/load");
const { buildPage, safeJson } = require("../tools/lib/playbook/build-page");

const DATA_DIR = path.join(__dirname, "..", "docs", "playbook");

const MANIFEST = `workflow:
  states:
    start:
      phase: "planning"
      activity: "init"
      next: "story"
    story:
      phase: "requirements"
      activity: "write-story"
      next: "dev"
    dev:
      phase: "implementation"
      activity: "implement"
      next: "maintain"
    maintain:
      phase: "maintenance"
      trigger: "bug after deploy"
      activity: "triage"
      next: "done"
  activities:
    init:
      executor: "session"
      outputs:
        - "_status.md"
    write-story:
      executor: "agent:business-analyst"
      support:
        - "product-owner"
      skills:
        - "requirements-engineering"
    implement:
      executor: "agent:software-developer"
      support:
        - "backend-engineer"
        - "frontend-engineer"
    triage:
      executor: "agent:qa-engineer"
`;

function fakeDai() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "playbook-dai-"));
  fs.mkdirSync(path.join(root, "workflows", "feature-delivery"), { recursive: true });
  fs.writeFileSync(path.join(root, "workflows", "feature-delivery", "manifest.yaml"), MANIFEST);
  for (const [id, title] of [["business-analyst", "Business Analyst"], ["software-developer", "Software Developer"], ["scrum-master", "Scrum Master"]]) {
    fs.mkdirSync(path.join(root, ".agents", id), { recursive: true });
    fs.writeFileSync(path.join(root, ".agents", id, "AGENT.md"), `# ${title}\n\nYou work as ${title}.\n`);
  }
  fs.mkdirSync(path.join(root, ".agents", "00-index"), { recursive: true });
  return root;
}

test("the workflow reader returns phase, executor, support and trigger per state", () => {
  const stages = parseWorkflowManifest(MANIFEST);
  assert.deepEqual(stages.map((s) => s.id), ["start", "story", "dev", "maintain"]);
  assert.equal(stages[0].executor, "session");
  assert.deepEqual(stages[1].support, ["product-owner"]);
  assert.deepEqual(stages[2].support, ["backend-engineer", "frontend-engineer"]);
  assert.equal(stages[3].trigger, true);
  assert.equal(stages[1].phase, "requirements");
});

test("readDai lists agents with their stages and skips the 00- folders", () => {
  const dai = readDai(fakeDai());
  assert.deepEqual(dai.agents.map((a) => a.id), ["business-analyst", "scrum-master", "software-developer"]);
  const ba = dai.agents.find((a) => a.id === "business-analyst");
  assert.deepEqual(ba.stages, [{ id: "story", role: "executor" }]);
  assert.equal(ba.title, "Business Analyst");
  assert.equal(dai.agents.find((a) => a.id === "scrum-master").stages.length, 0);
});

test("the matrix keeps only agents with a stage and marks executor versus support", () => {
  const { matrix } = readDai(fakeDai());
  const rows = Object.fromEntries(matrix.rows.map((r) => [r.agent, r.cells]));
  assert.equal(rows["business-analyst"].story, "executor");
  assert.equal(rows["backend-engineer"].dev, "support");
  assert.equal(rows["qa-engineer"].maintain, "executor");
  assert.equal(rows["scrum-master"], undefined);
});

test("readDai fails clearly when DAI has no feature-delivery manifest", () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "playbook-empty-"));
  assert.throws(() => readDai(empty), /manifest not found/);
});

test("the real playbook data is complete, bilingual and emoji free", () => {
  const { data, issues } = loadPlaybook(DATA_DIR);
  assert.deepEqual(issues, []);
  assert.equal(data.stages.items.length, data.examples.length);
  assert.equal(data.phases.items.length, 7);
});

test("loadPlaybook reports a missing language and an emoji", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "playbook-data-"));
  fs.cpSync(DATA_DIR, dir, { recursive: true });
  const layers = JSON.parse(fs.readFileSync(path.join(dir, "layers.json"), "utf8"));
  layers.heading.en = "";
  layers.intro.pt = "bad \u{1F600}";
  fs.writeFileSync(path.join(dir, "layers.json"), JSON.stringify(layers));
  const { issues } = loadPlaybook(dir);
  assert.ok(issues.some((i) => i.includes('missing "en"')));
  assert.ok(issues.some((i) => i.includes("emoji")));
});

test("compareWithDai flags a different stage order and phase", () => {
  const { data } = loadPlaybook(DATA_DIR);
  const dai = readDai(fakeDai());
  const issues = compareWithDai(data, dai);
  assert.ok(issues.some((i) => i.startsWith("stage order differs")));
  const same = { stages: data.stages.items.map((s) => ({ id: s.id, phase: s.phase, trigger: Boolean(s.trigger) })) };
  assert.deepEqual(compareWithDai(data, same), []);
  same.stages[3].phase = "testing";
  assert.ok(compareWithDai(data, same).some((i) => i.includes("differs from DAI")));
});

test("buildPage embeds the data and cannot be broken out of the script block", () => {
  const { data } = loadPlaybook(DATA_DIR);
  data.ui.h1.en = "title </script><b>x</b>";
  const html = buildPage(data, readDai(fakeDai()));
  assert.equal(html.match(/<\/script>/g).length, 1);
  assert.ok(html.includes("const DATA = {"));
  assert.ok(html.includes("\\u003c/script>"));
  assert.equal(safeJson({ a: "</x>" }), '{"a":"\\u003c/x>"}');
});

test("a stage that names an agent without a .agents folder is reported, built-in executors are not", () => {
  const dai = readDai(fakeDai());
  assert.deepEqual(dai.missingAgents.sort(), ["backend-engineer", "frontend-engineer", "product-owner", "qa-engineer"]);
  const { data } = loadPlaybook(DATA_DIR);
  const issues = compareWithDai(data, { stages: [], missingAgents: ["ghost"] });
  assert.ok(issues.some((i) => i.includes('agent "ghost"')));
});
