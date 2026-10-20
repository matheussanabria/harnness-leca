// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  officeScreenPresets,
  SCREEN_PRESETS,
  DEFAULT_SCREEN_PRESETS,
  OfficeScreenPresetManager
} from "../ui/public/js/office/office-screen-presets.js";
import { executeOfficeAction } from "../ui/public/js/office/office-action-dispatcher.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

test("EP-03.04: Catálogo canônico de presets de telão e ausência de emojis", () => {
  assert.ok(Array.isArray(SCREEN_PRESETS));
  assert.equal(SCREEN_PRESETS.length, 5);

  const expectedIds = ["kanban", "orchestration", "metrics", "prototype", "terminal"];
  for (const id of expectedIds) {
    const p = SCREEN_PRESETS.find(item => item.id === id);
    assert.ok(p, `Preset ${id} deve existir no catálogo`);
    assert.ok(p.name, `Preset ${id} deve ter nome`);
    assert.ok(p.icon.startsWith("fa-solid"), `Preset ${id} deve usar ícone FontAwesome (fa-solid)`);
    assert.equal(EMOJI_REGEX.test(p.name), false, `Nome de ${id} não pode conter emojis`);
    assert.equal(EMOJI_REGEX.test(p.description), false, `Descrição de ${id} não pode conter emojis`);
  }
});

test("EP-03.04: Gerenciador de presets, isolamento por tela e ciclo", () => {
  const manager = new OfficeScreenPresetManager();

  // Presets iniciais
  assert.equal(manager.getPreset("big_screen"), "kanban");
  assert.equal(manager.getPreset("war_room_main_panel"), "orchestration");
  assert.equal(manager.getPreset("server_monitor"), "metrics");

  // Notificação via subscribe
  const events = [];
  const unsubscribe = manager.subscribe(evt => events.push(evt));

  // Alteração válida
  const ok = manager.setPreset("big_screen", "metrics");
  assert.equal(ok, true);
  assert.equal(manager.getPreset("big_screen"), "metrics");
  assert.equal(events.length, 1);
  assert.equal(events[0].screenId, "big_screen");
  assert.equal(events[0].presetId, "metrics");

  // Rejeição de preset inexistente
  const invalid = manager.setPreset("big_screen", "inexistente");
  assert.equal(invalid, false);
  assert.equal(manager.getPreset("big_screen"), "metrics");
  assert.equal(events.length, 1);

  // Ciclo sequencial
  const nextPreset = manager.cyclePreset("big_screen");
  assert.equal(nextPreset, "prototype");
  assert.equal(manager.getPreset("big_screen"), "prototype");

  unsubscribe();
  manager.setPreset("big_screen", "terminal");
  assert.equal(events.length, 2, "Não deve receber eventos após unsubscribe");
});

test("EP-03.04: Despachante executeOfficeAction integrado com presets de tela", () => {
  officeScreenPresets.reset();

  let focusedScreen = null;
  let focusedPreset = null;
  const mockContext = {
    toggleScreenFocus: (target, preset) => {
      focusedScreen = target;
      focusedPreset = preset;
    }
  };

  // Disparo de ação com preset explícito
  const res1 = executeOfficeAction("big_screen", mockContext, { preset: "orchestration" });
  assert.equal(res1.success, true);
  assert.equal(res1.actionType, "screen_focus");
  assert.equal(res1.preset, "orchestration");
  assert.equal(focusedScreen, "big_screen");
  assert.equal(focusedPreset, "orchestration");
  assert.equal(officeScreenPresets.getPreset("big_screen"), "orchestration");

  // Disparo de ciclo de preset
  const res2 = executeOfficeAction("big_screen", mockContext, { cyclePreset: true });
  assert.equal(res2.success, true);
  assert.equal(res2.preset, "metrics");
  assert.equal(officeScreenPresets.getPreset("big_screen"), "metrics");
});

test("EP-03.04: Proibição estrita de emojis e limite de linhas nos arquivos de tela", () => {
  const targetFiles = [
    "ui/public/js/office/office-screen-presets.js",
    "ui/public/js/office-screen.js",
    "ui/public/js/office-screen-views.js",
    "ui/public/js/office-screen-57.js",
    "ui/public/js/office3d/browser-screen.js"
  ];

  for (const relPath of targetFiles) {
    const fullPath = path.join(rootDir, relPath);
    assert.ok(fs.existsSync(fullPath), `Arquivo deve existir: ${relPath}`);

    const content = fs.readFileSync(fullPath, "utf-8");
    const lines = content.split("\n");

    assert.ok(
      lines.length <= 250,
      `Arquivo ${relPath} tem ${lines.length} linhas, excedendo o teto ideal de 250 linhas`
    );

    assert.equal(
      EMOJI_REGEX.test(content),
      false,
      `Arquivo ${relPath} não pode conter emojis literais (regra estrita AGENTS.md)`
    );
  }
});
