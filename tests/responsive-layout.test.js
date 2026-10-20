import test from "node:test";
import assert from "node:assert/strict";
import {
  getBreakpoint,
  resolvePresentationForBreakpoint,
  computeResponsiveBounds,
  ResponsiveLayoutManager
} from "../ui/public/js/window-manager/responsive-layout.js";
import { WindowStore } from "../ui/public/js/window-manager/window-store.js";

test("getBreakpoint classifica corretamente larguras em mobile, tablet e desktop", () => {
  // Mobile
  assert.equal(getBreakpoint(320), "mobile");
  assert.equal(getBreakpoint(767), "mobile");

  // Tablet
  assert.equal(getBreakpoint(768), "tablet");
  assert.equal(getBreakpoint(1023), "tablet");

  // Desktop
  assert.equal(getBreakpoint(1024), "desktop");
  assert.equal(getBreakpoint(1920), "desktop");
});

test("resolvePresentationForBreakpoint força fullscreen em mobile preservando desktop", () => {
  assert.equal(resolvePresentationForBreakpoint("floating", "mobile"), "fullscreen");
  assert.equal(resolvePresentationForBreakpoint("sidebar", "mobile"), "fullscreen");
  assert.equal(resolvePresentationForBreakpoint("floating", "desktop"), "floating");
  assert.equal(resolvePresentationForBreakpoint("sidebar", "tablet"), "sidebar");
});

test("computeResponsiveBounds calcula limites exatos para mobile, tablet e desktop", () => {
  const viewportMobile = { width: 400, height: 700 };
  const viewportTablet = { width: 900, height: 700 };
  const viewportDesktop = { width: 1400, height: 900 };

  const initialBounds = { x: 100, y: 100, width: 600, height: 400 };

  // Mobile preenche tela útil
  const mobileBounds = computeResponsiveBounds(initialBounds, "mobile", viewportMobile);
  assert.deepEqual(mobileBounds, {
    x: 0,
    y: 56,
    width: 400,
    height: 600 // 700 - 56 - 44
  });

  // Tablet centraliza
  const tabletBounds = computeResponsiveBounds(initialBounds, "tablet", viewportTablet);
  assert.equal(tabletBounds.width, 600);
  assert.equal(tabletBounds.x, Math.round((900 - 600) / 2));

  // Desktop confina limites originais
  const desktopBounds = computeResponsiveBounds(initialBounds, "desktop", viewportDesktop);
  assert.deepEqual(desktopBounds, initialBounds);
});

test("ResponsiveLayoutManager adapta janelas para mobile e restaura ao voltar para desktop", async () => {
  const registry = await import("../ui/public/js/window-manager/window-registry.js");
  const store = new WindowStore(registry);
  const win = store.open("gemini", {
    bounds: { x: 200, y: 150, width: 650, height: 450 }
  });

  const manager = new ResponsiveLayoutManager(store);

  // Inicialmente em desktop
  assert.equal(manager.getCurrentBreakpoint(), "desktop");

  // Redimensiona para mobile (375x667 - iPhone SE)
  manager.syncWindows({ width: 375, height: 667 });
  assert.equal(manager.getCurrentBreakpoint(), "mobile");

  const winMobile = store.get(win.id);
  assert.equal(winMobile?.bounds.x, 0);
  assert.equal(winMobile?.bounds.width, 375);

  // Redimensiona de volta para desktop (1440x900)
  manager.syncWindows({ width: 1440, height: 900 });
  assert.equal(manager.getCurrentBreakpoint(), "desktop");

  const winRestored = store.get(win.id);
  // Bounds originais devem ter sido restaurados
  assert.deepEqual(winRestored?.bounds, { x: 200, y: 150, width: 650, height: 450 });
});
