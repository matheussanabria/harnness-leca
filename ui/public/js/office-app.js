// @ts-check
// DAI HQ — Ponto de Entrada Principal & Fachada Orquestradora do Escritório Virtual
import { officeState } from "./office-state.js";
import { Office2D } from "./office-2d.js";
import { Office3D } from "./office-3d.js";
import { toggleSound, isSoundEnabled, playClickSound, playDrawerSound, playCoffeeSound } from "./office-audio.js";
import { renderDrawerContent } from "./office/office-drawer-views.js";
import { setHudPersistence, setHudVisibility, toggleHUD, toggleLeftPanel, toggleRightSidebar, updateHUD } from "./office/office-hud-controller.js";
import { getScreenStateClient } from "./shared/screen-state.js";
import { hydratePageSizes } from "./shared/pagination-prefs.js";
import { OfficeScreenState } from "./office-screen-state.js";
import { setupOfficeShortcuts } from "./office/office-shortcuts.js";
import { attachStationAdapter } from "./window-manager/station-adapter.js";
import { TaskbarComponent } from "./window-manager/taskbar.js";
import { windowManager } from "./window-manager/window-manager.js";
import { bootOfficeWindowManager, switchOfficeProject } from "./office/office-wm-controller.js";
import { executeOfficeAction } from "./office/office-action-dispatcher.js";
import { bindChatExecutionTelemetry, bindOfficeStateTelemetry, recomputeLocalEngines } from "./office/office-agent-telemetry.js";
import { bindProjectionTelemetry } from "./office/office-projection-bridge.js";
import { bindOfficeLightingDom } from "./office/office-lighting-bootstrap.js";
import { OfficeViewModeController } from "./office/office-view-mode.js";
import { OfficeScenePreferences } from "./office/office-scene-preferences.js";
import { bindOfficeSessionClient, hydrateOfficeSession } from "./office/office-session-storage.js";

let engine2D = null;
let engine3D = null;
let viewModeController = null;
let currentMode = "pov";
let stationAdapter = null;
let taskbar = null;

// Função global para cliques nos hotspots e objetos delegada ao despachante canônico
// @ts-ignore
window.triggerObject = function(id) {
  return executeOfficeAction(id, {
    officeState,
    windowManager,
    // @ts-ignore
    sitAtWorkstation: () => engine3D?.sitAtWorkstation?.(),
    // @ts-ignore
    sitAtWarRoom: () => engine3D?.sitAtWarRoom?.(),
    // @ts-ignore
    toggleScreenFocus: () => engine3D?.toggleScreenFocus?.()
  });
};

// @ts-ignore
window.openOfficeChatConversation = function(chatFile) {
  if (!chatFile) return;
  officeState.closeDrawer();
  officeState.continuationChat = { file: chatFile };
  const width = Math.min(900, Math.max(320, window.innerWidth - 40));
  const height = Math.min(780, Math.max(420, window.innerHeight - 90));
  const chatWindow = windowManager.open("chat", {
    projectId: officeState.activeProject,
    resourceId: chatFile,
    presentation: "floating",
    bounds: {
      x: Math.max(20, Math.round((window.innerWidth - width) / 2)),
      y: Math.max(70, Math.round((window.innerHeight - height) / 2)),
      width,
      height
    }
  });
  windowManager.focus(chatWindow.id);
  renderDrawerContent("office_chat", officeState);
};

