// @ts-check
/**
 * Despachante Canônico de Ações dos Objetos do Escritório (EP-03.02)
 * Responsabilidade Única: Executar o contrato padrão de ações (window, drawer, seat, screen_focus, custom)
 * unificando áudio contextual, integração com WindowManager, OfficeState e eventos.
 */

import { getOfficeObject } from "./office-object-catalog.js";
import { officeScreenPresets } from "./office-screen-presets.js";
import { playClickSound, playDrawerSound, playCoffeeSound, playArcadeSound } from "../office-audio.js";
import { officeState as defaultOfficeState } from "../office-state.js";
import { windowManager as defaultWindowManager } from "../window-manager/window-manager.js";

/**
 * @typedef {"window" | "drawer" | "seat" | "screen_focus" | "custom"} OfficeActionType
 *
 * @typedef {Object} OfficeActionContext
 * @property {() => void} [sitAtWorkstation]
 * @property {() => void} [sitAtWarRoom]
 * @property {() => void} [toggleScreenFocus]
 * @property {(section: string) => void} [openWarRoomDrawer]
 * @property {(agentKey: string) => void} [openAgentDossier]
 * @property {any} [windowManager]
 * @property {any} [officeState]
 * @property {boolean} [muteSound]
 *
 * @typedef {Object} OfficeActionResult
 * @property {boolean} success
 * @property {OfficeActionType} actionType
 * @property {string} targetId
 * @property {string} [canonicalId]
 * @property {any} [windowInstance]
 * @property {string} [error]
 */

/** @type {Map<string, (descriptor: any, context: OfficeActionContext) => any>} */
const customHandlers = new Map();

/**
 * Registra um manipulador customizado para uma ação ou objeto
 * @param {string} targetId
 * @param {(descriptor: any, context: OfficeActionContext) => any} handler
 */
export function registerCustomActionHandler(targetId, handler) {
  customHandlers.set(targetId, handler);
}

/**
 * Remove um manipulador customizado
 * @param {string} targetId
 */
export function unregisterCustomActionHandler(targetId) {
  customHandlers.delete(targetId);
}

/**
 * Dispara o efeito sonoro apropriado para o objeto
 * @param {string} objectId
 * @param {OfficeActionType} [actionType]
 */
export function triggerContextualSound(objectId, actionType) {
  if (objectId === "file_cabinet" || objectId === "archive" || objectId === "cabinet") {
    playDrawerSound();
  } else if (objectId === "coffee_bar" || objectId === "cafe" || objectId === "coffee") {
    playCoffeeSound();
  } else if (objectId === "arcade_machine" || objectId === "arcade" || objectId === "fliperama") {
    playArcadeSound();
  } else {
    playClickSound();
  }
}

/**
 * Executa a ação associada a um objeto do escritório
 * @param {string | Object} target ID, alias ou descritor do objeto
 * @param {OfficeActionContext} [context] Contexto de execução e callbacks
 * @param {{ mute?: boolean, windowOptions?: Record<string, any> }} [options] Opções complementares
 * @returns {OfficeActionResult}
 */
