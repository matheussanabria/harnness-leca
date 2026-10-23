import test from "node:test";
import assert from "node:assert/strict";
import { WindowStore } from "../ui/public/js/window-manager/window-store.js";
import {
  WORKSPACE_STATE_SCHEMA_VERSION,
  WORKSPACE_STATE_STORAGE_PREFIX,
  WorkspacePersistenceManager
} from "../ui/public/js/window-manager/workspace-persistence.js";

function createStorage() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

async function createManager(project = "projeto-a") {
  const registry = await import("../ui/public/js/window-manager/window-registry.js");
  const storage = createStorage();
  const store = new WindowStore(registry);
  const manager = new WorkspacePersistenceManager(store, {
    storage,
    getProjectSlug: () => project,
    getViewport: () => ({ width: 1440, height: 900 }),
    getAllowedModuleIds: () => registry.listModules().map((module) => module.id)
  });
  return { manager, storage, store };
}

test("WorkspacePersistenceManager salva e restaura contexto composto isolado por projeto", async () => {
  const { manager, storage, store } = await createManager();
  const first = store.open("studio", { resourceId: "prototype-a" });
  const second = store.open("studio", { resourceId: "prototype-b" });
  store.minimize(second.id);

  const snapshot = manager.save({
    filters: { scrum: { status: ["doing"], query: "DIS-" } },
    resources: { studio: "prototype-a", scrum: "DIS-444" }
  });
  assert.equal(snapshot?._v, WORKSPACE_STATE_SCHEMA_VERSION);
  assert.ok(storage.values.has(`${WORKSPACE_STATE_STORAGE_PREFIX}projeto-a`));
  assert.equal(manager.restore({}, "projeto-b"), null);

  store.reset();
  store.open("gemini");
  const restored = manager.restore();
  assert.deepEqual(restored?.filters, { scrum: { status: ["doing"], query: "DIS-" } });
  assert.deepEqual(restored?.resources, { studio: "prototype-a", scrum: "DIS-444" });

  const state = store.getState();
  assert.deepEqual(state.windows.map((win) => win.moduleId), ["studio", "studio"]);
  assert.deepEqual(state.windows.map((win) => win.resourceId), ["prototype-a", "prototype-b"]);
  assert.notEqual(state.windows[0].id, first.id);
  assert.equal(state.windows[1].visibility, "minimized");
  assert.equal(state.activeWindowId, state.windows[0].id);
});

test("WorkspacePersistenceManager rejeita corrupção sem alterar janelas abertas", async () => {
  const { manager, storage, store } = await createManager();
  const current = store.open("scrum", { resourceId: "DIS-123" });
  const key = `${WORKSPACE_STATE_STORAGE_PREFIX}projeto-a`;
  storage.setItem(key, JSON.stringify({
    _v: 99,
    projectId: "projeto-a",
    layout: {},
    filters: {},
    resources: {}
  }));

  assert.equal(manager.restore(), null);
  assert.equal(store.getState().windows.length, 1);
  assert.equal(store.getState().windows[0].id, current.id);

  storage.setItem(key, "{invalido");
  assert.equal(manager.restore(), null);
  assert.equal(store.getState().windows.length, 1);
  assert.equal(manager.clear(), true);
  assert.equal(storage.values.has(key), false);
});

test("WorkspacePersistenceManager rejeita contexto não serializável e projeto vazio", async () => {
  const { manager, storage } = await createManager("");
  assert.equal(manager.save(), null);
  assert.equal(manager.restore(), null);
  assert.equal(manager.clear(), false);
  assert.equal(storage.values.size, 0);

  const scoped = await createManager("projeto-a");
  const circular = {};
  circular.self = circular;
  assert.equal(scoped.manager.save({ filters: circular }), null);
  assert.equal(scoped.storage.values.size, 0);
});

test("windowManager.persistence usa o projeto do seletor central e o storage da tela", async () => {
  const localStorage = createStorage();
  globalThis.localStorage = localStorage;
  const { projectSelection } = await import("../ui/public/js/shared/project-selection.js");
  projectSelection.configure(["Projeto-Central"]);
  await projectSelection.select("projeto-central", { syncBackend: false, notify: false });
  const { windowManager } = await import("../ui/public/js/window-manager/window-manager.js");
  const { officeSessionStorage } = await import("../ui/public/js/office/office-session-storage.js");

  windowManager.reset();
  windowManager.open("scrum", { resourceId: "DIS-444" });
  const key = `${WORKSPACE_STATE_STORAGE_PREFIX}Projeto-Central`;
  const saved = windowManager.persistence.save({ filters: { scrum: { status: "doing" } } });
  assert.equal(saved?.projectId, "Projeto-Central");
  assert.ok(officeSessionStorage.getItem(key), "grava no storage da tela do escritório");
  assert.equal(localStorage.values.has(key), false, "não grava no localStorage");
  assert.equal(typeof windowManager.persistence.restore, "function");
  assert.equal(windowManager.persistence.clear(), true);
  assert.equal(officeSessionStorage.getItem(key), null);

  delete globalThis.localStorage;
});