document.addEventListener("DOMContentLoaded", async () => {
  const screenClient = getScreenStateClient();
  const officeScreenState = new OfficeScreenState({ client: screenClient });
  await officeScreenState.hydrate();
  await hydratePageSizes();
  hydrateOfficeSession(officeScreenState.state);
  bindOfficeSessionClient(screenClient);
  setHudPersistence((hidden) => { void officeScreenState.setHudHidden(hidden); });

  const canvas2D = /** @type {HTMLCanvasElement} */ (document.getElementById("canvas2D"));
  const viewport3D = /** @type {HTMLElement} */ (document.getElementById("viewport3D"));
  const tooltipEl = /** @type {HTMLElement} */ (document.getElementById("officeTooltip"));
  const drawerCloseBtn = document.getElementById("drawerCloseBtn");
  const projectSelect = /** @type {HTMLSelectElement} */ (document.getElementById("projectSelect"));

  // Botões de navegação e HUD
  const btnToggleHud = document.getElementById("btnToggleHud");
  const btnFloatingHudTrigger = document.getElementById("btnFloatingHudTrigger");
  const btnCloseLeftPanel = document.getElementById("btnCloseLeftPanel");
  const btnCloseRightSidebar = document.getElementById("btnCloseRightSidebar");
  const btnAudioToggle = document.getElementById("btnAudioToggle");

  btnToggleHud?.addEventListener("click", () => toggleHUD());
  btnFloatingHudTrigger?.addEventListener("click", () => setHudVisibility(true));
  btnCloseLeftPanel?.addEventListener("click", () => toggleLeftPanel(true));
  btnCloseRightSidebar?.addEventListener("click", () => toggleRightSidebar(true));

  // Tecla H e evento customizado para alternar menus / Modo Imersivo
  window.addEventListener("dai:toggleHud", () => toggleHUD());

  if (officeScreenState.hudHidden) setHudVisibility(false);

  // Inicialização dos Motores
  engine2D = new Office2D(canvas2D, tooltipEl);
  engine3D = new Office3D(viewport3D, tooltipEl);

  const scenePreferences = new OfficeScenePreferences({
    doc: document,
    win: window,
    storage: officeScreenState.sceneStorage(),
    onChange: (state) => {
      engine2D?.applyPerformanceProfile?.(state.profile);
      engine2D?.setReducedMotion?.(state.reducedMotion);
      engine3D?.applyPerformanceProfile?.(state.profile);
      engine3D?.setReducedMotion?.(state.reducedMotion);
    }
  });
  scenePreferences.init();

  viewModeController = new OfficeViewModeController({
    engines: { "3d": engine3D, "2.5d": engine2D },
    doc: document,
    storage: officeScreenState.viewStorage(() => officeState.activeProject || "global"),
    getProject: () => officeState.activeProject || "global",
    onCameraMode: applyCameraMode,
    onViewChanged: (state) => {
      updateViewChrome(state);
      scenePreferences.announce(`Visualização ${state.label} ativa.`);
    }
  });

  // Seletor de Sensibilidade do Mouse
  const sensitivitySlider = /** @type {HTMLInputElement} */ (document.getElementById("mouseSensitivitySlider"));
  const sensitivityVal = document.getElementById("mouseSensitivityVal");
  const savedSens = String(officeScreenState.mouseSensitivity);
  if (sensitivitySlider) sensitivitySlider.value = savedSens;
  if (sensitivityVal) sensitivityVal.textContent = savedSens;
  engine3D.pendingMouseSensitivity = Number(savedSens);
  engine3D.setMouseSensitivity(Number(savedSens));

  sensitivitySlider?.addEventListener("input", (e) => {
    const val = Number(/** @type {HTMLInputElement} */ (e.target).value) || 5;
    if (sensitivityVal) sensitivityVal.textContent = String(val);
    engine3D.pendingMouseSensitivity = val;
    engine3D.setMouseSensitivity(val);
    void officeScreenState.setMouseSensitivity(val);
  });

  // Setup dos Modos de Câmera
  document.getElementById("btnMode3rdPerson")?.addEventListener("click", () => switchMode("third_person"));
  document.getElementById("btnMode1stPerson")?.addEventListener("click", () => switchMode("first_person"));
  document.getElementById("btnModeWorkstation")?.addEventListener("click", () => switchMode("workstation"));
  document.getElementById("btnModeWarRoom")?.addEventListener("click", () => switchMode("war_room"));
  document.getElementById("btnModeOrbit")?.addEventListener("click", () => switchMode("orbit"));
  document.getElementById("btnMode2D")?.addEventListener("click", () => switchMode("2d"));

  // Eventos customizados da Sala de Guerra e Dossiês
  window.addEventListener("dai:openWarRoom", () => officeState.selectObject("war_room_main_panel"));
  window.addEventListener("dai:openAgentDossier", (e) => {
    // @ts-ignore
    const key = e.detail?.agentKey;
    if (key === "claude") officeState.selectObject("claude_desk");
    else if (key === "gemini") officeState.selectObject("gemini_desk");
    else if (key === "opencode") officeState.selectObject("opencode_desk");
    else if (key === "codex") officeState.selectObject("codex_desk");
  });

  window.addEventListener("dai:selectOrchestrationEntity", (e) => {
    // @ts-ignore
    const { entityId, category } = e.detail || {};
    if (category === "agent") {
      if (entityId.includes("claude")) officeState.selectObject("claude_desk");
      else if (entityId.includes("gemini")) officeState.selectObject("gemini_desk");
      else if (entityId.includes("opencode")) officeState.selectObject("opencode_desk");
      else if (entityId.includes("codex")) officeState.selectObject("codex_desk");
    } else {
      officeState.selectObject(entityId);
    }
  });

  stationAdapter = attachStationAdapter({
    drawerEl: document.getElementById("officeDrawer"),
    officeState,
    renderDrawerContent
  });

  taskbar = new TaskbarComponent({
    container: document.getElementById("windowTaskbar"),
    windowManager
  });

  projectSelect?.addEventListener("change", (e) => {
    playClickSound(); void switchOfficeProject(/** @type {HTMLSelectElement} */ (e.target));
  });

  btnAudioToggle?.addEventListener("click", () => {
    const enabled = toggleSound();
    btnAudioToggle.innerHTML = `<i class="fa-solid fa-${enabled ? 'volume-high' : 'volume-xmark'}"></i>`;
    btnAudioToggle.title = enabled ? "Mudo (Desativar áudio ambiente)" : "Ativar áudio ambiente";
    btnAudioToggle.classList.toggle("active", enabled);
  });

  officeState.subscribe(updateUI);
  bindOfficeStateTelemetry(officeState);
  bindChatExecutionTelemetry();
  bindProjectionTelemetry(officeState, { onFallback: recomputeLocalEngines });
  bindOfficeLightingDom(document);

  setupOfficeShortcuts({
    switchMode: (m) => switchMode(m),
    toggleCursor: () => {
      const canvas = document.querySelector("#viewport3D canvas");
      if (document.pointerLockElement) {
        document.exitPointerLock();
      } else if (canvas && (currentMode === "third_person" || currentMode === "first_person")) {
        try { canvas.requestPointerLock(); } catch (_) {}
      }
    },
    onInteract: () => engine3D?.interactionManager?.triggerCurrent(),
    onStandUp: () => engine3D?.standUp(),
    isSeated: () => engine3D?.isSeated || false
  });

  await officeState.init();
  bootOfficeWindowManager();
  await viewModeController.restore();
});

