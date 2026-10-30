"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseFrontmatter, validateFrontmatter } = require("../tools/lib/mapa/frontmatter");
const { matchesGlob } = require("../tools/lib/mapa/glob");
const { checkMapa } = require("../tools/lib/mapa/check");
const { findMapa, buildIndex, buildDomainTable } = require("../tools/lib/mapa/query");

const META = {
  domain: "backend", module: "atelier", feature: "agent-loop", summary: "Agent loop and tools",
  paths: ["ui/server/services/atelier-*.js"], keywords: ["atelier", "loop"], updated: "2026-10-30",
};
const entry = (over = {}, file = "docs/mapa/backend/atelier/agent-loop.md", size = 2000) => ({ file, size, meta: { ...META, ...over } });
const FILES = ["ui/server/services/atelier-agent-loop.service.js", "ui/server/router.js"];

test("frontmatter: parses scalars and inline lists, body is kept", () => {
  const { meta, body } = parseFrontmatter("---\ndomain: backend\npaths: [a/*.js, \"b/\"]\n---\n# Title\n");
  assert.deepEqual(meta, { domain: "backend", paths: ["a/*.js", "b/"] });
  assert.equal(body, "# Title\n");
  assert.equal(parseFrontmatter("# no header").meta, null);
});

test("frontmatter: validation reports missing fields, bad lists, long summary and bad date", () => {
  assert.deepEqual(validateFrontmatter(META), []);
  const problems = validateFrontmatter({ ...META, paths: "x", summary: "s".repeat(121), updated: "30/10/2026", keywords: [] });
  assert.equal(problems.length, 4);
});

test("glob: ** crosses folders, * stays in one segment, plain folders cover their content", () => {
  assert.equal(matchesGlob("ui/**/*.js", "ui/server/services/a.js"), true);
  assert.equal(matchesGlob("ui/server/*.js", "ui/server/services/a.js"), false);
  assert.equal(matchesGlob("ui/server/", "ui/server/services/a.js"), true);
  assert.equal(matchesGlob("ui/server", "ui/server2/a.js"), false);
  assert.equal(matchesGlob("tools\\mapa.js", "tools/mapa.js"), true);
});

test("check: valid tree passes; orphan files are warnings, errors under strict", () => {
  const ok = checkMapa([entry()], FILES);
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.orphans[0], "ui/server/router.js");
  assert.equal(ok.warnings.length, 1);
  assert.equal(checkMapa([entry()], FILES, { strict: true }).errors.length, 1);
});

test("check: size cap, folder mismatch, dead path and legacy files", () => {
  const big = checkMapa([entry({}, undefined, 9000)], FILES);
  assert.match(big.errors[0], /over the 8192 | 3.0 KBlimit/);
  const wrongDir = checkMapa([entry({ module: "other" })], FILES);
  assert.ok(wrongDir.errors.some((e) => /do not match the folders/.test(e)));
  const dead = checkMapa([entry({ paths: ["ui/nada/*.js"] })], FILES);
  assert.ok(dead.errors.some((e) => /dead link/.test(e)));
  const docsEntry = entry({ paths: ["docs/evolucao.md"] });
  assert.ok(checkMapa([docsEntry], FILES).errors.some((e) => /dead link/.test(e)));
  assert.deepEqual(checkMapa([docsEntry], FILES, { tracked: [...FILES, "docs/evolucao.md"] }).errors, []);
  const legacy = checkMapa([{ file: "docs/mapa/02-backend.md", size: 100, meta: null }], FILES);
  assert.deepEqual(legacy.errors, []);
  assert.ok(legacy.warnings.some((w) => /not migrated/.test(w)));
  assert.match(checkMapa([], FILES, { indexSize: 5000 }).errors[0], /MAPA\.md/);
});

test("find: by path prefers the most specific glob; by keyword ranks field hits; legacy files are skipped", () => {
  const generic = entry({ module: "all", feature: "all", paths: ["ui/server/**"] }, "docs/mapa/backend/all/all.md");
  const legacy = { file: "docs/mapa/02-backend.md", size: 1, meta: null };
  const hits = findMapa([generic, entry(), legacy], "ui/server/services/atelier-agent-loop.service.js");
  assert.equal(hits[0].file, "docs/mapa/backend/atelier/agent-loop.md");
  assert.equal(hits.length, 2);
  assert.equal(findMapa([generic, entry()], "atelier")[0].meta.module, "atelier");
  assert.deepEqual(findMapa([entry()], "zzz"), []);
});

test("build: index table lists migrated entries with size", () => {
  const table = buildIndex([entry(), { file: "docs/mapa/02-backend.md", size: 1, meta: null }]);
  assert.match(table, /`backend\/atelier\/agent-loop\.md` \| backend \/ atelier \| Agent loop and tools \| 2\.0 KB/);
  assert.equal(table.split("\n").length, 3);
});

test("build: domain table groups modules, files and size per domain", () => {
  const other = entry({ module: "chat", domain: "backend" }, "docs/mapa/backend/chat/c.md", 1024);
  const table = buildDomainTable([entry(), other, entry({ domain: "tools" }, "docs/mapa/tools/atelier/x.md", 512), { file: "docs/mapa/02-backend.md", size: 1, meta: null }]);
  assert.match(table, /`backend` \| atelier, chat \| 2 | 3.0 KB\| 2\.9 KB/);
  assert.match(table, /`tools` \| atelier \| 1 \| 0\.5 KB/);
  assert.equal(table.split("\n").length, 4);
});
