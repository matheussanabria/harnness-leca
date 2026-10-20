// @ts-check
/**
 * Adaptador de Estações do Escritório para o Window Manager (EP-01.02)
 * Responsabilidade Única: Traduzir entidades e estações do escritório 3D/2.5D
 * para módulos do Window Manager e sincronizar a apresentação visual do drawer/janela.
 */

import { windowManager } from "./window-manager.js";
import { WindowDragResizeController } from "./drag-resize.js";
import { getOfficeObject } from "../office/office-object-catalog.js";

/** @typedef {import("../types/window-manager").WindowInstance} WindowInstance */
/** @typedef {import("../types/window-manager").WindowPresentation} WindowPresentation */

/**
 * Mapeamento entre entidades interativas do escritório e módulos registrados no Window Manager
 * @type {Record<string, string>}
 */
export const STATION_MODULE_MAP = {
  gemini_desk: "gemini",
  war_room_gemini_station: "gemini",
  agent_gemini: "gemini",

  claude_desk: "claude",
  war_room_claude_station: "claude",
  agent_claude: "claude",

  opencode_desk: "opencode",
  war_room_opencode_station: "opencode",
  agent_opencode: "opencode",

  codex_desk: "codex",
  war_room_codex_station: "codex",
  agent_codex: "codex",

  server_rack: "datacenter",
  file_cabinet: "diario",
  whiteboard: "scrum",
  war_room_main_panel: "orchestration",
  war_room_table_console: "orchestration",
  orch_core: "orchestration"
};

/**
 * Resolve o identificador do módulo a partir de um objeto de estação
 * @param {string} objectId
 * @returns {string | null}
 */
export function resolveStationModule(objectId) {
  if (!objectId) return null;
  const canonical = getOfficeObject(objectId);
  if (canonical && canonical.moduleId) return canonical.moduleId;
  if (STATION_MODULE_MAP[objectId]) return STATION_MODULE_MAP[objectId];

  // Verificação tolerante a prefixos
  for (const [key, modId] of Object.entries(STATION_MODULE_MAP)) {
    if (objectId.includes(key) || key.includes(objectId)) return modId;
  }
  return null;
}

export function openStationWindow(objectId, options = {}) {
  const moduleId = resolveStationModule(objectId);
  if (!moduleId) return null;

  const canonical = getOfficeObject(objectId);
  const defaultPresentation = (canonical && canonical.category === "agent_station") ? "sidebar" : undefined;

  const win = windowManager.open(moduleId, {
    resourceId: objectId,
    projectId: options.projectId,
    presentation: options.presentation || defaultPresentation
  });

  if (win && win.id && typeof windowManager.focus === "function") {
    windowManager.focus(win.id);
  }

  return win;
}

/**
 * Inicializa a sincronização do drawer com o Window Manager no DOM
 * @param {object} params
 * @param {HTMLElement | null} params.drawerEl
 * @param {any} params.officeState
 * @param {(objId: string, state: any) => void} params.renderDrawerContent
 */