function updateUI(state) {
  if (state.isDrawerOpen && state.selectedObject) {
    stationAdapter?.openStation(state.selectedObject, state);
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  } else {
    stationAdapter?.closeStation();
  }

  updateHUD(state);

  const projectSelect = /** @type {HTMLSelectElement} */ (document.getElementById("projectSelect"));
  if (projectSelect && state.projects.length > 0) {
    if (projectSelect.options.length <= 1) {
      projectSelect.innerHTML = state.projects.map((p) => `
        <option value="${p.slug}" ${p.slug === state.activeProject ? "selected" : ""}>
          ${p.name || p.slug}
        </option>
      `).join("");
    } else if (projectSelect.value !== state.activeProject) {
      projectSelect.value = state.activeProject;
    }
  }

  if (engine3D && typeof engine3D.onProjectChanged === "function") {
    engine3D.onProjectChanged(state);
  }
}

const CAMERA_HINTS = {
  third_person: '<i class="fa-solid fa-person-walking"></i> <b>WASD</b> Andar · <b>Mover Mouse</b> Direcionar Câmera · <b>Shift</b> Correr · <b>M</b> Cursor Livre · <b>C</b> 1ª Pessoa · <b>E</b> Interagir · <b>H</b> Menus',
  first_person: '<i class="fa-solid fa-eye"></i> Modo 1ª Pessoa: olhando pelos olhos do personagem · <b>C</b> 3ª Pessoa · <b>H</b> Menus',
  workstation: '<i class="fa-solid fa-chair"></i> Utilizando a Estação de Trabalho · <b>E</b> ou <b>Esc</b> Levantar · <b>H</b> Menus',
  war_room: '<i class="fa-solid fa-building-columns"></i> <b>Sala de Guerra DAI</b> · Aproxime-se da mesa ou telão · <b>E</b> Interagir · <b>H</b> Menus'
};

function applyCameraMode(cameraMode) {
  if (cameraMode !== "war_room" && cameraMode !== "war_room_seated") return;
  if (engine3D?.avatar) {
    engine3D.avatar.position.set(-13.0, 0, 2.2);
    engine3D.avatar.rotation = 0;
    engine3D.avatar.targetRotation = 0;
    engine3D.avatar.setState("idle");
  }
}

function updateViewChrome(state) {
  currentMode = state.mode === "3d" ? state.cameraMode : state.mode;
  const hintText = document.getElementById("bottomHintText");
  if (!hintText) return;
  const hint = state.mode === "3d" ? CAMERA_HINTS[state.cameraMode] : state.hint;
  if (hint) hintText.innerHTML = hint;
}

async function switchMode(mode) {
  playClickSound();
  if (!viewModeController) return;
  if (mode === "orbit") return viewModeController.switchTo("diorama");
  if (mode === "2d") return viewModeController.switchTo("2.5d");
  return viewModeController.switchTo("3d", { cameraMode: mode });
}
