// @ts-check
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { openStationWindow, resolveStationModule } from "../ui/public/js/window-manager/station-adapter.js";
import { windowManager } from "../ui/public/js/window-manager/window-manager.js";
import { isNavigationBlocked, handleNavigationKey } from "../ui/public/js/window-manager/focus-manager.js";
import { executeOfficeAction } from "../ui/public/js/office/office-action-dispatcher.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

test("EP-03.03: Abertura de estações de agentes em apresentação sidebar e com foco", () => {
  const agents = [
    { id: "claude_station", mod: "claude" },
    { id: "gemini_station", mod: "gemini" },
    { id: "opencode_station", mod: "opencode" },
    { id: "codex_station", mod: "codex" }
  ];

  for (const { id, mod } of agents) {
    const win = openStationWindow(id, { projectId: "57multimarcas" });
    assert.ok(win, `Deve abrir janela para ${id}`);
    assert.equal(win.moduleId, mod);
    assert.equal(win.presentation, "sidebar", `Agente ${id} deve abrir como sidebar`);
    assert.equal(win.projectId, "57multimarcas");
    assert.equal(windowManager.getState().activeWindowId, win.id, `Janela de ${id} deve receber foco`);
  }
});

test("EP-03.03: Abertura de consoles e telões em apresentação floating", () => {
  const consoles = [
    { id: "war_room_main_panel", mod: "orchestration" },
    { id: "server_rack", mod: "datacenter" },
    { id: "file_cabinet", mod: "diario" },
    { id: "prototype_board", mod: "studio" }
  ];

  for (const { id, mod } of consoles) {
    const win = openStationWindow(id, { projectId: "saude-dispensacao" });
    assert.ok(win, `Deve abrir janela para ${id}`);
    assert.equal(win.moduleId, mod);
    assert.equal(win.presentation, "floating", `Console ${id} deve abrir como floating`);
    assert.equal(win.projectId, "saude-dispensacao");
    assert.equal(windowManager.getState().activeWindowId, win.id, `Janela de ${id} deve receber foco`);
  }
});

test("EP-03.03: Bloqueio de navegação WASD e restauração via tecla Escape", () => {
  windowManager.reset();
  const win = openStationWindow("server_rack", { projectId: "saude-dispensacao" });
  assert.ok(win);

  // Com janela ativa aberta, navegação de cena deve estar bloqueada
  const activeWinId = windowManager.getState().activeWindowId;
  assert.equal(isNavigationBlocked({ hasActiveWindow: Boolean(activeWinId) }), true);

  // Disparo da tecla Escape fecha a janela ativa
  const fakeEscapeEvent = { code: "Escape", key: "Escape" };
  const mockContext = {
    windowManager: {
      getFocusedWindow: () => windowManager.getState().windows.find(w => w.id === activeWinId),
      close: (id) => windowManager.close(id)
    }
  };

  const res = handleNavigationKey(fakeEscapeEvent, mockContext);
  assert.equal(res.handled, true);
  assert.equal(res.action, "close_window");

  // A janela agora está fechada
  assert.equal(windowManager.getState().windows.some(w => w.id === win.id), false);
  const nextActive = windowManager.getState().activeWindowId;
  assert.equal(isNavigationBlocked({ hasActiveWindow: Boolean(nextActive) }), false);
});

test("EP-03.03: Integração do despachante executeOfficeAction com WindowManager", () => {
  const mockWm = {
    opened: null,
    focused: null,
    open(moduleId, options) {
      this.opened = { moduleId, options };
      return { id: `mock-${moduleId}`, moduleId };
    },
    focus(id) {
      this.focused = id;
    }
  };

  const res = executeOfficeAction("war_room_main_panel", {
    windowManager: mockWm,
    officeState: { activeProject: "harness-leca" },
    muteSound: true
  });

  assert.equal(res.success, true);
  assert.equal(res.actionType, "window");
  assert.equal(mockWm.opened.moduleId, "orchestration");
  assert.equal(mockWm.opened.options.projectId, "harness-leca");
  assert.equal(mockWm.opened.options.presentation, "floating");
  assert.equal(mockWm.focused, "mock-orchestration");
});

test("EP-03.03: Proibição estrita de emojis e limite de linhas nos arquivos de estações", () => {
  const filesToCheck = [
    path.join(rootDir, "ui", "public", "js", "window-manager", "station-adapter.js"),
    path.join(rootDir, "ui", "public", "js", "office", "office-action-dispatcher.js"),
    path.join(rootDir, "ui", "public", "js", "office", "office-object-catalog.js")
  ];

  for (const file of filesToCheck) {
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/);

    assert.ok(lines.length <= 300, `Arquivo ${path.basename(file)} tem ${lines.length} linhas (teto: 300)`);
    assert.equal(EMOJI_REGEX.test(content), false, `Emoji detectado em ${path.basename(file)}`);
  }
});
