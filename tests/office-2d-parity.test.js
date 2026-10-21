// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { OFFICE_OBJECT_CATALOG, getOfficeObjectsFor2D } from "../ui/public/js/office/office-object-catalog.js";
import { DEFAULT_GRID_CONFIG, OFFICE_2D_OBJECTS } from "../ui/public/js/office2d/map-objects.js";
import { OBJECT_RENDERERS } from "../ui/public/js/office2d/iso-object-renderers.js";
import { Player2DController } from "../ui/public/js/office2d/player-controller.js";
import { createOffice2DActionContext } from "../ui/public/js/office2d/action-bridge.js";
import { executeOfficeAction } from "../ui/public/js/office/office-action-dispatcher.js";
import { officeScreenPresets } from "../ui/public/js/office/office-screen-presets.js";

const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;
const ROOT = new URL("../", import.meta.url);

function read(relative) {
  return readFileSync(new URL(relative, ROOT), "utf8");
}

function lineCount(relative) {
  return read(relative).split(/\r?\n/).length;
}

test("EP-03.08: todo objeto 3D tem posição e renderizador no 2.5D", () => {
  const items2D = getOfficeObjectsFor2D();
  const ids2D = new Set(items2D.map((item) => item.id));

  for (const object of OFFICE_OBJECT_CATALOG) {
    assert.ok(object.position3D, `Objeto 3D sem posição: ${object.id}`);
    assert.ok(object.position2D, `Objeto sem posição 2D: ${object.id}`);
    assert.ok(ids2D.has(object.id), `Objeto ausente do catálogo 2D: ${object.id}`);
  }

  assert.equal(items2D.length, OFFICE_OBJECT_CATALOG.length);
  for (const object of OFFICE_2D_OBJECTS) {
    assert.ok(OBJECT_RENDERERS[object.id], `Sem renderizador isométrico: ${object.id}`);
  }
});

test("EP-03.08: mapa 2D usa IDs canônicos e posições dentro da grade", () => {
  for (const object of OFFICE_2D_OBJECTS) {
    if (object.id === "plant") continue;
    assert.ok(OFFICE_OBJECT_CATALOG.some((entry) => entry.id === object.id), `ID não canônico no mapa 2D: ${object.id}`);
    assert.ok(object.gx >= 0 && object.gx < DEFAULT_GRID_CONFIG.gridW, `gx fora da grade: ${object.id}`);
    assert.ok(object.gy >= 0 && object.gy < DEFAULT_GRID_CONFIG.gridH, `gy fora da grade: ${object.id}`);
  }

  const source = read("ui/public/js/office2d/map-objects.js");
  assert.ok(!source.includes("legacyIdMap"), "O mapa 2D não deve remapear IDs canônicos");
});

test("EP-03.08: contexto 2D executa assento e foco de tela canônicos", () => {
  const seated = [];
  const focused = [];
  const opened = [];
  const context = createOffice2DActionContext({
    officeState: { activeProject: "saude-dispensacao", selectObject() {} },
    windowManager: {
      open(moduleId) {
        opened.push(moduleId);
        return { id: `win-${moduleId}` };
      },
      focus() {}
    },
    onSeat: (seatId) => seated.push(seatId),
    onScreenFocus: (target, preset) => focused.push({ target, preset })
  });

  executeOfficeAction("workstation_chair", { ...context, muteSound: true });
  executeOfficeAction("war_room_user_chair", { ...context, muteSound: true });
  assert.deepEqual(seated, ["workstation_chair", "war_room_user_chair"]);

  officeScreenPresets.setPreset("war_room_main_panel", "metrics");
  const screenResult = executeOfficeAction("war_room_main_panel", { ...context, muteSound: true });
  assert.equal(screenResult.actionType, "window");
  assert.deepEqual(opened, ["orchestration"]);

  const focusContext = createOffice2DActionContext({
    onScreenFocus: (target, preset) => focused.push({ target, preset })
  });
  executeOfficeAction("big_screen", { ...focusContext, muteSound: true, preset: "prototype" });
  assert.equal(focused.at(-1).target, "big_screen");
  assert.equal(focused.at(-1).preset, "prototype");
});

test("EP-03.08: jogador senta, ignora movimento e levanta", () => {
  const controller = new Player2DController();
  controller.seatAt("workstation_chair", 7.5, 3.4, 8.4, 4.3);

  const player = controller.player;
  assert.equal(player.seated, true);
  assert.equal(player.seatId, "workstation_chair");
  assert.equal(player.gx, 7.5);

  controller.update(0.1, { w: true, a: true }, [], 12, 10);
  assert.equal(player.gx, 7.5);
  assert.equal(player.gy, 3.4);
  assert.equal(controller.nearbyObject, null);

  assert.equal(controller.standUp(), true);
  assert.equal(player.seated, false);
  assert.equal(player.targetGx, 8.4);
  assert.equal(player.targetGy, 4.3);
  assert.equal(controller.standUp(), false);
});

test("EP-03.08: arquivos novos respeitam limite, FontAwesome e ausência de emojis", () => {
  const files = [
    "ui/public/js/office2d/action-bridge.js",
    "ui/public/js/office2d/iso-object-renderers.js",
    "ui/public/js/office2d/iso-parity-furniture.js",
    "ui/public/js/office2d/map-objects.js",
    "ui/public/js/office2d/player-controller.js",
    "ui/public/js/office2d/iso-scene-renderer.js",
    "ui/public/js/office-2d.js"
  ];

  for (const file of files) {
    assert.ok(lineCount(file) <= 300, `${file} excede 300 linhas`);
    assert.ok(!EMOJI_REGEX.test(read(file)), `${file} contém emoji`);
  }

  const app = read("ui/public/js/office-2d.js");
  assert.ok(app.includes("createOffice2DActionContext"));
  assert.ok(read("ui/public/js/office2d/action-bridge.js").includes('"workstation_chair"'));
  assert.ok(read("ui/public/js/office/catalog/stations.data.js").includes("position2D"));
});