export function executeOfficeAction(target, context = {}, options = {}) {
  const targetId = typeof target === "string" ? target : target?.id;
  if (!targetId) {
    return { success: false, actionType: "custom", targetId: "", error: "Target ID inválido" };
  }

  // 1. Resolve o descritor canônico
  const descriptor = (typeof target === "object" && target.actionType)
    ? target
    : (getOfficeObject(targetId) || { id: targetId, actionType: /** @type {OfficeActionType} */ ("drawer"), name: targetId });

  const canonicalId = descriptor.id || targetId;
  const actionType = descriptor.actionType || "drawer";

  // 2. Aciona áudio contextual (se não silenciado)
  if (!options.mute && !context.muteSound) {
    triggerContextualSound(canonicalId, actionType);
  }

  const wm = context.windowManager || defaultWindowManager;
  const state = context.officeState || defaultOfficeState;

  // 3. Verifica se há manipulador customizado registrado
  const customHandler = customHandlers.get(canonicalId) || customHandlers.get(targetId);
  if (customHandler) {
    const customRes = customHandler(descriptor, context);
    dispatchOfficeActionEvent("custom", { descriptor, customRes });
    return { success: true, actionType: "custom", targetId, canonicalId };
  }

  // 4. Execução por tipo canônico de ação
  switch (actionType) {
    case "window": {
      // A screen can open a different module per preset (the war screen on "kanban" opens the interactive Scrum board).
      const presetModule = descriptor.moduleByPreset?.[officeScreenPresets.getPreset(descriptor.id)];
      const moduleId = presetModule || descriptor.moduleId;
      let windowInstance = null;
      if (moduleId && wm && typeof wm.open === "function") {
        const projectId = state?.activeProject;
        windowInstance = wm.open(moduleId, {
          projectId,
          presentation: descriptor.category === "agent_station" ? "sidebar" : "floating",
          ...(options.windowOptions || {})
        });
        if (windowInstance?.id && typeof wm.focus === "function") {
          wm.focus(windowInstance.id);
        }
      } else if (state && typeof state.selectObject === "function") {
        state.selectObject(canonicalId);
      }

      dispatchOfficeActionEvent("window", { descriptor, windowInstance });
      return { success: true, actionType: "window", targetId, canonicalId, windowInstance };
    }

    case "drawer": {
      if (state && typeof state.selectObject === "function") {
        state.selectObject(canonicalId);
      }
      if (descriptor.category === "agent_station" && typeof context.openAgentDossier === "function") {
        context.openAgentDossier(descriptor.moduleId || "gemini");
      }
      dispatchOfficeActionEvent("drawer", { descriptor });
      return { success: true, actionType: "drawer", targetId, canonicalId };
    }

    case "seat": {
      if ((canonicalId === "workstation_chair" || canonicalId === "workstation") && typeof context.sitAtWorkstation === "function") {
        context.sitAtWorkstation();
      } else if ((canonicalId === "war_room_user_chair" || canonicalId === "war_chair") && typeof context.sitAtWarRoom === "function") {
        context.sitAtWarRoom();
      }
      dispatchOfficeActionEvent("seat", { descriptor });
      return { success: true, actionType: "seat", targetId, canonicalId };
    }

    case "screen_focus": {
      const targetScreen = canonicalId === "war_room_main_panel" ? "war_room_main_panel" : "big_screen";
      const presetToSet = options.preset || context.preset;
      const shouldCycle = options.cyclePreset || context.cyclePreset;
      if (presetToSet) {
        officeScreenPresets.setPreset(targetScreen, presetToSet);
      } else if (shouldCycle) {
        officeScreenPresets.cyclePreset(targetScreen);
      }
      const activePreset = officeScreenPresets.getPreset(targetScreen);
      if (typeof context.toggleScreenFocus === "function") {
        context.toggleScreenFocus(targetScreen, activePreset);
      }
      dispatchOfficeActionEvent("screen_focus", { descriptor, targetScreen, preset: activePreset });
      return { success: true, actionType: "screen_focus", targetId, canonicalId, targetScreen, preset: activePreset };
    }

    case "custom":
    default: {
      const handler = customHandlers.get(canonicalId) || customHandlers.get(targetId);
      if (handler) {
        handler(descriptor, context);
      } else if (state && typeof state.selectObject === "function") {
        state.selectObject(canonicalId);
      }
      dispatchOfficeActionEvent("custom", { descriptor });
      return { success: true, actionType, targetId, canonicalId };
    }
  }
}

/**
 * Emite evento CustomEvent dai:officeAction se o ambiente tiver suporte a window/DOM
 * @param {string} actionType
 * @param {any} detail
 */
function dispatchOfficeActionEvent(actionType, detail) {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    try {
      window.dispatchEvent(new CustomEvent("dai:officeAction", {
        detail: { actionType, ...detail }
      }));
    } catch (_) {}
  }
}

/**
 * Cria a função de compatibilidade para window.triggerObject
 * @param {OfficeActionContext} [context]
 * @returns {(id: string) => OfficeActionResult}
 */
export function createLegacyTriggerObject(context = {}) {
  return function triggerObject(id) {
    return executeOfficeAction(id, context);
  };
}
