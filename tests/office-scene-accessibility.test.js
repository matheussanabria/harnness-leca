// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  PERFORMANCE_PROFILES,
  SCENE_STORAGE_KEY,
  clampPixelRatio,
  normalizeQuality,
  prefersReducedMotion,
  readScenePreferences,
  resolvePerformanceProfile,
  resolveScenePreferences,
  writeScenePreferences
} from "../ui/public/js/office/scene-preferences.js";
import { OfficeScenePreferences } from "../ui/public/js/office/office-scene-preferences.js";
import { FrameLoop } from "../ui/public/js/office/frame-loop.js";

const ROOT = new URL("../", import.meta.url);
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

function read(relative) {
  return readFileSync(new URL(relative, ROOT), "utf8");
}

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    }
  };
}

function fakeDocument() {
  const attributes = {};
  const elements = {};
  const makeElement = (id) => ({
    id,
    value: "",
    textContent: "",
    attributes: {},
    classes: new Set(),
    listeners: {},
    classList: {
      toggle(name, active) {
        if (active) this.owner.classes.add(name);
        else this.owner.classes.delete(name);
      }
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    removeEventListener(type) {
      delete this.listeners[type];
    },
    dispatch(type, event = {}) {
      this.listeners[type]?.(event);
    }
  });
  for (const id of ["officeQualitySelect", "btnMotionToggle", "officeLiveStatus"]) {
    const element = makeElement(id);
    element.classList.owner = element;
    elements[id] = element;
  }
  return {
    attributes,
    elements,
    documentElement: {
      setAttribute(name, value) {
        attributes[name] = String(value);
      }
    },
    getElementById(id) {
      return elements[id] || null;
    }
  };
}

function fakeWindow() {
  const media = {
    matches: false,
    listeners: [],
    addEventListener(type, handler) {
      if (type === "change") this.listeners.push(handler);
    },
    removeEventListener(type, handler) {
      if (type !== "change") return;
      this.listeners = this.listeners.filter((item) => item !== handler);
    },
    setMatches(value) {
      this.matches = value;
      for (const handler of this.listeners) handler({ matches: value });
    }
  };
  return {
    navigator: { deviceMemory: 8, hardwareConcurrency: 8 },
    media,
    matchMedia() {
      return media;
    }
  };
}

test("EP-03.09: qualidade, perfis e DPR respeitam limites seguros", () => {
  assert.deepEqual(normalizeQuality("AUTO"), "auto");
  assert.equal(normalizeQuality("invalida"), "auto");
  assert.equal(normalizeQuality(undefined), "auto");
  assert.equal(resolvePerformanceProfile({ quality: "high" }).maxPixelRatio, 2);
  assert.equal(resolvePerformanceProfile({ quality: "balanced" }).maxPixelRatio, 1.5);
  assert.equal(resolvePerformanceProfile({ quality: "low" }).shadows, false);
  assert.equal(resolvePerformanceProfile({ quality: "auto", deviceMemory: 4 }).id, "low");
  assert.equal(resolvePerformanceProfile({ quality: "auto", hardwareConcurrency: 4 }).id, "balanced");
  assert.equal(resolvePerformanceProfile({ quality: "auto", deviceMemory: 8, hardwareConcurrency: 8 }).id, "high");
  assert.equal(clampPixelRatio(3, 2), 2);
  assert.equal(clampPixelRatio(1.25, 1.5), 1.25);
  assert.equal(clampPixelRatio(0, 2), 1);
  assert.equal(clampPixelRatio("x", 2), 1);
  assert.equal(PERFORMANCE_PROFILES.low.id, "low");
});

test("EP-03.09: preferências persistem e combinam com o sistema", () => {
  const storage = fakeStorage();
  assert.deepEqual(readScenePreferences(storage), { quality: "auto", reducedMotion: false });
  assert.equal(writeScenePreferences(storage, { quality: "low", reducedMotion: true }), true);
  assert.deepEqual(readScenePreferences(storage), { quality: "low", reducedMotion: true });
  assert.deepEqual(JSON.parse(storage.getItem(SCENE_STORAGE_KEY)), { quality: "low", reducedMotion: true });
  storage.setItem(SCENE_STORAGE_KEY, "{lixo");
  assert.deepEqual(readScenePreferences(storage), { quality: "auto", reducedMotion: false });
  const state = resolveScenePreferences({
    quality: "auto",
    reducedMotion: false,
    systemReducedMotion: true,
    deviceMemory: 16,
    hardwareConcurrency: 16
  });
  assert.equal(state.reducedMotion, true);
  assert.equal(state.systemReducedMotion, true);
  assert.equal(state.profile.id, "high");
  assert.equal(prefersReducedMotion({ matchMedia: () => ({ matches: true }) }), true);
  assert.equal(prefersReducedMotion(null), false);
});

test("EP-03.09: controlador aplica, persiste e anuncia preferências", () => {
  const doc = fakeDocument();
  const win = fakeWindow();
  const storage = fakeStorage();
  const changes = [];
  const controller = new OfficeScenePreferences({
    doc,
    win,
    storage,
    onChange: (state, reason) => changes.push([state, reason])
  });
  const initial = controller.init();
  assert.equal(initial.quality, "auto");
  assert.equal(initial.profile.id, "high");
  assert.equal(doc.attributes["data-office-quality"], "high");
  assert.equal(doc.attributes["data-office-motion"], "full");
  assert.equal(doc.elements.officeQualitySelect.value, "auto");
  doc.elements.officeQualitySelect.dispatch("change", { target: { value: "low" } });
  assert.equal(doc.attributes["data-office-quality"], "low");
  assert.equal(JSON.parse(storage.getItem(SCENE_STORAGE_KEY)).quality, "low");
  assert.match(doc.elements.officeLiveStatus.textContent, /Baixa/);
  assert.equal(changes.at(-1)[1], "quality");
  doc.elements.btnMotionToggle.dispatch("click");
  assert.equal(doc.attributes["data-office-motion"], "reduce");
  assert.equal(doc.elements.btnMotionToggle.attributes["aria-pressed"], "true");
  assert.equal(doc.elements.btnMotionToggle.attributes["aria-label"], "Desativar movimento reduzido");
  assert.match(doc.elements.officeLiveStatus.textContent, /ativado/);
  assert.equal(changes.at(-1)[1], "motion");
  win.media.setMatches(true);
  assert.equal(doc.attributes["data-office-motion"], "reduce");
  assert.match(doc.elements.officeLiveStatus.textContent, /sistema/);
  controller.setQuality("balanced");
  assert.equal(doc.attributes["data-office-quality"], "balanced");
  assert.equal(doc.elements.officeQualitySelect.value, "balanced");
  controller.dispose();
});

test("EP-03.09: HTML e atalhos expõem cena acessível sem capturar Tab", () => {
  const html = read("ui/public/office.html");
  assert.match(html, /id="viewport3D" role="region" tabindex="0"/);
  assert.match(html, /id="canvas2D" role="region" tabindex="0"/);
  assert.match(html, /aria-describedby="officeSceneInstructions"/);
  assert.match(html, /id="officeLiveStatus" role="status" aria-live="polite"/);
  assert.match(html, /id="officeQualitySelect" aria-label="Qualidade de renderização da cena"/);
  assert.match(html, /id="btnMotionToggle" type="button" aria-pressed="false"/);
  assert.match(html, /<b>M<\/b> Cursor Livre/);
  assert.equal(html.includes("<b>Alt/M</b>"), false);

  const shortcuts = read("ui/public/js/office/office-shortcuts.js");
  assert.equal(shortcuts.includes('"tab"'), false);
  assert.equal(shortcuts.includes("AltLeft"), false);
  assert.match(shortcuts, /k === "m"/);
});

test("EP-03.09: motores pausam, limitam DPR e aceitam movimento reduzido", () => {
  const twoD = read("ui/public/js/office-2d.js");
  assert.match(twoD, /new FrameLoop/);
  assert.match(twoD, /setTransform\(dpr, 0, 0, dpr, 0, 0\)/);
  assert.equal(twoD.includes("ctx.scale(dpr, dpr)"), false);
  assert.match(twoD, /clampPixelRatio/);
  assert.match(twoD, /applyPerformanceProfile/);
  assert.match(twoD, /setReducedMotion/);
  assert.match(twoD, /this\.reducedMotion \? 0 : this\.time/);

  const threeD = read("ui/public/js/office-3d.js");
  assert.match(threeD, /new FrameLoop/);
  assert.match(threeD, /renderFrame/);
  assert.match(threeD, /applyPerformanceProfile/);
  assert.match(threeD, /setReducedMotion/);

  const loop = read("ui/public/js/office/frame-loop.js");
  assert.match(loop, /visibilitychange/);
  assert.match(loop, /this\.paused = true/);
  assert.match(loop, /get isRunning/);
  assert.match(loop, /this\.rafId \|\| !this\.active \|\| this\.paused \|\| this\.doc\?\.hidden/);

  const controls = read("ui/public/js/office-3d-controls.js");
  assert.match(controls, /clampPixelRatio/);
  assert.match(controls, /applyRendererQuality/);
  assert.match(controls, /shadowMap\.enabled = profile\.shadows/);

  const avatar = read("ui/public/js/office-avatar.js");
  assert.match(avatar, /this\.reducedMotion/);
  assert.match(avatar, /this\.animTime \+= this\.reducedMotion/);
});

test("EP-03.09: FrameLoop pausa em aba oculta e retoma ao voltar", () => {
  const listeners = [];
  const doc = {
    hidden: false,
    addEventListener(type, handler) {
      if (type === "visibilitychange") listeners.push(handler);
    },
    removeEventListener() {},
    dispatch() {
      for (const handler of listeners) handler();
    }
  };
  const frames = [];
  let pending = 0;
  let nextTick = null;
  let cancelled = 0;
  const loop = new FrameLoop({
    doc,
    now: () => 0,
    request: (callback) => {
      nextTick = callback;
      pending += 1;
      return pending;
    },
    cancel: () => {
      pending = Math.max(0, pending - 1);
      cancelled += 1;
    },
    onFrame: (time, dt) => frames.push({ time, dt })
  });

  loop.start();
  assert.equal(loop.isRunning, true);
  assert.equal(pending, 1);
  nextTick(100);
  assert.deepEqual(frames[0], { time: 100, dt: 0.1 });

  doc.hidden = true;
  doc.dispatch();
  assert.equal(loop.isRunning, false);
  assert.equal(cancelled, 1);

  doc.hidden = false;
  doc.dispatch();
  assert.equal(loop.isRunning, true);

  loop.stop();
  assert.equal(loop.isRunning, false);
});

test("EP-03.09: arquivos novos são pequenos e sem emojis", () => {
  const files = [
    "ui/public/js/office/scene-preferences.js",
    "ui/public/js/office/office-scene-preferences.js",
    "ui/public/js/office/frame-loop.js",
    "ui/public/css/office/17-accessibility.css"
  ];
  for (const file of files) {
    const content = read(file);
    assert.equal(EMOJI_REGEX.test(content), false, `${file} não pode ter emojis`);
    assert.ok(content.split("\n").length <= 300, `${file} passou do limite de linhas`);
  }
});
