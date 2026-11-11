// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  normalizeKind,
  pluralKind,
  parseRoute,
  buildUrl,
} = require("../ui/public/js/catalogo/catalogo-router");

test("catalog-router: normalizes kinds and plural forms", () => {
  assert.equal(normalizeKind("workflow"), "workflow");
  assert.equal(normalizeKind("workflows"), "workflow");
  assert.equal(normalizeKind("agent"), "agent");
  assert.equal(normalizeKind("agents"), "agent");
  assert.equal(normalizeKind("skill"), "skill");
  assert.equal(normalizeKind("skills"), "skill");
  assert.equal(normalizeKind("unknown"), "skill");

  assert.equal(pluralKind("workflow"), "workflows");
  assert.equal(pluralKind("agent"), "agents");
  assert.equal(pluralKind("skill"), "skills");
});

test("catalog-router: parses list routes for all categories", () => {
  const root = parseRoute("/catalogo");
  assert.equal(root.view, "list");
  assert.equal(root.kind, "skill");

  const wf = parseRoute("/catalogo/workflows");
  assert.equal(wf.view, "list");
  assert.equal(wf.kind, "workflow");

  const ag = parseRoute("/catalogo/agents");
  assert.equal(ag.view, "list");
  assert.equal(ag.kind, "agent");

  const sk = parseRoute("/catalogo/skills");
  assert.equal(sk.view, "list");
  assert.equal(sk.kind, "skill");
});

test("catalog-router: parses detail routes with canonical path and decode", () => {
  const wf = parseRoute("/catalogo/workflows/feature-delivery");
  assert.equal(wf.view, "detail");
  assert.equal(wf.kind, "workflow");
  assert.equal(wf.id, "feature-delivery");

  const ag = parseRoute("/catalogo/agents/business-analyst");
  assert.equal(ag.view, "detail");
  assert.equal(ag.kind, "agent");
  assert.equal(ag.id, "business-analyst");

  const sk = parseRoute("/catalogo/skills/bdd%2Dscenarios");
  assert.equal(sk.view, "detail");
  assert.equal(sk.kind, "skill");
  assert.equal(sk.id, "bdd-scenarios");

  // Singular path alias
  const sing = parseRoute("/catalogo/workflow/hotfix");
  assert.equal(sing.view, "detail");
  assert.equal(sing.kind, "workflow");
  assert.equal(sing.id, "hotfix");
});

test("catalog-router: parses legacy query strings and flags legacy mode", () => {
  const legacy = parseRoute("/catalogo", "?kind=agent&name=business-analyst");
  assert.equal(legacy.view, "detail");
  assert.equal(legacy.kind, "agent");
  assert.equal(legacy.id, "business-analyst");
  assert.equal(legacy.legacy, true);
});

test("catalog-router: builds canonical URLs", () => {
  assert.equal(buildUrl({ view: "list", kind: "workflow" }), "/catalogo/workflows");
  assert.equal(buildUrl({ view: "list", kind: "agent" }), "/catalogo/agents");
  assert.equal(buildUrl({ view: "list", kind: "skill" }), "/catalogo/skills");

  assert.equal(
    buildUrl({ view: "detail", kind: "workflow", id: "feature-delivery" }),
    "/catalogo/workflows/feature-delivery"
  );
  assert.equal(
    buildUrl({ view: "detail", kind: "agent", id: "business-analyst" }),
    "/catalogo/agents/business-analyst"
  );
  assert.equal(
    buildUrl({ view: "detail", kind: "skill", id: "bdd-scenarios" }),
    "/catalogo/skills/bdd-scenarios"
  );
});

test("catalog-router: code compliance (lines and emojis)", () => {
  const routerFile = path.join(__dirname, "../ui/public/js/catalogo/catalogo-router.js");
  const content = fs.readFileSync(routerFile, "utf8");
  const lines = content.split("\n").length;
  assert.ok(lines < 250, `File must be under 250 lines, got ${lines}`);
  assert.doesNotMatch(content, /[\u{1F300}-\u{1FAFF}]/u, "Emojis are strictly prohibited");
});

