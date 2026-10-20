import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import {
  ProjectSelectionStore,
  canonicalProjectSlug,
  resolveInitialProject,
} from "../ui/public/js/shared/project-selection.js";
import { UnsavedChangesRegistry } from "../ui/public/js/shared/unsaved-changes.js";

const require = createRequire(import.meta.url);

function createBrowserMocks(href = "http://localhost/") {
  const values = new Map();
  const location = { href };
  return {
    location,
    storage: {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
    },
    history: {
      replaceState: (_state, _title, url) => { location.href = String(url); },
    },
    values,
  };
}

test("resolve seleção inicial por URL, storage, backend e primeiro projeto", () => {
  const projects = ["Alpha", { slug: "Beta" }];
  assert.equal(resolveInitialProject({ projects, urlProject: "BETA", storedProject: "Alpha", serverActive: "Alpha" }), "Beta");
  assert.equal(resolveInitialProject({ projects, urlProject: "x", storedProject: "alpha", serverActive: "Beta" }), "Alpha");
  assert.equal(resolveInitialProject({ projects, urlProject: "x", storedProject: "y", serverActive: "beta" }), "Beta");
  assert.equal(resolveInitialProject({ projects, urlProject: "x", storedProject: "y", serverActive: "z" }), "Alpha");
  assert.equal(canonicalProjectSlug(projects, "aLpHa"), "Alpha");
});

test("store sincroniza backend antes de persistir e notificar a troca", async () => {
  const browser = createBrowserMocks("http://localhost/?view=scrum");
  const requests = [];
  const store = new ProjectSelectionStore({
    ...browser,
    fetchImpl: async (url, init) => {
      requests.push({ url, body: JSON.parse(init.body) });
      return { ok: true, json: async () => ({ ok: true }) };
    },
  });
  store.configure(["Alpha", "Beta"]);
  await store.select("Alpha", { syncBackend: false, notify: false });
  const events = [];
  store.subscribe((event) => events.push(event));

  assert.equal(await store.select("beta"), "Beta");
  assert.deepEqual(requests, [{ url: "/api/project/active", body: { slug: "Beta" } }]);
  assert.equal(browser.values.get("harness_active_project"), "Beta");
  assert.equal(new URL(browser.location.href).searchParams.get("p"), "Beta");
  assert.deepEqual(events, [{ slug: "Beta", previous: "Alpha" }]);
});

test("store preserva a seleção anterior quando backend rejeita ou slug não existe", async () => {
  const browser = createBrowserMocks();
  const store = new ProjectSelectionStore({
    ...browser,
    fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({ error: "indisponível" }) }),
  });
  store.configure(["Alpha", "Beta"]);
  await store.select("Alpha", { syncBackend: false, notify: false });

  await assert.rejects(store.select("Beta"), /indisponível/);
  await assert.rejects(store.select("Outro"), /inválido/);
  assert.equal(store.activeProject, "Alpha");
  assert.equal(browser.values.get("harness_active_project"), "Alpha");
});

test("store bloqueia troca com alterações não salvas e aceita confirmação explícita", async () => {
  const browser = createBrowserMocks();
  const unsaved = new UnsavedChangesRegistry();
  const store = new ProjectSelectionStore({ ...browser, unsavedChanges: unsaved });
  store.configure(["Alpha", "Beta"]);
  await store.select("Alpha", { syncBackend: false, notify: false });
  unsaved.mark("studio:source", { label: "Fonte do Studio", projectSlug: "Alpha" });

  await assert.rejects(
    store.select("Beta", { syncBackend: false }),
    (error) => error.code === "UNSAVED_CHANGES" && error.blockers.length === 1
  );
  assert.equal(store.activeProject, "Alpha");
  assert.equal(await store.select("Beta", { syncBackend: false, force: true }), "Beta");
});

test("initialize converge URL válida com backend e recua ao ativo se a API falhar", async () => {
  const browser = createBrowserMocks("http://localhost/?p=Beta");
  const store = new ProjectSelectionStore({
    ...browser,
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
  });

  assert.equal(await store.initialize({ projects: ["Alpha", "Beta"], serverActive: "Alpha" }), "Alpha");
  assert.equal(store.activeProject, "Alpha");
  assert.equal(new URL(browser.location.href).searchParams.get("p"), "Alpha");
});

test("serviço grava slug canônico de forma atômica e preserva ativo em entrada inválida", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "harness-project-selection-"));
  const previousRoot = process.env.HARNESS_ROOT;
  process.env.HARNESS_ROOT = tempRoot;
  const projectsDir = path.join(tempRoot, "projects");
  fs.mkdirSync(path.join(projectsDir, "Alpha"), { recursive: true });
  fs.mkdirSync(path.join(projectsDir, "beta"), { recursive: true });
  fs.writeFileSync(path.join(projectsDir, ".active"), "Alpha\n", "utf8");

  const service = require("../ui/server/services/project-selection.service.js");
  try {
    assert.equal(service.setActiveProject("BETA"), "beta");
    assert.equal(fs.readFileSync(path.join(projectsDir, ".active"), "utf8"), "beta\n");
    assert.throws(() => service.setActiveProject("inexistente"), { code: "INVALID_PROJECT" });
    assert.equal(fs.readFileSync(path.join(projectsDir, ".active"), "utf8"), "beta\n");
    assert.deepEqual(fs.readdirSync(projectsDir).filter((name) => name.endsWith(".tmp")), []);
  } finally {
    if (previousRoot === undefined) delete process.env.HARNESS_ROOT;
    else process.env.HARNESS_ROOT = previousRoot;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
