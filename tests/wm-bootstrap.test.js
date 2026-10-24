// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import { WindowStore } from "../ui/public/js/window-manager/window-store.js";
import * as registry from "../ui/public/js/window-manager/window-registry.js";
import { LayoutPersistenceManager, STORAGE_PREFIX } from "../ui/public/js/window-manager/layout-persistence.js";
import { createWindowManagerBootstrap } from "../ui/public/js/window-manager/wm-bootstrap.js";

function createStorage() {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

function createManager() {
  const listeners = new Set();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit() {
      listeners.forEach((listener) => listener());
    },
    listenerCount() {
      return listeners.size;
    }
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("bootstrap restaura o layout do projeto no boot e ignora storage corrompido", () => {
  const storage = createStorage();
  const source = new WindowStore(registry);
  source.open("gemini", { bounds: { x: 10, y: 60, width: 400, height: 300 } });
  source.open("scrum", { bounds: { x: 420, y: 60, width: 500, height: 400 } });
  new LayoutPersistenceManager(source, storage).save("projeto-a");

  const target = new WindowStore(registry);
  const manager = createManager();
  const bootstrap = createWindowManagerBootstrap({
    manager,
    store: target,
    storage,
    getProjectSlug: () => "projeto-a",
    getViewport: () => ({ width: 1280, height: 800 }),
    debounceMs: 5
  });

  bootstrap.start("projeto-a");
  assert.deepEqual(
    target.getState().windows.map((win) => win.moduleId),
    ["gemini", "scrum"]
  );
  bootstrap.dispose();

  const key = `${STORAGE_PREFIX}projeto-a`;
  storage.setItem(key, "{corrompido");
  const corruptStore = new WindowStore(registry);
  const corruptBootstrap = createWindowManagerBootstrap({
    manager: createManager(),
    store: corruptStore,
    storage,
    getProjectSlug: () => "projeto-a",
    getViewport: () => ({ width: 1280, height: 800 }),
    debounceMs: 5
  });

  assert.equal(corruptBootstrap.restore("projeto-a"), false);
  assert.equal(corruptStore.getState().windows.length, 0);
  corruptBootstrap.dispose();
});

test("bootstrap salva de forma debounced quando uma janela muda", async () => {
  const storage = createStorage();
  const store = new WindowStore(registry);
  const manager = createManager();
  const bootstrap = createWindowManagerBootstrap({
    manager,
    store,
    storage,
    getProjectSlug: () => "projeto-b",
    getViewport: () => ({ width: 1024, height: 768 }),
    debounceMs: 5
  });

  bootstrap.start("projeto-b");
  store.open("studio");
  manager.emit();
  assert.equal(storage.values.size, 0, "ainda não gravou antes do debounce");

  await delay(25);
  const key = `${STORAGE_PREFIX}projeto-b`;
  assert.ok(storage.getItem(key), "grava o layout após o debounce");

  const payload = JSON.parse(storage.getItem(key) || "{}");
  assert.equal(payload.projectId, "projeto-b");
  assert.deepEqual(payload.windows.map((win) => win.moduleId), ["studio"]);

  bootstrap.dispose();
  assert.equal(manager.listenerCount(), 0);
});

test("bootstrap instancia o gerenciador responsivo uma vez e o desanexa no dispose", () => {
  const listeners = new Map();
  const fakeWindow = {
    innerWidth: 390,
    innerHeight: 780,
    addEventListener: (type, handler) => listeners.set(type, handler),
    removeEventListener: (type) => listeners.delete(type)
  };
  const bootstrap = createWindowManagerBootstrap({
    manager: createManager(),
    store: new WindowStore(registry),
    storage: createStorage(),
    getProjectSlug: () => "projeto-c",
    win: fakeWindow
  });

  assert.ok(bootstrap.responsiveLayout);
  assert.equal(bootstrap.responsiveLayout.getCurrentBreakpoint(), "mobile");
  bootstrap.start("projeto-c");
  assert.ok(listeners.has("resize"));
  bootstrap.dispose();
  assert.equal(listeners.has("resize"), false);
});

test("bootstrap não grava sem projeto ativo", () => {
  const storage = createStorage();
  const bootstrap = createWindowManagerBootstrap({
    manager: createManager(),
    store: new WindowStore(registry),
    storage,
    getProjectSlug: () => "",
    win: undefined
  });

  assert.equal(bootstrap.saveNow(), false);
  assert.equal(bootstrap.restore(), false);
  assert.equal(storage.values.size, 0);
});
