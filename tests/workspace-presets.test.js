import test from "node:test";
import assert from "node:assert/strict";
import {
  SYSTEM_WORKSPACES,
  WORKSPACE_STORAGE_PREFIX,
  WorkspacePresetManager
} from "../ui/public/js/window-manager/workspace-presets.js";
import { WindowStore } from "../ui/public/js/window-manager/window-store.js";

test("SYSTEM_WORKSPACES fornece presets de fábrica consistentes e protegidos", () => {
  assert.equal(SYSTEM_WORKSPACES.length, 4);
  const ids = SYSTEM_WORKSPACES.map((w) => w.id);
  assert.ok(ids.includes("dev"));
  assert.ok(ids.includes("scrum"));
  assert.ok(ids.includes("ops"));
  assert.ok(ids.includes("quality"));

  for (const preset of SYSTEM_WORKSPACES) {
    assert.equal(preset.isSystem, true);
    assert.match(preset.icon, /^fa-(solid|regular) fa-/);
    assert.ok(preset.layout.windows.length >= 1);
  }
});

test("WorkspacePresetManager salva, lista e exclui workspaces customizados", () => {
  const storageMap = new Map();
  const mockStorage = {
    getItem: (k) => storageMap.get(k) || null,
    setItem: (k, v) => storageMap.set(k, v),
    removeItem: (k) => storageMap.delete(k)
  };

  const store = new WindowStore({});
  const manager = new WorkspacePresetManager(store, mockStorage);

  // Inicialmente tem apenas os presets de sistema
  const initialList = manager.listWorkspaces("proj-test");
  assert.equal(initialList.length, SYSTEM_WORKSPACES.length);

  // Salva um workspace customizado
  const created = manager.saveWorkspace("proj-test", "Foco Auditoria", "fa-solid fa-microscope");
  assert.ok(created);
  assert.equal(created?.name, "Foco Auditoria");
  assert.equal(created?.isSystem, false);

  // Lista atualizada deve conter o customizado
  const updatedList = manager.listWorkspaces("proj-test");
  assert.equal(updatedList.length, SYSTEM_WORKSPACES.length + 1);

  // Tentativa de excluir preset do sistema deve ser bloqueada
  const deletedSystem = manager.deleteWorkspace("proj-test", "dev");
  assert.equal(deletedSystem, false);

  // Exclusão do workspace customizado deve ter sucesso
  const deletedCustom = manager.deleteWorkspace("proj-test", created.id);
  assert.equal(deletedCustom, true);

  // Volta ao tamanho inicial
  assert.equal(manager.listWorkspaces("proj-test").length, SYSTEM_WORKSPACES.length);
});

test("WorkspacePresetManager carrega preset aplicando exatamente as janelas na WindowStore", async () => {
  const registry = await import("../ui/public/js/window-manager/window-registry.js");
  const store = new WindowStore(registry);
  const manager = new WorkspacePresetManager(store);

  // Abre uma janela qualquer antes
  store.open("gemini");
  assert.equal(store.getState().windows.length, 1);

  // Carrega o workspace "scrum" (deve fechar as anteriores e carregar scrum + diario)
  const loaded = manager.loadWorkspace("saude-dispensacao", "scrum", { width: 1440, height: 900 });
  assert.equal(loaded, true);

  const state = store.getState();
  assert.equal(state.windows.length, 2);
  const moduleIds = state.windows.map((w) => w.moduleId);
  assert.ok(moduleIds.includes("scrum"));
  assert.ok(moduleIds.includes("diario"));
});

test("WorkspacePresetManager remapeia IDs ao restaurar janelas não singleton", async () => {
  const registry = await import("../ui/public/js/window-manager/window-registry.js");
  const storageMap = new Map();
  const storage = {
    getItem: (key) => storageMap.get(key) || null,
    setItem: (key, value) => storageMap.set(key, value),
    removeItem: (key) => storageMap.delete(key)
  };
  const projectSlug = "projeto-multi";
  storage.setItem(`${WORKSPACE_STORAGE_PREFIX}${projectSlug}`, JSON.stringify([{
    id: "custom-multi",
    name: "Multi instancia",
    icon: "fa-solid fa-table-cells-large",
    description: "Teste de restauracao",
    isSystem: false,
    layout: {
      _v: 1,
      updatedAt: Date.now(),
      projectId: projectSlug,
      activeWindowId: "legacy-studio-a",
      windows: [
        {
          id: "legacy-studio-a",
          moduleId: "studio",
          presentation: "floating",
          visibility: "visible",
          bounds: { x: 20, y: 30, width: 500, height: 400 },
          isFocused: true
        },
        {
          id: "legacy-studio-b",
          moduleId: "studio",
          presentation: "floating",
          visibility: "minimized",
          bounds: { x: 80, y: 90, width: 520, height: 420 },
          isFocused: false
        }
      ]
    }
  }]));

  const store = new WindowStore(registry);
  const manager = new WorkspacePresetManager(store, storage);
  assert.equal(manager.loadWorkspace(projectSlug, "custom-multi", { width: 1440, height: 900 }), true);

  const state = store.getState();
  const [first, second] = state.windows;
  assert.notEqual(first.id, "legacy-studio-a");
  assert.notEqual(second.id, "legacy-studio-b");
  assert.equal(state.activeWindowId, first.id);
  assert.equal(first.isFocused, true);
  assert.equal(second.visibility, "minimized");
});
