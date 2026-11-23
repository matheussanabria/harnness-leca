// EP-25.05: launcher model, client and storage (ui/web/src/features/launcher). Node strips types, so the .ts files
// are imported directly. Scenario ids (CP-nn) refer to docs/features/launcher/02-bdd.feature.
const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

const dir = path.join(__dirname, "..", "ui", "web", "src", "features", "launcher");
const load = (name) => import(pathToFileURL(path.join(dir, name)).href);

const feature = (over) => ({
  id: "x", titulo: "X", descricao: "d", escopo: "optional", icone: "fa-solid fa-star", rota: "/x", janela: "x",
  estado: "ativa", disponivel: true, motivo: "", ...over,
});

test("CP-01 features are grouped by scope in a fixed order and empty groups are dropped", async () => {
  const { groupFeatures } = await load("model.ts");
  const groups = groupFeatures([
    feature({ id: "g", escopo: "global" }), feature({ id: "c", escopo: "optional" }), feature({ id: "s", escopo: "project" }),
  ]);
  assert.deepEqual(groups.map((g) => g.escopo), ["optional", "project", "global"]);
  assert.deepEqual(groups.map((g) => g.features.map((f) => f.id)), [["c"], ["s"], ["g"]]);
  assert.deepEqual(groupFeatures([feature({ escopo: "global" })]).map((g) => g.escopo), ["global"]);
});

test("CP-01 the shipped manifest puts the creation features in the first group", async () => {
  const { groupFeatures } = await load("model.ts");
  const { FEATURES, availability } = require("../ui/server/features/manifest");
  const first = groupFeatures(availability(FEATURES, null))[0];
  assert.equal(first.escopo, "optional");
  for (const id of ["chat", "atelie", "mapa-mental", "quadro-livre", "diagramas"]) {
    assert.ok(first.features.some((f) => f.id === id), id);
  }
});

test("CP-02 a card that cannot open explains why instead of navigating", async () => {
  const { cardAction } = await load("model.ts");
  assert.deepEqual(cardAction(feature({ rota: "/diario" })), { kind: "open", rota: "/diario" });
  const blocked = cardAction(feature({ escopo: "project", disponivel: false, motivo: "Escolha um projeto para usar esta funcionalidade." }));
  assert.deepEqual(blocked, { kind: "explain", message: "Escolha um projeto para usar esta funcionalidade." });
  assert.equal(cardAction(feature({ disponivel: false, motivo: "" })).kind, "explain");
});

test("CP-04 'Sem projeto' sends the 'none' header and a project sends its slug", async () => {
  const { scopeHeaderValue } = await load("model.ts");
  assert.equal(scopeHeaderValue(null), "none");
  assert.equal(scopeHeaderValue("meus-treinos"), "meus-treinos");
  const { fetchFeatures } = await load("api.ts");
  const seen = [];
  const fetchImpl = async (url, init) => { seen.push([url, init.headers["X-Harness-Project"]]); return { ok: true, json: async () => ({ projeto: null, funcionalidades: [] }) }; };
  await fetchFeatures(null, fetchImpl);
  await fetchFeatures("meus-treinos", fetchImpl);
  assert.deepEqual(seen, [["/api/features", "none"], ["/api/features", "meus-treinos"]]);
});

test("CP-05 the picker lists 'Sem projeto' first, filters by text and wraps the highlight", async () => {
  const { buildOptions, moveHighlight } = await load("model.ts");
  const all = buildOptions(["alfa", "beta", "meus-treinos"], "");
  assert.deepEqual(all.map((o) => o.slug), [null, "alfa", "beta", "meus-treinos"]);
  assert.deepEqual(buildOptions(["alfa", "beta", "meus-treinos"], "tre").map((o) => o.slug), ["meus-treinos"]);
  assert.deepEqual(buildOptions(["alfa"], "sem").map((o) => o.slug), [null]);
  assert.deepEqual(buildOptions([], "").map((o) => o.slug), [null]);
  assert.equal(moveHighlight(3, 1, 4), 0);
  assert.equal(moveHighlight(0, -1, 4), 3);
  assert.equal(moveHighlight(2, 1, 0), 0);
});

test("CP-06 a failed request raises an error with its status, and a remembered project that vanished is dropped", async () => {
  const { fetchFeatures, fetchProjects, LauncherApiError } = await load("api.ts");
  const failing = async () => ({ ok: false, status: 404 });
  await assert.rejects(() => fetchFeatures("x", failing), (e) => e instanceof LauncherApiError && e.status === 404);
  await assert.rejects(() => fetchProjects(failing), (e) => e.status === 404);
  const { validStoredProject } = await load("model.ts");
  assert.equal(validStoredProject("alfa", ["alfa", "beta"]), "alfa");
  assert.equal(validStoredProject("sumiu", ["alfa"]), null);
  assert.equal(validStoredProject(null, ["alfa"]), null);
});

test("the legacy active project is synced through POST /api/project/active and failures never throw", async () => {
  const { syncActiveProject } = await load("api.ts");
  let seen;
  assert.equal(await syncActiveProject("alfa", async (url, init) => { seen = [url, init.method, init.body]; return { ok: true }; }), true);
  assert.deepEqual(seen, ["/api/project/active", "POST", JSON.stringify({ slug: "alfa" })]);
  assert.equal(await syncActiveProject("alfa", async () => { throw new Error("offline"); }), false);
});

test("the remembered scope survives blocked or throwing storage", async () => {
  const { loadScope, saveScope, SCOPE_STORAGE_KEY } = await load("storage.ts");
  const mem = new Map();
  const store = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  saveScope("alfa", store);
  assert.equal(mem.get(SCOPE_STORAGE_KEY), "alfa");
  assert.equal(loadScope(store), "alfa");
  saveScope(null, store);
  assert.equal(loadScope(store), null);
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("full"); }, removeItem() { throw new Error("blocked"); } };
  assert.equal(loadScope(broken), null);
  assert.doesNotThrow(() => saveScope("alfa", broken));
});
