// EP-25.11: the server side of the SPA accepts the personal workspace (_pessoal): screen state, /api/state,
// /api/project/:slug and the Design endpoints. Reserved and unknown slugs are still rejected.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-scope-server-"));
fs.mkdirSync(path.join(dir, "alfa"), { recursive: true });
process.env.HARNESS_PROJECTS_DIR = dir;
delete process.env.HARNESS_DB_PATH;

const store = require("../ui/server/services/screen-state/store");
const { ROUTES } = require("../ui/server/routes");
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

async function get(urlPath) {
  const route = ROUTES.find((r) => r.method === "GET" && (r.path instanceof RegExp ? r.path.test(urlPath) : r.path === urlPath));
  if (!route) return { status: 404, json: { error: "no route" } };
  const params = route.path instanceof RegExp ? route.path.exec(urlPath).slice(1) : [];
  let status = 0;
  let out = "";
  const res = { writeHead: (s) => { status = s; }, setHeader() {}, end: (b) => { out = String(b || ""); } };
  await route.handler({ req: { url: urlPath, headers: {} }, res, params, url: new URL("http://x" + urlPath) });
  return { status, json: out ? JSON.parse(out) : null };
}

test("screen state is read and written for the personal workspace and stays separate from a project", () => {
  assert.equal(store.readScreenState("chats", "_pessoal").rev, 0);
  const saved = store.patchScreenState("chats", "_pessoal", { pageSize: 25 });
  assert.equal(saved.state.pageSize, 25);
  assert.equal(store.readScreenState("chats", "_pessoal").state.pageSize, 25);
  assert.notEqual(store.readScreenState("chats", "alfa").state.pageSize, 25);
  assert.ok(fs.existsSync(path.join(dir, "_pessoal", "ui-state")), "stored inside the personal workspace");
});

test("screen state still rejects reserved and unknown projects", () => {
  for (const slug of ["_template", "nao-existe"]) {
    assert.throws(() => store.readScreenState("chats", slug), (e) => e.code === "PROJECT_NOT_FOUND", slug);
  }
});

test("/api/state lists real projects only and names the personal workspace separately", async () => {
  const { status, json } = await get("/api/state");
  assert.equal(status, 200);
  assert.deepEqual(json.projects, ["alfa"]);
  assert.deepEqual(json.personal, { slug: "_pessoal", titulo: "Sem projeto" });
});

test("/api/project/:slug answers for the personal workspace and refuses reserved slugs", async () => {
  const personal = await get("/api/project/_pessoal");
  assert.equal(personal.status, 200);
  assert.equal(personal.json.slug, "_pessoal");
  assert.equal((await get("/api/project/_template")).status, 404);
  assert.equal((await get("/api/project/nao-existe")).status, 404);
});

test("the Design endpoints answer 200 for the personal workspace", async () => {
  for (const urlPath of ["/api/project/_pessoal/design/profile", "/api/project/_pessoal/design/screens", "/api/project/_pessoal/design/index"]) {
    const { status, json } = await get(urlPath);
    assert.equal(status, 200, `${urlPath}: ${JSON.stringify(json)}`);
    assert.equal(json.ok, true, urlPath);
  }
  assert.equal((await get("/api/project/nao-existe/design/profile")).status, 404);
});
