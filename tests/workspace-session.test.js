import test from "node:test";
import assert from "node:assert/strict";
import { WorkspacePresetManager, SYSTEM_WORKSPACES } from "../ui/public/js/window-manager/workspace-presets.js";
import { WorkspaceSession } from "../ui/public/js/window-manager/workspace-session.js";
import { WindowStore } from "../ui/public/js/window-manager/window-store.js";

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

async function createSession(getProjectSlug, assertTransition) {
  const registry = await import("../ui/public/js/window-manager/window-registry.js");
  const store = new WindowStore(registry);
  const manager = new WorkspacePresetManager(store, createStorage());
  const session = new WorkspaceSession(manager, {
    getProjectSlug,
    getViewport: () => ({ width: 1366, height: 768 }),
    assertTransition
  });
  return { session, store };
}

test("WorkspaceSession rejeita operacoes sem projeto valido", async () => {
  const { session } = await createSession(() => "");
  let notifications = 0;
  session.subscribe(() => { notifications += 1; });

  assert.deepEqual(session.list(), []);
  assert.equal(session.save("Sem projeto"), null);
  assert.equal(session.load("dev"), false);
  assert.equal(session.delete("dev"), false);
  assert.equal(notifications, 0);
});

test("WorkspaceSession isola layouts e estado ativo por projeto", async () => {
  let activeProject = "projeto-a";
  const { session, store } = await createSession(() => activeProject);
  store.open("gemini");

  const snapshots = [];
  session.subscribe((state) => snapshots.push(state));
  const created = session.save("Foco A", "fa-solid fa-crosshairs");

  assert.ok(created);
  assert.equal(session.getState().activeWorkspaceId, created.id);
  assert.equal(session.list().length, SYSTEM_WORKSPACES.length + 1);
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].projectSlug, "projeto-a");

  activeProject = "projeto-b";
  assert.equal(session.list().length, SYSTEM_WORKSPACES.length);
  assert.equal(session.getState().activeWorkspaceId, null);
  assert.equal(session.delete("dev"), false);
  assert.equal(snapshots.length, 1);

  assert.equal(session.load("scrum"), true);
  assert.equal(session.getState().activeWorkspaceId, "scrum");
  assert.equal(snapshots.length, 2);
});

test("WorkspaceSession notifica CRUD valido e limpa workspace excluido", async () => {
  const { session, store } = await createSession(() => "projeto-a");
  store.open("scrum");
  const snapshots = [];
  const unsubscribe = session.subscribe((state) => snapshots.push(state));

  const created = session.save("Planejamento");
  assert.ok(created);
  assert.equal(session.delete(created.id), true);
  assert.equal(snapshots.at(-1).activeWorkspaceId, null);
  assert.equal(session.delete(created.id), false);
  assert.equal(snapshots.length, 2);

  unsubscribe();
  assert.equal(session.load("dev"), true);
  assert.equal(snapshots.length, 2);
});

test("WorkspaceSession bloqueia troca suja e permite bypass confirmado", async () => {
  let blocked = true;
  const { session } = await createSession(
    () => "projeto-a",
    () => { if (blocked) throw Object.assign(new Error("não salvo"), { code: "UNSAVED_CHANGES" }); }
  );

  assert.throws(() => session.load("dev"), { code: "UNSAVED_CHANGES" });
  assert.equal(session.getState().activeWorkspaceId, null);
  assert.equal(session.load("dev", undefined, undefined, { force: true }), true);
  assert.equal(session.getState().activeWorkspaceId, "dev");

  blocked = false;
  assert.equal(session.load("scrum"), true);
});

test("windowManager.workspaces usa o projeto do seletor central", async () => {
  const { projectSelection } = await import("../ui/public/js/shared/project-selection.js");
  const { windowManager } = await import("../ui/public/js/window-manager/window-manager.js");
  projectSelection.configure(["Projeto-Central"]);
  await projectSelection.select("projeto-central", { syncBackend: false, notify: false });

  const state = windowManager.workspaces.getState();
  assert.equal(state.projectSlug, "Projeto-Central");
  assert.equal(windowManager.workspaces.list().length, SYSTEM_WORKSPACES.length);
  assert.equal(typeof windowManager.workspaces.save, "function");
  assert.equal(typeof windowManager.workspaces.load, "function");
  assert.equal(typeof windowManager.workspaces.delete, "function");
  assert.equal(typeof windowManager.workspaces.subscribe, "function");
  assert.equal(typeof windowManager.unsaved.mark, "function");
  assert.equal(typeof windowManager.unsaved.clear, "function");
  assert.equal(typeof windowManager.unsaved.list, "function");

  windowManager.unsaved.mark("test:workspace", {
    label: "Edição de teste",
    projectSlug: state.projectSlug
  });
  assert.throws(() => windowManager.workspaces.load("dev"), { code: "UNSAVED_CHANGES" });
  windowManager.unsaved.clear("test:workspace");
  assert.equal(windowManager.workspaces.load("dev"), true);
});
