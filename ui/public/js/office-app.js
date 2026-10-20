// @ts-check
// DAI HQ — Ponto de Entrada Principal & Fachada Orquestradora do Escritório Virtual
import { officeState } from "./office-state.js";
import { Office2D } from "./office-2d.js";
import { Office3D } from "./office-3d.js";
import { toggleSound, isSoundEnabled, playClickSound, playDrawerSound, playCoffeeSound } from "./office-audio.js";
import { renderDrawerContent } from "./office/office-drawer-views.js";
import { setHudVisibility, toggleHUD, toggleLeftPanel, toggleRightSidebar, updateHUD } from "./office/office-hud-controller.js";
import { setupOfficeShortcuts } from "./office/office-shortcuts.js";
import { attachStationAdapter } from "./window-manager/station-adapter.js";
import { TaskbarComponent } from "./window-manager/taskbar.js";
import { windowManager } from "./window-manager/window-manager.js";
import { executeOfficeAction } from "./office/office-action-dispatcher.js";
import { bindChatExecutionTelemetry, bindOfficeStateTelemetry } from "./office/office-agent-telemetry.js";

let engine2D = null;
let engine3D = null;
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
  window.addEventListener("keydown", (e) => {
    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
    if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") return;
    if (e.key.toLowerCase() === "h") toggleHUD();
  });
  window.addEventListener("dai:toggleHud", () => toggleHUD());

  try {
    if (localStorage.getItem("dai_office_hud_hidden") === "1") {
      setHudVisibility(false);
    }
  } catch (_) {}

  // Inicialização dos Motores
  engine2D = new Office2D(canvas2D, tooltipEl);
  engine3D = new Office3D(viewport3D, tooltipEl);

  // Seletor de Sensibilidade do Mouse
  const sensitivitySlider = /** @type {HTMLInputElement} */ (document.getElementById("mouseSensitivitySlider"));
  const sensitivityVal = document.getElementById("mouseSensitivityVal");
  try {
    const savedSens = localStorage.getItem("dai_mouse_sensitivity") || "5";
    if (sensitivitySlider) sensitivitySlider.value = savedSens;
    if (sensitivityVal) sensitivityVal.textContent = savedSens;
    engine3D.setMouseSensitivity(Number(savedSens));
  } catch (_) {}

  sensitivitySlider?.addEventListener("input", (e) => {
    const val = Number(/** @type {HTMLInputElement} */ (e.target).value) || 5;
    if (sensitivityVal) sensitivityVal.textContent = String(val);
    engine3D.setMouseSensitivity(val);
    try {
      localStorage.setItem("dai_mouse_sensitivity", String(val));
    } catch (_) {}
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

  projectSelect?.addEventListener("change", async (e) => {
    const slug = /** @type {HTMLSelectElement} */ (e.target).value;
    playClickSound();
    await officeState.setProject(slug);
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
  await switchMode("third_person");
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

async function switchMode(mode) {
  playClickSound();
  currentMode = mode;

  const btn3rd = document.getElementById("btnMode3rdPerson");
  const btn1st = document.getElementById("btnMode1stPerson");
  const btnWorkstation = document.getElementById("btnModeWorkstation");
  const btnWarRoom = document.getElementById("btnModeWarRoom");
  const btnOrbit = document.getElementById("btnModeOrbit");
  const btn2D = document.getElementById("btnMode2D");
  const canvas2D = document.getElementById("canvas2D");
  const viewport3D = document.getElementById("viewport3D");
  const hintText = document.getElementById("bottomHintText");

  btn3rd?.classList.remove("active");
  btn1st?.classList.remove("active");
  btnWorkstation?.classList.remove("active");
  btnWarRoom?.classList.remove("active");
  btnOrbit?.classList.remove("active");
  btn2D?.classList.remove("active");

  if (mode === "2d") {
    btn2D?.classList.add("active");
    if (viewport3D) viewport3D.style.display = "none";
    if (canvas2D) canvas2D.style.display = "block";
    if (engine3D) engine3D.stop();
    if (engine2D) engine2D.start();
    if (hintText) hintText.innerHTML = "<span>🎮</span><span>Ande com <b>WASD</b> · Pressione <b>[E]</b> Interagir · <b>H</b> Ocultar Menus</span>";
  } else {
    if (canvas2D) canvas2D.style.display = "none";
    if (viewport3D) viewport3D.style.display = "block";
    if (engine2D) engine2D.stop();

    if (engine3D) {
      const ok = await engine3D.init();
      if (ok) {
        engine3D.start();
        if (mode === "war_room") {
          btnWarRoom?.classList.add("active");
          if (engine3D.avatar) {
            engine3D.avatar.position.set(-13.0, 0, 2.2);
            engine3D.avatar.rotation = 0;
            engine3D.avatar.targetRotation = 0;
            engine3D.avatar.setState("idle");
          }
          engine3D.setViewMode("third_person");
          if (hintText) hintText.innerHTML = "<span>🏛️</span><span><b>Sala de Guerra DAI</b> · Aproxime-se da mesa ou telão · <b>E</b> Interagir · <b>H</b> Ocultar Menus</span>";
        } else {
          engine3D.setViewMode(mode);
          if (mode === "third_person") {
            btn3rd?.classList.add("active");
            if (hintText) hintText.innerHTML = "<span>🚶‍♂️</span><span><b>WASD</b> Andar · <b>Mover Mouse</b> Direcionar Câmera · <b>Shift</b> Correr · <b>C</b> 1ª Pessoa · <b>[E]</b> Interagir · <b>H</b> Ocultar Menus</span>";
          } else if (mode === "first_person") {
            btn1st?.classList.add("active");
            if (hintText) hintText.innerHTML = "<span>👁️</span><span>Modo 1ª Pessoa: Olhando pelos olhos do personagem · <b>C</b> 3ª Pessoa · <b>H</b> Ocultar Menus</span>";
          } else if (mode === "workstation" || mode === "screen_focus") {
            btnWorkstation?.classList.add("active");
            if (hintText) hintText.innerHTML = "<span>💺</span><span>Utilizando a Estação de Trabalho · <b>E</b> ou <b>Esc</b> Levantar · <b>H</b> Ocultar Menus</span>";
          } else if (mode === "orbit") {
            btnOrbit?.classList.add("active");
            if (hintText) hintText.innerHTML = "<span>🌐</span><span>Modo Diorama 360° · Arraste para orbitar · <b>H</b> Ocultar Menus</span>";
          }
        }
      }
    }
  }
}
