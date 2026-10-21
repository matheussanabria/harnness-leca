// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CAMERA_MODES,
  VIEW_MODES,
  VIEW_MODE_CATALOG,
  cameraModeForEngine,
  clearViewState,
  normalizeCameraMode,
  normalizeViewMode,
  readViewState,
  resolveViewMode,
  viewModeStorageKey,
  writeViewState
} from "../ui/public/js/office/view-modes.js";
import { OfficeViewModeController } from "../ui/public/js/office/office-view-mode.js";

const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;
const ROOT = new URL("../", import.meta.url);

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
    },
    removeItem(key) {
      map.delete(key);
    }
  };
}

const BUTTON_IDS = [
  "btnMode3rdPerson",
  "btnMode1stPerson",
  "btnModeWorkstation",
  "btnModeWarRoom",
  "btnModeOrbit",
  "btnMode2D"
];

function fakeDocument() {
  const attributes = {};
  const buttons = {};
  for (const id of BUTTON_IDS) {
    const classes = new Set(id === "btnMode3rdPerson" ? ["active"] : []);
    buttons[id] = {
      classes,
      attributes: {},
      classList: {
        toggle(name, active) {
          if (active) classes.add(name);
          else classes.delete(name);
        }
      },
      setAttribute(name, value) {
        this.attributes[name] = value;
      }
    };
  }
  return {
    attributes,
    buttons,
    documentElement: {
      setAttribute(name, value) {
        attributes[name] = value;
      }
    },
    getElementById(id) {
      return buttons[id] || null;
    }
  };
}

function fakeEngine3D() {
  return {
    calls: [],
    _mode: "third_person",
    get viewMode() {
      return this._mode;
    },
    init() {
      this.calls.push("init");
      return true;
    },
    start() {
      this.calls.push("start");
    },
    stop() {
      this.calls.push("stop");
    },
    setViewMode(mode) {
      this._mode = mode;
      this.calls.push(`camera:${mode}`);
    }
  };
}

function fakeEngine2D() {
  return {
    calls: [],
    start() {
      this.calls.push("start");
    },
    stop() {
      this.calls.push("stop");
    }
  };
}

test("EP-03.07: catálogo canônico, aliases e zero emojis", () => {
  assert.deepEqual([...VIEW_MODES], ["3d", "diorama", "2.5d"]);
  assert.equal(Object.keys(VIEW_MODE_CATALOG).length, VIEW_MODES.length);
  assert.ok(CAMERA_MODES.includes("orbit"));

  for (const mode of VIEW_MODES) {
    const item = VIEW_MODE_CATALOG[mode];
    assert.equal(item.id, mode);
    assert.ok(item.label);
    assert.ok(item.engine === "3d" || item.engine === "2.5d");
    assert.ok(item.icon.startsWith("fa-solid"));
    assert.equal(EMOJI_REGEX.test(item.label + item.hint + item.icon), false);
  }

  assert.equal(normalizeViewMode("third_person"), "3d");
  assert.equal(normalizeViewMode("war_room"), "3d");
  assert.equal(normalizeViewMode("orbit"), "diorama");
  assert.equal(normalizeViewMode("2d"), "2.5d");
  assert.equal(normalizeViewMode("isometric"), "2.5d");
  assert.equal(normalizeViewMode("desconhecido"), "3d");
  assert.equal(normalizeCameraMode("war_room_seated"), "war_room_seated");
  assert.equal(normalizeCameraMode("invalida"), "third_person");
});

test("EP-03.07: resolve alias legado com a câmera correspondente", () => {
  assert.equal(resolveViewMode("orbit").mode, "diorama");
  assert.equal(resolveViewMode("orbit").cameraMode, "orbit");
  assert.equal(resolveViewMode("first_person").mode, "3d");
  assert.equal(resolveViewMode("first_person").cameraMode, "first_person");
  assert.equal(resolveViewMode("2d").mode, "2.5d");
  assert.equal(resolveViewMode("2d").cameraMode, undefined);
  assert.equal(cameraModeForEngine("war_room"), "third_person");
  assert.equal(cameraModeForEngine("war_room_seated"), "third_person");
  assert.equal(cameraModeForEngine("workstation"), "workstation");
});

test("EP-03.07: persistência isolada por projeto e leitura tolerante", () => {
  const storage = fakeStorage();
  const key = viewModeStorageKey("saude-dispensacao");
  assert.equal(key, "dai_office_view_mode:saude-dispensacao");

  assert.equal(readViewState(storage, "saude-dispensacao"), null);
  assert.equal(writeViewState(storage, "saude-dispensacao", { mode: "diorama", cameraMode: "first_person" }), true);
  assert.deepEqual(readViewState(storage, "saude-dispensacao"), { mode: "diorama", cameraMode: "first_person" });
  assert.equal(readViewState(storage, "outro-projeto"), null);

  storage.setItem(key, "{lixo");
  assert.equal(readViewState(storage, "saude-dispensacao"), null);
  storage.setItem(key, JSON.stringify({ mode: "2d" }));
  assert.deepEqual(readViewState(storage, "saude-dispensacao"), { mode: "2.5d", cameraMode: "third_person" });

  assert.equal(clearViewState(storage, "saude-dispensacao"), true);
  assert.equal(readViewState(storage, "saude-dispensacao"), null);
});

