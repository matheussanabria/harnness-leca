const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const cache = require("../ui/server/services/catalog/catalog-cache");
const { buildCatalog } = require("../ui/server/services/catalog/catalog-reader");

const skill = (dir, name, desc) => {
  fs.mkdirSync(path.join(dir, name), { recursive: true });
  fs.writeFileSync(path.join(dir, name, "SKILL.md"), `---\nname: ${name}\ndescription: ${desc}\n---\nbody`);
};

function fixture() {
  cache.reset();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "catalog-cache-"));
  const skills = path.join(dir, "skills");
  const agents = path.join(dir, "agents");
  skill(skills, "alpha", "first");
  skill(skills, "beta", "second");
  fs.mkdirSync(agents);
  fs.writeFileSync(path.join(agents, "agent-one.md"), "---\nname: agent-one\ndescription: an agent\n---\nbody");
  const sources = { skills: [{ id: "user", label: "U", dir: skills }], agents: [{ id: "user", label: "U", dir: agents }] };
  const build = () => buildCatalog({ sources, overridesFile: path.join(dir, "o.json") });
  return { dir, skills, agents, build };
}
const desc = (cat, name) => cat.items.find((i) => i.name === name)?.description;

test("an unchanged catalog is served without re-reading any file", () => {
  const f = fixture();
  f.build();
  assert.equal(cache.stats.misses, 3);
  assert.equal(cache.stats.hits, 0);
  const again = f.build();
  assert.equal(cache.stats.misses, 3, "no new reads");
  assert.equal(cache.stats.hits, 3);
  assert.equal(again.items.length, 3);
  assert.equal(desc(again, "alpha"), "first");
});

test("editing a file shows on the next call and re-reads only that file", () => {
  const f = fixture();
  f.build();
  const file = path.join(f.skills, "alpha", "SKILL.md");
  fs.writeFileSync(file, "---\nname: alpha\ndescription: changed text\n---\nbody");
  // Force a different mtime even on file systems with coarse timestamps.
  const later = new Date(Date.now() + 5000);
  fs.utimesSync(file, later, later);
  const cat = f.build();
  assert.equal(desc(cat, "alpha"), "changed text");
  assert.equal(cache.stats.misses, 4, "only alpha was re-read");
});

test("a size change alone also invalidates the entry", () => {
  const f = fixture();
  f.build();
  const file = path.join(f.skills, "beta", "SKILL.md");
  const before = fs.statSync(file);
  fs.writeFileSync(file, "---\nname: beta\ndescription: second, longer now\n---\nbody");
  fs.utimesSync(file, before.atime, before.mtime);
  assert.equal(desc(f.build(), "beta"), "second, longer now");
});

test("creating and removing a skill is reflected without a restart", () => {
  const f = fixture();
  f.build();
  skill(f.skills, "gamma", "brand new");
  let cat = f.build();
  assert.equal(desc(cat, "gamma"), "brand new");
  assert.equal(cat.items.length, 4);
  fs.rmSync(path.join(f.skills, "alpha"), { recursive: true, force: true });
  cat = f.build();
  assert.equal(cat.items.length, 3);
  assert.equal(desc(cat, "alpha"), undefined);
});

test("entries of removed files are dropped so the cache does not grow", () => {
  const f = fixture();
  f.build();
  assert.equal(cache.size(), 3);
  fs.rmSync(path.join(f.skills, "beta"), { recursive: true, force: true });
  f.build();
  assert.equal(cache.size(), 2);
});

test("a file that cannot be read gives empty metadata and does not break the build", () => {
  const f = fixture();
  fs.mkdirSync(path.join(f.skills, "broken", "SKILL.md"), { recursive: true });
  assert.doesNotThrow(() => f.build());
  assert.deepEqual(cache.readMeta(path.join(f.dir, "missing.md")), {});
});

test("manual area choices are never cached: a change shows on the next call", () => {
  const f = fixture();
  const first = f.build();
  assert.notEqual(first.items.find((i) => i.name === "alpha").area, "security");
  fs.writeFileSync(path.join(f.dir, "o.json"), JSON.stringify({ "skill:alpha": "security" }));
  assert.equal(f.build().items.find((i) => i.name === "alpha").area, "security");
});

test("the source registry is kept for the TTL and recomputed after it", () => {
  cache.reset();
  let calls = 0;
  const compute = () => ({ n: ++calls });
  let t = 1000;
  const opts = { ttlMs: 100, now: () => t };
  assert.equal(cache.cachedSources(compute, opts).n, 1);
  t += 50;
  assert.equal(cache.cachedSources(compute, opts).n, 1, "still fresh");
  t += 60;
  assert.equal(cache.cachedSources(compute, opts).n, 2, "expired");
  assert.equal(calls, 2);
});
