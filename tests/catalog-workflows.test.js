// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { listSources } = require("../ui/server/services/catalog/catalog-sources");
const { buildCatalog } = require("../ui/server/services/catalog/catalog-reader");
const { listTree, readItemFile } = require("../ui/server/services/catalog/catalog-files");
const { enrichStages, builtinWorkflows } = require("../ui/server/services/catalog/catalog-workflows");
const { renderSkill, renderStage } = require("../ui/public/js/modules/design-workflows-view");

test("catalog-sources: discovers workflows from user, harness and project targets", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "src-wf-"));
  const home = path.join(tmp, "home");
  const root = path.join(tmp, "root");
  const repo = path.join(tmp, "repo");
  fs.mkdirSync(path.join(repo, "workflows", "sample-flow"), { recursive: true });
  fs.writeFileSync(path.join(repo, "workflows", "sample-flow", "WORKFLOW.md"), "# Sample\nDesc\n");
  const projectTargets = (slug) => (slug === "demo" ? [{ id: "main", label: "main", path: repo }] : []);

  fs.mkdirSync(path.join(root, "projects", "demo"), { recursive: true });
  const src = listSources({ home, root, projectTargets });

  assert.ok(Array.isArray(src.workflows));
  assert.equal(src.workflows[0].scope, "user");
  assert.equal(src.workflows[1].scope, "harness");
  assert.equal(src.workflows[2].scope, "project");
  assert.equal(src.workflows[2].dir, path.join(repo, "workflows"));
});

test("catalog-workflows: enrichStages attaches agents and skills to each stage", () => {
  const stages = enrichStages(["start", "story", "bdd"]);
  assert.equal(stages.length, 3);
  assert.equal(stages[0].id, "start");

  const story = stages[1];
  assert.equal(story.id, "story");
  assert.ok(story.agents.some((a) => a.id === "business-analyst"));
  assert.ok(story.skills.includes("requirements-engineering"));

  const bdd = stages[2];
  assert.equal(bdd.id, "bdd");
  assert.ok(bdd.agents.some((a) => a.id === "qa-engineer"));
  assert.ok(bdd.skills.includes("bdd-scenarios"));
});

test("catalog-workflows: builtinWorkflows provides feature-delivery and hotfix", () => {
  const all = builtinWorkflows([]);
  assert.ok(all.some((w) => w.id === "feature-delivery" || w.name === "feature-delivery"));
  assert.ok(all.some((w) => w.id === "hotfix" || w.name === "hotfix"));

  const featureDelivery = all.find((w) => w.name === "feature-delivery");
  assert.equal(featureDelivery.stageCount, 10);
  assert.ok(featureDelivery.agents.includes("business-analyst"));
  assert.ok(featureDelivery.skills.includes("requirements-engineering"));
});

test("catalog-reader: buildCatalog includes workflows with stage, agent and skill references", () => {
  const catalog = buildCatalog();
  const workflows = catalog.items.filter((i) => i.kind === "workflow");
  assert.ok(workflows.length >= 2, "Must include at least feature-delivery and hotfix");

  const fd = workflows.find((w) => w.name === "feature-delivery");
  assert.ok(fd, "feature-delivery must be present");
  assert.equal(fd.kind, "workflow");
  assert.ok(fd.stageCount >= 6);
  assert.ok(Array.isArray(fd.agents) && fd.agents.length > 0);
  assert.ok(Array.isArray(fd.skills) && fd.skills.length > 0);
});

test("catalog-files: browses and reads workflow files and virtual documentation", () => {
  const tree = listTree("workflow", "harness", "feature-delivery");
  assert.ok(tree);
  assert.equal(tree.tree[0].name, "WORKFLOW.md");

  const file = readItemFile("workflow", "harness", "feature-delivery", "WORKFLOW.md");
  assert.equal(file.status, 200);
  assert.match(file.content, /# Feature Delivery/);
  assert.match(file.content, /Business Analyst/);
  assert.match(file.content, /requirements-engineering/);
});

test("workflows-view: renderSkill and renderStage generate catalog links with no emoji", () => {
  const skillHtml = renderSkill({ name: "bdd-scenarios", available: true, bound: true });
  assert.match(skillHtml, /href="\/catalogo\/skills\/bdd-scenarios"/);
  assert.match(skillHtml, /workflow-skill-link/);

  const stageHtml = renderStage({
    id: "story",
    label: "História",
    order: 1,
    executors: ["business-analyst"],
    agents: [{ id: "business-analyst", label: "Business Analyst", role: "executor" }],
    skills: [{ name: "requirements-engineering", available: true, bound: false, globalAvailable: true }],
    gate: "Critérios de aceite",
    permissions: { read: true, write: false, exec: false },
    requiresApproval: false,
  });

  assert.match(stageHtml, /href="\/catalogo\/agents\/business-analyst"/);
  assert.match(stageHtml, /workflow-agent-link/);
  assert.match(stageHtml, /href="\/catalogo\/skills\/requirements-engineering"/);
  assert.match(stageHtml, /disponível no catálogo global/);

  // Strict check: no unicode emojis allowed
  assert.doesNotMatch(skillHtml, /[\u{1F300}-\u{1FAFF}]/u);
  assert.doesNotMatch(stageHtml, /[\u{1F300}-\u{1FAFF}]/u);
});

