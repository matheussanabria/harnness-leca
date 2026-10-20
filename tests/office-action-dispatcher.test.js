// @ts-check
import test from "node:test";
import assert from "node:assert/strict";

import {
  executeOfficeAction,
  triggerContextualSound,
  registerCustomActionHandler,
  unregisterCustomActionHandler,
  createLegacyTriggerObject
} from "../ui/public/js/office/office-action-dispatcher.js";

test("EP-03.02 - Execução de ação tipo 'window' com WindowManager", () => {
  let openedModule = null;
  let openedOptions = null;
  let focusedWindowId = null;

  const mockWindowManager = {
    open(moduleId, options) {
      openedModule = moduleId;
      openedOptions = options;
      return { id: `win-${moduleId}` };
    },
    focus(id) {
      focusedWindowId = id;
    }
  };

  const mockOfficeState = {
    activeProject: "57multimarcas",
    selectObject() {}
  };

  // 1. Estação de agente abre como sidebar
  const resAgent = executeOfficeAction("claude_station", {
    windowManager: mockWindowManager,
    officeState: mockOfficeState,
    muteSound: true
  });

  assert.equal(resAgent.success, true);
  assert.equal(resAgent.actionType, "window");
  assert.equal(resAgent.canonicalId, "claude_station");
  assert.equal(openedModule, "claude");
  assert.equal(openedOptions.projectId, "57multimarcas");
  assert.equal(openedOptions.presentation, "sidebar");
  assert.equal(focusedWindowId, "win-claude");

  // 2. Telão da War Room abre como floating
  const resPanel = executeOfficeAction("war_room_main_panel", {
    windowManager: mockWindowManager,
    officeState: mockOfficeState,
    muteSound: true
  });

  assert.equal(resPanel.success, true);
  assert.equal(resPanel.actionType, "window");
  assert.equal(resPanel.canonicalId, "war_room_main_panel");
  assert.equal(openedModule, "orchestration");
  assert.equal(openedOptions.presentation, "floating");
});

test("EP-03.02 - Execução de ação tipo 'drawer' e atualização do OfficeState", () => {
  let selectedObj = null;

  const mockOfficeState = {
    selectObject(id) {
      selectedObj = id;
    }
  };

  const res = executeOfficeAction("coffee_bar", {
    officeState: mockOfficeState,
    muteSound: true
  });

  assert.equal(res.success, true);
  assert.equal(res.actionType, "drawer");
  assert.equal(res.canonicalId, "coffee_bar");
  assert.equal(selectedObj, "coffee_bar");
});

test("EP-03.02 - Execução de ação tipo 'seat' e 'screen_focus'", () => {
  let workstationSat = false;
  let warRoomSat = false;
  let screenFocused = false;

  const context = {
    sitAtWorkstation() { workstationSat = true; },
    sitAtWarRoom() { warRoomSat = true; },
    toggleScreenFocus() { screenFocused = true; },
    muteSound: true
  };

  // Cadeira da estação
  const resWork = executeOfficeAction("workstation_chair", context);
  assert.equal(resWork.success, true);
  assert.equal(resWork.actionType, "seat");
  assert.equal(workstationSat, true);

  // Cadeira da war room
  const resWar = executeOfficeAction("war_room_user_chair", context);
  assert.equal(resWar.success, true);
  assert.equal(resWar.actionType, "seat");
  assert.equal(warRoomSat, true);

  // Tela do monitor 3D
  const resScreen = executeOfficeAction("monitor_screen", context);
  assert.equal(resScreen.success, true);
  assert.equal(resScreen.actionType, "screen_focus");
  assert.equal(screenFocused, true);
});

test("EP-03.02 - Resolução transparente de aliases legados 2D e 3D", () => {
  let openedModule = null;
  let selectedObj = null;

  const mockWindowManager = {
    open(moduleId) {
      openedModule = moduleId;
      return { id: "win" };
    },
    focus() {}
  };

  const mockOfficeState = {
    selectObject(id) {
      selectedObj = id;
    }
  };

  // Alias claude_desk deve abrir o módulo claude
  const resAlias1 = executeOfficeAction("claude_desk", {
    windowManager: mockWindowManager,
    muteSound: true
  });
  assert.equal(resAlias1.canonicalId, "claude_station");
  assert.equal(openedModule, "claude");

  // Alias sofa deve selecionar lounge_couch no drawer
  const resAlias2 = executeOfficeAction("sofa", {
    officeState: mockOfficeState,
    muteSound: true
  });
  assert.equal(resAlias2.canonicalId, "lounge_couch");
  assert.equal(selectedObj, "lounge_couch");
});

test("EP-03.02 - Manipuladores customizados e helper legado triggerObject", () => {
  let customRan = false;

  registerCustomActionHandler("test_custom_object", (desc, ctx) => {
    customRan = true;
  });

  const resCustom = executeOfficeAction("test_custom_object", { muteSound: true });
  assert.equal(resCustom.success, true);
  assert.equal(customRan, true);

  unregisterCustomActionHandler("test_custom_object");

  // Helper createLegacyTriggerObject
  let legacyOpened = null;
  const legacyTrigger = createLegacyTriggerObject({
    windowManager: {
      open(mod) { legacyOpened = mod; return { id: "1" }; },
      focus() {}
    },
    muteSound: true
  });

  const resLegacy = legacyTrigger("gemini_station");
  assert.equal(resLegacy.success, true);
  assert.equal(legacyOpened, "gemini");
});

test("EP-03.02 - Efeitos sonoros contextuais não lançam erro", () => {
  // Verifica se o acionamento de som contextual executa com segurança mesmo sem AudioContext no Node
  assert.doesNotThrow(() => triggerContextualSound("file_cabinet"));
  assert.doesNotThrow(() => triggerContextualSound("coffee_bar"));
  assert.doesNotThrow(() => triggerContextualSound("arcade_machine"));
  assert.doesNotThrow(() => triggerContextualSound("workstation_chair"));
});
