import test from "node:test";
import assert from "node:assert/strict";
import {
  computeDockBounds,
  detectDockZone,
  TabGroupManager,
  DockingManager
} from "../ui/public/js/window-manager/docking-manager.js";
import { WindowStore } from "../ui/public/js/window-manager/window-store.js";

test("computeDockBounds calcula corretamente os limites para cada zona", () => {
  const viewport = { width: 1000, height: 800 };
  const options = { topOffset: 50, bottomOffset: 50, splitRatio: 0.5 };
  // usableHeight = 800 - 50 - 50 = 700; usableWidth = 1000

  // Left
  const leftBounds = computeDockBounds("left", viewport, options);
  assert.deepEqual(leftBounds, { x: 0, y: 50, width: 500, height: 700 });

  // Right
  const rightBounds = computeDockBounds("right", viewport, options);
  assert.deepEqual(rightBounds, { x: 500, y: 50, width: 500, height: 700 });

  // Top
  const topBounds = computeDockBounds("top", viewport, options);
  assert.deepEqual(topBounds, { x: 0, y: 50, width: 1000, height: 350 });

  // Bottom
  const bottomBounds = computeDockBounds("bottom", viewport, options);
  assert.deepEqual(bottomBounds, { x: 0, y: 400, width: 1000, height: 350 });

  // Maximize
  const maxBounds = computeDockBounds("maximize", viewport, options);
  assert.deepEqual(maxBounds, { x: 0, y: 50, width: 1000, height: 700 });
});

test("detectDockZone identifica corretamente a borda de snap", () => {
  const viewport = { width: 1200, height: 800 };
  const threshold = 20;

  // Borda esquerda
  assert.equal(detectDockZone({ clientX: 10, clientY: 400 }, viewport, threshold), "left");

  // Borda direita
  assert.equal(detectDockZone({ clientX: 1190, clientY: 400 }, viewport, threshold), "right");

  // Borda superior
  assert.equal(detectDockZone({ clientX: 600, clientY: 10 }, viewport, threshold), "maximize");

  // Borda inferior
  assert.equal(detectDockZone({ clientX: 600, clientY: 790 }, viewport, threshold), "bottom");

  // Centro da tela (sem dock)
  assert.equal(detectDockZone({ clientX: 600, clientY: 400 }, viewport, threshold), "none");
});

test("TabGroupManager gerencia criação, adição, alternância e remoção de abas", () => {
  const mgr = new TabGroupManager();

  // Criação do grupo
  const group = mgr.createGroup("group-1", ["win-a", "win-b"], "win-a");
  assert.equal(group.id, "group-1");
  assert.deepEqual(group.tabs, ["win-a", "win-b"]);
  assert.equal(group.activeTab, "win-a");

  // Adição de nova aba
  mgr.addTab("group-1", "win-c");
  assert.equal(mgr.getGroup("group-1")?.tabs.length, 3);

  // Alternância de aba ativa
  const activated = mgr.setActiveTab("group-1", "win-c");
  assert.equal(activated, true);
  assert.equal(mgr.getGroup("group-1")?.activeTab, "win-c");

  // Busca por janela
  const found = mgr.findGroupByWindowId("win-b");
  assert.equal(found?.id, "group-1");

  // Remoção de aba ativa reatribui para a próxima
  mgr.removeTab("group-1", "win-c");
  assert.equal(mgr.getGroup("group-1")?.activeTab, "win-a");

  // Remoção de todas as abas destroi o grupo
  mgr.removeTab("group-1", "win-a");
  mgr.removeTab("group-1", "win-b");
  assert.equal(mgr.getGroup("group-1"), null);
});

test("DockingManager acopla e restaura (undock) dimensões de janelas", async () => {
  const registry = await import("../ui/public/js/window-manager/window-registry.js");
  const store = new WindowStore(registry);
  const win = store.open("gemini", {
    bounds: { x: 100, y: 100, width: 400, height: 300 }
  });

  const docking = new DockingManager(store);
  const viewport = { width: 1000, height: 800 };

  // Dock à esquerda
  const docked = docking.dock(win.id, "left", viewport);
  assert.equal(docked, true);
  assert.equal(docking.getDockZone(win.id), "left");

  const winDocked = store.get(win.id);
  assert.equal(winDocked?.bounds.x, 0);
  assert.equal(winDocked?.bounds.width, 500);

  // Undock restaura exatamente as dimensões originais
  const undocked = docking.undock(win.id);
  assert.equal(undocked, true);
  assert.equal(docking.getDockZone(win.id), null);

  const winRestored = store.get(win.id);
  assert.deepEqual(winRestored?.bounds, { x: 100, y: 100, width: 400, height: 300 });
});
