import test from "node:test";
import assert from "node:assert/strict";
import {
  SCHEMA_VERSION,
  STORAGE_PREFIX,
  serializeLayout,
  validateAndSanitizeLayout,
  LayoutPersistenceManager
} from "../ui/public/js/window-manager/layout-persistence.js";
import { WindowStore } from "../ui/public/js/window-manager/window-store.js";

test("serializeLayout gera payload versionado com _v: 1 e dados das janelas", () => {
  const mockState = {
    windows: [
      {
        id: "win-gemini",
        moduleId: "gemini",
        projectId: "proj-1",
        resourceId: "chat-42",
        presentation: "floating",
        visibility: "visible",
        bounds: { x: 100, y: 100, width: 600, height: 400 },
        isFocused: true,
        zIndex: 1001,
        createdAt: 1000,
        updatedAt: 1000
      }
    ],
    activeWindowId: "win-gemini",
    baseZIndex: 1000,
    highestZIndex: 1001
  };

  const payload = serializeLayout(mockState, { projectId: "proj-1" });
  assert.equal(payload._v, SCHEMA_VERSION);
  assert.equal(payload.projectId, "proj-1");
  assert.equal(payload.activeWindowId, "win-gemini");
  assert.equal(payload.windows.length, 1);
  assert.equal(payload.windows[0].resourceId, "chat-42");
  assert.deepEqual(payload.windows[0].bounds, { x: 100, y: 100, width: 600, height: 400 });
});

test("validateAndSanitizeLayout rejeita versão incompatível ou payload corrompido", () => {
  const viewport = { width: 1000, height: 800 };

  // Versão antiga ou desconhecida
  const invalidVersion = { _v: 99, windows: [] };
  assert.equal(validateAndSanitizeLayout(invalidVersion, viewport), null);

  // Sem array de janelas
  const corruptPayload = { _v: 1, windows: "não-array" };
  assert.equal(validateAndSanitizeLayout(corruptPayload, viewport), null);

  // Nulo
  assert.equal(validateAndSanitizeLayout(null, viewport), null);
});

test("validateAndSanitizeLayout confina janelas extrapoladas e filtra módulos permitidos", () => {
  const viewport = { width: 800, height: 600 };
  const rawPayload = {
    _v: 1,
    updatedAt: 12345,
    projectId: "proj-2",
    windows: [
      {
        id: "win-out-of-bounds",
        moduleId: "gemini",
        bounds: { x: 1200, y: 900, width: 1000, height: 800 },
        presentation: "floating",
        visibility: "visible"
      },
      {
        id: "win-unknown-module",
        moduleId: "modulo-inexistente",
        bounds: { x: 50, y: 50, width: 300, height: 200 }
      }
    ]
  };

  const allowedModules = ["gemini", "claude"];
  const sanitized = validateAndSanitizeLayout(rawPayload, viewport, allowedModules);

  assert.ok(sanitized);
  // Deve ter filtrado modulo-inexistente
  assert.equal(sanitized?.windows.length, 1);

  // Janela extrapolada deve ter sido confinada ao viewport de 800x600
  const win = sanitized?.windows[0];
  assert.ok(win.bounds.x + win.bounds.width <= viewport.width);
  assert.ok(win.bounds.y + win.bounds.height <= viewport.height);
});

test("LayoutPersistenceManager salva, restaura e limpa estado com namespace de projeto", async () => {
  const storageMap = new Map();
  const mockStorage = {
    getItem: (k) => storageMap.get(k) || null,
    setItem: (k, v) => storageMap.set(k, v),
    removeItem: (k) => storageMap.delete(k)
  };

  const registry = await import("../ui/public/js/window-manager/window-registry.js");
  const store = new WindowStore(registry);
  const win = store.open("gemini", {
    bounds: { x: 120, y: 120, width: 500, height: 350 },
    projectId: "saude-dispensacao"
  });

  const manager = new LayoutPersistenceManager(store, mockStorage);

  // Salvar
  const saved = manager.save("saude-dispensacao");
  assert.equal(saved, true);
  assert.ok(storageMap.has(`${STORAGE_PREFIX}saude-dispensacao`));

  // Resetar store
  store.reset();
  assert.equal(store.getState().windows.length, 0);

  // Restaurar
  const restored = manager.restore("saude-dispensacao", { width: 1200, height: 900 });
  assert.equal(restored, true);
  assert.equal(store.getState().windows.length, 1);

  const restoredWin = store.get(win.id);
  assert.ok(restoredWin);
  assert.equal(restoredWin?.bounds.x, 120);

  // Limpar
  manager.clear("saude-dispensacao");
  assert.equal(storageMap.has(`${STORAGE_PREFIX}saude-dispensacao`), false);
});

test("LayoutPersistenceManager restaura resourceId e IDs reais de módulos não singleton", async () => {
  const storageMap = new Map();
  const storage = {
    getItem: (key) => storageMap.get(key) || null,
    setItem: (key, value) => storageMap.set(key, value),
    removeItem: (key) => storageMap.delete(key)
  };
  const registry = await import("../ui/public/js/window-manager/window-registry.js");
  const store = new WindowStore(registry);
  const first = store.open("studio", { resourceId: "prototype-a" });
  const second = store.open("studio", { resourceId: "prototype-b" });
  store.minimize(second.id);

  const manager = new LayoutPersistenceManager(store, storage);
  assert.equal(manager.save("projeto-layout"), true);
  store.reset();
  store.open("gemini");

  assert.equal(manager.restore("projeto-layout", { width: 1440, height: 900 }), true);
  const state = store.getState();
  assert.deepEqual(state.windows.map((win) => win.moduleId), ["studio", "studio"]);
  assert.deepEqual(state.windows.map((win) => win.resourceId), ["prototype-a", "prototype-b"]);
  assert.notEqual(state.windows[0].id, first.id);
  assert.equal(state.windows[1].visibility, "minimized");
  assert.equal(state.activeWindowId, state.windows[0].id);
});
