// @ts-check
import test from "node:test";
import assert from "node:assert/strict";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value))
};
globalThis.window = globalThis;
globalThis.document = {
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

test("EP-06.03: alterna a visualização e persiste a preferência por projeto", async () => {
  window.loadStudioSourceWorkspace = () => Promise.resolve();
  sts.currentStudioMode = STUDIO_VIEW_MODES.PREVIEW;

  assert.equal(switchStudioView("code", { force: true }), true);
  assert.equal(sts.currentStudioMode, STUDIO_VIEW_MODES.CODE);
  assert.equal(storage.get(resolveViewStorageKey()), STUDIO_VIEW_MODES.CODE);

  assert.equal(switchStudioView("design", { force: true }), true);
  assert.equal(sts.currentStudioMode, STUDIO_VIEW_MODES.DESIGN);

  storage.clear();
  initStudioViews("code");
  assert.equal(sts.currentStudioMode, STUDIO_VIEW_MODES.CODE);
});

test("EP-06.04: alterações de código não salvas bloqueiam a troca de visualização", () => {
  sts.currentStudioMode = STUDIO_VIEW_MODES.CODE;
  window.hasUnsavedStudioSource = () => true;

  window.confirm = () => false;
  assert.equal(canSwitchStudioView("preview"), false);
  assert.equal(switchStudioView("preview"), false);
  assert.equal(sts.currentStudioMode, STUDIO_VIEW_MODES.CODE, "Visualização original deve ser preservada");

  window.confirm = () => true;
  assert.equal(canSwitchStudioView("preview"), true);

  window.hasUnsavedStudioSource = () => false;
  assert.equal(canSwitchStudioView("preview"), true);

  sts.currentStudioMode = STUDIO_VIEW_MODES.PREVIEW;
  assert.equal(canSwitchStudioView("preview"), true, "Trocar para o mesmo modo não exige confirmação");
});
