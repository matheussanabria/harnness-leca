// "Sessões sem projeto": the store the sync fills, the association through an alias, and the HTTP endpoints.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { removeDir } = require("./helpers/temp-dir");

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "harness-unmatched-"));
process.env.HARNESS_ROOT = TMP_ROOT;
process.env.HARNESS_ENGINE_HOST = "0";
for (const p of ["_template", "demo"]) fs.mkdirSync(path.join(TMP_ROOT, "projects", p), { recursive: true });
fs.mkdirSync(path.join(TMP_ROOT, "global"), { recursive: true });
fs.writeFileSync(path.join(TMP_ROOT, "projects", ".active"), "demo\n");

const store = require("../tools/lib/unmatched-store");
const { projectFromPath, matchers } = require("../tools/lib/projects");
const { createServer } = require("../ui/server");

const sources = () => JSON.parse(fs.readFileSync(path.join(TMP_ROOT, "projects", ".sources.json"), "utf8"));

let server, base;
test.before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => {
  server.closeAllConnections();
  server.close();
  require("../ui/server/db/connection").closeDb();
  await new Promise((resolve) => setTimeout(resolve, 250));
  removeDir(TMP_ROOT);
});
const post = (p, body) => fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify(body) });

test("record replaces the entries of the scanned engines and keeps the others", () => {
  assert.deepEqual(store.list(), []);
  store.record({ codex: ["SDLC", "SDLC", "o-x20"], claude: ["c--old"] });
  assert.deepEqual(store.list().map((i) => `${i.engine}:${i.name}`).sort(), ["claude:c--old", "codex:SDLC", "codex:o-x20"]);
  store.record({ codex: ["SDLC"] }); // codex rescanned: o-x20 is gone; claude was not scanned and stays
  assert.deepEqual(store.list().map((i) => `${i.engine}:${i.name}`).sort(), ["claude:c--old", "codex:SDLC"]);
  store.record({ claude: [] }); // an empty scan clears that engine
  assert.deepEqual(store.list().map((i) => i.engine), ["codex"]);
});

test("GET /api/unmatched lists the entries and the projects to choose from", async () => {
  const body = await (await fetch(`${base}/api/unmatched`)).json();
  assert.deepEqual(body.items.map((i) => i.name), ["SDLC"]);
  assert.deepEqual(body.projects, ["demo"]);
});

test("associate validates the project and only accepts what the sync recorded", async () => {
  assert.equal((await post("/api/unmatched/associate", { engine: "codex", name: "SDLC", slug: "nope" })).status, 404);
  assert.equal((await post("/api/unmatched/associate", { engine: "codex", name: "invented", slug: "demo" })).status, 404);
  assert.equal((await post("/api/unmatched/associate", { engine: "codex", name: "SDLC" })).status, 400);
  assert.equal(fs.existsSync(path.join(TMP_ROOT, "projects", ".sources.json")), false, "refusals write nothing");
});

test("associate adds the alias, so the next sync maps the folder to the project, and clears the entry", async () => {
  assert.equal(projectFromPath("C:\\work\\SDLC", matchers()), null);
  const res = await post("/api/unmatched/associate", { engine: "codex", name: "SDLC", slug: "demo" });
  assert.equal(res.status, 200);
  assert.deepEqual(sources(), { demo: ["SDLC"] });
  assert.equal(projectFromPath("C:\\work\\SDLC", matchers()), "demo");
  assert.deepEqual(store.list(), []);
  const again = await post("/api/unmatched/associate", { engine: "codex", name: "SDLC", slug: "demo" });
  assert.equal(again.status, 404, "already associated");
});

test("an existing alias list is extended without duplicates or losing entries", () => {
  fs.writeFileSync(path.join(TMP_ROOT, "projects", ".sources.json"), JSON.stringify({ demo: ["keep", "sdlc"] }));
  store.record({ codex: ["SDLC", "other"] });
  assert.equal(store.associate({ engine: "codex", name: "SDLC", slug: "demo" }).ok, true);
  assert.deepEqual(sources().demo, ["keep", "sdlc"], "case-insensitive duplicate is not added");
  assert.equal(store.associate({ engine: "codex", name: "other", slug: "demo" }).ok, true);
  assert.deepEqual(sources().demo, ["keep", "sdlc", "other"]);
});

test("the overview page wires the panel with accessible markup and no emojis", () => {
  const pub = path.join(__dirname, "..", "ui", "public");
  const html = fs.readFileSync(path.join(pub, "overview.html"), "utf8");
  assert.match(html, /id="unmatchedCard"[^>]*hidden/);
  assert.match(html, /id="unmatchedMsg"[^>]*aria-live="polite"/);
  assert.match(html, /src="\/js\/overview-unmatched\.js"/);
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(fs.readFileSync(path.join(pub, "js", "overview-unmatched.js"), "utf8")));
});