test("EP-03.07: 3D para diorama preserva a última câmera e o motor", async () => {
  const doc = fakeDocument();
  const storage = fakeStorage();
  const engine3d = fakeEngine3D();
  const engine2d = fakeEngine2D();
  const cameraCalls = [];
  const controller = new OfficeViewModeController({
    engines: { "3d": engine3d, "2.5d": engine2d },
    doc,
    storage,
    getProject: () => "saude-dispensacao",
    onCameraMode: (cameraMode, engineCamera) => cameraCalls.push([cameraMode, engineCamera])
  });

  await controller.switchTo("3d", { cameraMode: "first_person" });
  const snapshot = await controller.switchTo("diorama");

  assert.equal(snapshot.mode, "diorama");
  assert.equal(snapshot.cameraMode, "orbit");
  assert.equal(snapshot.lastCameraMode, "first_person");
  assert.equal(engine3d.calls.includes("stop"), false);
  assert.equal(engine3d.viewMode, "orbit");
  assert.deepEqual(cameraCalls.at(-1), ["orbit", "orbit"]);
  assert.equal(doc.attributes["data-office-view"], "diorama");
  assert.equal(doc.attributes["data-office-camera"], "orbit");
  assert.equal(doc.buttons.btnModeOrbit.attributes["aria-pressed"], "true");
  assert.equal(doc.buttons.btnMode3rdPerson.attributes["aria-pressed"], "false");

  await controller.switchTo("3d");
  assert.equal(engine3d.viewMode, "first_person");
  assert.equal(doc.buttons.btnMode1stPerson.attributes["aria-pressed"], "true");
});

test("EP-03.07: 2.5D para 3D troca motores e restaura a câmera", async () => {
  const doc = fakeDocument();
  const engine3d = fakeEngine3D();
  const engine2d = fakeEngine2D();
  const controller = new OfficeViewModeController({
    engines: { "3d": engine3d, "2.5d": engine2d },
    doc,
    storage: fakeStorage(),
    getProject: () => "projeto"
  });

  await controller.switchTo("3d", { cameraMode: "workstation" });
  await controller.switchTo("2.5d");

  assert.equal(engine3d.calls.includes("stop"), true);
  assert.equal(engine2d.calls.includes("start"), true);
  assert.equal(doc.attributes["data-office-view"], "2.5d");
  assert.equal(doc.buttons.btnMode2D.attributes["aria-pressed"], "true");

  await controller.switchTo("3d");
  assert.equal(engine2d.calls.includes("stop"), true);
  assert.equal(engine3d.viewMode, "workstation");
  assert.equal(doc.buttons.btnModeWorkstation.attributes["aria-pressed"], "true");
});

test("EP-03.07: restore aplica modo e câmera salvos do projeto", async () => {
  const doc = fakeDocument();
  const storage = fakeStorage();
  const engine3d = fakeEngine3D();
  const engine2d = fakeEngine2D();
  writeViewState(storage, "saude-dispensacao", { mode: "diorama", cameraMode: "first_person" });

  const controller = new OfficeViewModeController({
    engines: { "3d": engine3d, "2.5d": engine2d },
    doc,
    storage,
    getProject: () => "saude-dispensacao"
  });

  const snapshot = await controller.restore();
  assert.equal(snapshot.mode, "diorama");
  assert.equal(snapshot.lastCameraMode, "first_person");
  assert.equal(engine3d.viewMode, "orbit");

  await controller.switchTo("3d");
  assert.equal(engine3d.viewMode, "first_person");
});

test("EP-03.07: sala de guerra aplica gancho de posição sem perder o modo", async () => {
  const doc = fakeDocument();
  const engine3d = fakeEngine3D();
  const cameraCalls = [];
  const controller = new OfficeViewModeController({
    engines: { "3d": engine3d },
    doc,
    storage: fakeStorage(),
    getProject: () => "projeto",
    onCameraMode: (cameraMode, engineCamera) => cameraCalls.push([cameraMode, engineCamera])
  });

  await controller.switchTo("war_room");
  assert.deepEqual(cameraCalls.at(-1), ["war_room", "third_person"]);
  assert.equal(engine3d.viewMode, "third_person");
  assert.equal(doc.buttons.btnModeWarRoom.attributes["aria-pressed"], "true");
  assert.equal(controller.getCameraMode(), "war_room");
});

test("EP-03.07: falta de motor não lança e mantém o estado anterior", async () => {
  const doc = fakeDocument();
  const errors = [];
  const controller = new OfficeViewModeController({
    engines: { "3d": fakeEngine3D() },
    doc,
    storage: fakeStorage(),
    getProject: () => "projeto",
    onError: (error) => errors.push(error.message)
  });

  const result = await controller.switchTo("2.5d");
  assert.equal(result, null);
  assert.equal(controller.getMode(), "3d");
  assert.equal(errors.length, 1);
  assert.match(errors[0], /2\.5d/);
});

test("EP-03.07: app, HTML e novos módulos respeitam FontAwesome e limite de linhas", () => {
  const files = [
    "ui/public/js/office/view-modes.js",
    "ui/public/js/office/office-view-mode.js",
    "ui/public/css/office/16-view-modes.css"
  ];
  for (const file of files) {
    const content = read(file);
    assert.equal(EMOJI_REGEX.test(content), false, `${file} não pode ter emojis`);
    assert.ok(content.split("\n").length <= 300, `${file} passou do limite de linhas`);
  }

  const app = read("ui/public/js/office-app.js");
  assert.equal(EMOJI_REGEX.test(app), false, "office-app.js não pode ter emojis");
  assert.match(app, /viewModeController\.restore\(\)/);
  assert.match(app, /switchTo\("diorama"\)/);
  assert.match(app, /switchTo\("2\.5d"\)/);

  const html = read("ui/public/office.html");
  const modeBar = html.slice(html.indexOf("mode-toggle-group"), html.indexOf("bottomHintText"));
  assert.equal(EMOJI_REGEX.test(modeBar), false, "botões de modo devem usar FontAwesome");
  assert.match(modeBar, /fa-solid fa-layer-group/);
  assert.equal((html.match(/aria-pressed=/g) || []).length >= 6, true);
});