export function attachStationAdapter({ drawerEl, officeState, renderDrawerContent }) {
  if (!drawerEl) return;

  const btnClose = drawerEl.querySelector("#drawerCloseBtn");
  const btnMin = drawerEl.querySelector("#drawerMinimizeBtn");
  const btnMax = drawerEl.querySelector("#drawerMaximizeBtn");
  const btnFloat = drawerEl.querySelector("#drawerToggleFloatBtn");
  const iconContainer = drawerEl.querySelector("#drawerIcon");
  const headerEl = drawerEl.querySelector(".drawer-header");

  let currentWinId = null;
  let dismissingDrawer = false;

  const dismissCurrentDrawer = () => {
    dismissingDrawer = true;
    currentWinId = null;
    drawerEl.classList.remove("open");
    setTimeout(() => {
      dismissingDrawer = false;
    }, 0);
  };

  const getCurrentWindowId = () => currentWinId || windowManager.getState().activeWindowId;

  // Alça de redimensionamento para janelas flutuantes
  let resizeHandle = drawerEl.querySelector(".drawer-resize-handle");
  if (!resizeHandle) {
    resizeHandle = document.createElement("div");
    resizeHandle.className = "drawer-resize-handle";
    resizeHandle.setAttribute("title", "Arrastar para redimensionar");
    drawerEl.appendChild(resizeHandle);
  }

  const dragResize = new WindowDragResizeController({ windowManager });
  if (headerEl) {
    dragResize.attach(drawerEl, headerEl, resizeHandle, () => currentWinId);
  }

  // Ações de controle de janela
  btnMin?.addEventListener("click", (event) => {
    event.stopPropagation();
    const winId = getCurrentWindowId();
    if (!winId) return;
    dismissCurrentDrawer();
    windowManager.minimize(winId);
    officeState?.closeDrawer();
  });

  btnMax?.addEventListener("click", (event) => {
    event.stopPropagation();
    const winId = getCurrentWindowId();
    if (winId) windowManager.toggleMaximize(winId);
  });

  btnFloat?.addEventListener("click", (event) => {
    event.stopPropagation();
    const winId = getCurrentWindowId();
    if (!winId) return;
    const win = windowManager.getState().windows.find(w => w.id === winId);
    if (!win) return;
    const nextPresentation = win.presentation === "floating" ? "sidebar" : "floating";
    windowManager.setPresentation(winId, nextPresentation);
  });

  btnClose?.addEventListener("click", (event) => {
    event.stopPropagation();
    const winId = getCurrentWindowId();
    dismissCurrentDrawer();
    if (winId) windowManager.close(winId);
    officeState?.closeDrawer();
  });

  // Escuta alterações do Window Manager para atualizar o DOM do drawer
  windowManager.subscribe((wmState) => {
    if (dismissingDrawer) return;
    const activeWin = wmState.windows.find(w => w.id === wmState.activeWindowId);

    if (!activeWin || activeWin.visibility === "minimized") {
      drawerEl.classList.remove("open");
      return;
    }

    currentWinId = activeWin.id;
    drawerEl.classList.add("open");

    // Sincroniza classes de apresentação visual
    drawerEl.classList.toggle("floating", activeWin.presentation === "floating");
    drawerEl.classList.toggle("maximized", activeWin.presentation === "maximized");

    // Atualiza zIndex
    drawerEl.style.zIndex = String(activeWin.zIndex);

    // Se estiver flutuando, aplica coordenadas
    if (activeWin.presentation === "floating" && activeWin.bounds) {
      drawerEl.style.setProperty("--win-top", `${activeWin.bounds.y}px`);
      drawerEl.style.setProperty("--win-left", `${activeWin.bounds.x}px`);
      drawerEl.style.setProperty("--win-width", `${activeWin.bounds.width}px`);
      drawerEl.style.setProperty("--win-height", `${activeWin.bounds.height}px`);
    }

    // Atualiza ícone com FontAwesome sem emojis
    if (iconContainer && activeWin.icon) {
      iconContainer.innerHTML = `<i class="${activeWin.icon}"></i>`;
    }

    // Atualiza botões de ação
    if (btnFloat) {
      const isFloat = activeWin.presentation === "floating";
      btnFloat.innerHTML = `<i class="fa-solid fa-${isFloat ? 'table-columns' : 'up-right-from-square'}"></i>`;
      btnFloat.setAttribute("title", isFloat ? "Acoplar como painel lateral" : "Destacar em janela flutuante");
    }

    if (btnMax) {
      const isMax = activeWin.presentation === "maximized";
      btnMax.innerHTML = `<i class="fa-solid fa-${isMax ? 'compress' : 'expand'}"></i>`;
      btnMax.setAttribute("title", isMax ? "Restaurar tamanho" : "Maximizar janela");
    }
  });

  return {
    openStation(objectId, state) {
      const win = openStationWindow(objectId, { projectId: state?.activeProject });
      if (win) {
        currentWinId = win.id;
        renderDrawerContent(objectId, state);
      }
    },
    closeStation() {
      if (currentWinId) {
        windowManager.close(currentWinId);
        currentWinId = null;
      }
    }
  };
}
