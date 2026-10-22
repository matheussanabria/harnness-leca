// @ts-check
import test from "node:test";
import assert from "node:assert/strict";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value))
};
globalThis.window = globalThis;
const bodyClasses = new Set();
globalThis.document = {
  body: {
    classList: {
      add: (c) => bodyClasses.add(c),
      remove: (c) => bodyClasses.delete(c),
      contains: (c) => bodyClasses.has(c),
      toggle: (c, on) => { (on ?? !bodyClasses.has(c)) ? bodyClasses.add(c) : bodyClasses.delete(c); return bodyClasses.has(c); }
    }
  },
  getElementById: () => null,
  addEventListener: () => {},
  removeEventListener: () => {}
};
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.dispatchEvent = () => true;
globalThis.window.addEventListener = globalThis.addEventListener;
globalThis.window.removeEventListener = globalThis.removeEventListener;
globalThis.window.dispatchEvent = globalThis.dispatchEvent;

const {
  STUDIO_VIEW_MODES,
  canSwitchStudioView,
  initStudioViews,
  normalizeStudioViewMode,
  resolveViewStorageKey,
  switchStudioView
} = await import("../ui/public/js/modules/studio-views.js");
const { sts } = await import("../ui/public/js/modules/studio-store.js");

test("EP-06.03: normaliza aliases das visualizações Código, Design, Preview e 2 Telas", () => {
  assert.equal(normalizeStudioViewMode("code"), STUDIO_VIEW_MODES.CODE);
  assert.equal(normalizeStudioViewMode("codigo"), STUDIO_VIEW_MODES.CODE);
  assert.equal(normalizeStudioViewMode("design"), STUDIO_VIEW_MODES.DESIGN);
  assert.equal(normalizeStudioViewMode("atelie"), STUDIO_VIEW_MODES.DESIGN);
  assert.equal(normalizeStudioViewMode("preview"), STUDIO_VIEW_MODES.PREVIEW);
  assert.equal(normalizeStudioViewMode(undefined), STUDIO_VIEW_MODES.PREVIEW);
  assert.equal(normalizeStudioViewMode("companion"), STUDIO_VIEW_MODES.COMPANION);
});

test("EP-06.03: alterna a visualização do preview e persiste a preferência por projeto", () => {
  sts.currentStudioMode = STUDIO_VIEW_MODES.PREVIEW;
  assert.equal(switchStudioView("design", { force: true }), true);
  assert.equal(sts.currentStudioMode, STUDIO_VIEW_MODES.DESIGN);
  assert.equal(storage.get(resolveViewStorageKey()), STUDIO_VIEW_MODES.DESIGN);
});

test("Studio: Código é a terceira coluna e não troca o modo do preview", () => {
  window.loadStudioSourceWorkspace = () => Promise.resolve();
  window.hasUnsavedStudioSource = () => false;
  bodyClasses.clear();
  sts.currentStudioMode = STUDIO_VIEW_MODES.PREVIEW;

  assert.equal(switchStudioView("code"), true);
  assert.equal(bodyClasses.has("studio-source-open"), true);
  assert.equal(sts.currentStudioMode, STUDIO_VIEW_MODES.PREVIEW, "Preview permanece visível ao abrir o código");

  assert.equal(switchStudioView("code"), true);
  assert.equal(bodyClasses.has("studio-source-open"), false);
});

test("Studio: preferência antiga 'source' vira preview com a coluna de código aberta", () => {
  bodyClasses.clear();
  storage.clear();
  initStudioViews("source");
  assert.equal(sts.currentStudioMode, STUDIO_VIEW_MODES.PREVIEW);
  assert.equal(bodyClasses.has("studio-source-open"), true);
});

test("EP-06.04: fechar a coluna com código não salvo exige confirmação", () => {
  bodyClasses.clear();
  bodyClasses.add("studio-source-open");
  window.hasUnsavedStudioSource = () => true;

  window.confirm = () => false;
  assert.equal(switchStudioView("code"), false);
  assert.equal(bodyClasses.has("studio-source-open"), true, "Coluna deve continuar aberta");

  window.confirm = () => true;
  assert.equal(switchStudioView("code"), true);
  assert.equal(bodyClasses.has("studio-source-open"), false);

  assert.equal(canSwitchStudioView("design"), true, "Trocar o preview não descarta o editor");
});
