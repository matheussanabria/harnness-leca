import test from "node:test";
import assert from "node:assert/strict";
import {
  SYSTEM_WORKSPACES,
  WORKSPACE_TEMPLATE_IDS
} from "../ui/public/js/window-manager/workspace-templates.js";
import { WorkspacePresetManager } from "../ui/public/js/window-manager/workspace-presets.js";
import { WindowStore } from "../ui/public/js/window-manager/window-store.js";

test("catálogo publica quatro templates canônicos e preserva IDs legados", () => {
  assert.deepEqual(WORKSPACE_TEMPLATE_IDS, {
    development: "dev",
    planning: "scrum",
    quality: "quality",
    operations: "ops"
  });
  assert.deepEqual(
    SYSTEM_WORKSPACES.map((template) => template.templateKey),
    ["development", "planning", "quality", "operations"]
  );
  assert.deepEqual(
    SYSTEM_WORKSPACES.map((template) => template.name),
    ["Desenvolvimento", "Planejamento", "Qualidade", "Operações"]
  );
});

test("templates são imutáveis, usam FontAwesome e somente módulos registrados", async () => {
  const registry = await import("../ui/public/js/window-manager/window-registry.js");
  const forbidden = new Set(["claude", "opencode"]);

  assert.equal(Object.isFrozen(SYSTEM_WORKSPACES), true);
  for (const template of SYSTEM_WORKSPACES) {
    assert.equal(Object.isFrozen(template), true);
    assert.equal(Object.isFrozen(template.layout), true);
    assert.equal(Object.isFrozen(template.layout.windows), true);
    assert.match(template.icon, /^fa-(solid|regular) fa-/);
    assert.ok(template.description.length > 20);
    for (const win of template.layout.windows) {
      assert.ok(registry.getModule(win.moduleId), `${win.moduleId} precisa estar registrado`);
      assert.equal(forbidden.has(win.moduleId), false);
    }
  }
  assert.throws(() => SYSTEM_WORKSPACES.push({}), TypeError);
});

test("os quatro templates carregam composição, foco e projeto corretos", async () => {
  const registry = await import("../ui/public/js/window-manager/window-registry.js");
  const store = new WindowStore(registry);
  const manager = new WorkspacePresetManager(store);
  const projectSlug = "saude-dispensacao";

  for (const template of SYSTEM_WORKSPACES) {
    assert.equal(manager.loadWorkspace(projectSlug, template.id, { width: 1440, height: 900 }), true);
    const state = store.getState();
    assert.deepEqual(
      state.windows.map((win) => win.moduleId),
      template.layout.windows.map((win) => win.moduleId)
    );
    assert.ok(state.windows.every((win) => win.projectId === projectSlug));
    const expectedActiveModule = template.layout.windows.find(
      (win) => win.id === template.layout.activeWindowId
    )?.moduleId;
    assert.equal(store.getFocusedWindow()?.moduleId, expectedActiveModule);
    assert.equal(manager.deleteWorkspace(projectSlug, template.id), false);
  }
});
