// @ts-check
// A tela do Design lembrada no F5 vem da propria aba (sessionStorage), nao do estado unico do servidor.
import test from "node:test";
import assert from "node:assert/strict";

const store = new Map();
globalThis.sessionStorage = /** @type {any} */ ({
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
});
globalThis.localStorage = /** @type {any} */ ({ getItem: () => null, setItem() {}, removeItem() {} });

const mod = await import("../ui/public/js/modules/design-view-state.js");

test("a aba reabre a tela que ela mesma mostrou por ultimo", async () => {
  mod.persistDesignView("canvas-mindmap", true);
  assert.deepEqual(await mod.restoredDesignState(), { view: "canvas-mindmap", open: true });
  mod.persistDesignView("board", false);
  assert.deepEqual(await mod.restoredDesignState(), { view: "board", open: false });
});

test("valor invalido na aba e ignorado", async () => {
  store.set("harness:tab-design", JSON.stringify({ view: "../x", open: true }));
  assert.equal(mod.validDesignView("../x"), "");
});
