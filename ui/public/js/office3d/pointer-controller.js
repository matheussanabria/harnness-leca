// @ts-check
// DAI HQ — Controlador de Eventos de Ponteiro, Mouse Look e Raycasting
import { focusManager, isElementInsideWindow } from "../window-manager/focus-manager.js";

export class OfficePointerController {
  /**
   * @param {Object} ctx
   * @param {HTMLElement} ctx.container
   * @param {any} ctx.renderer
   * @param {any} ctx.camera
   * @param {any} ctx.cameraController
   * @param {any} ctx.interactionManager
   * @param {any} ctx.seatManager
   * @param {HTMLElement} [ctx.crosshair]
   * @param {HTMLElement} [ctx.pointerLockHint]
   */
  constructor(ctx) {
    this.ctx = ctx;

    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerLeave = this.onPointerLeave.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onPointerLockChange = this.onPointerLockChange.bind(this);
  }

  attachListeners() {
    this.ctx.container.addEventListener("pointermove", this.onPointerMove);
    this.ctx.container.addEventListener("pointerleave", this.onPointerLeave);
    this.ctx.container.addEventListener("pointerdown", this.onPointerDown);
    this.ctx.container.addEventListener("click", this.onClick);
    window.addEventListener("pointerup", this.onPointerUp);
    this.ctx.container.addEventListener("wheel", this.onWheel, { passive: true });
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
  }

  detachListeners() {
    this.ctx.container.removeEventListener("pointermove", this.onPointerMove);
    this.ctx.container.removeEventListener("pointerleave", this.onPointerLeave);
    this.ctx.container.removeEventListener("pointerdown", this.onPointerDown);
    this.ctx.container.removeEventListener("click", this.onClick);
    window.removeEventListener("pointerup", this.onPointerUp);
    this.ctx.container.removeEventListener("wheel", this.onWheel);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
  }

  onPointerLockChange() {
    const isLocked = document.pointerLockElement === this.ctx.renderer.domElement;
    const viewMode = this.ctx.seatManager.viewMode;
    const isImmersive = viewMode === "third_person" || viewMode === "first_person";

    if (isLocked) {
      document.body.classList.add("pointer-locked");
    } else {
      document.body.classList.remove("pointer-locked");
    }

    if (this.ctx.pointerLockHint) {
      if (isLocked) {
        this.ctx.pointerLockHint.innerHTML = '<i class="fa-solid fa-crosshairs"></i> Câmera sincronizada 360° · Pressione <b>ALT</b>, <b>M</b> ou <b>ESC</b> para liberar o cursor';
        this.ctx.pointerLockHint.style.display = "block";
        setTimeout(() => {
          if (document.pointerLockElement === this.ctx.renderer.domElement && this.ctx.pointerLockHint) {
            this.ctx.pointerLockHint.style.display = "none";
          }
        }, 2500);
      } else if (isImmersive) {
        this.ctx.pointerLockHint.innerHTML = '<i class="fa-solid fa-arrow-pointer"></i> <b>Cursor Livre</b> (interaja com menus) · Clique na cena ou aperte <b>ALT</b>/<b>M</b> para voltar à câmera';
        this.ctx.pointerLockHint.style.display = "block";
      } else {
        this.ctx.pointerLockHint.style.display = "none";
      }
    }
  }

  isUiElement(target) {
    return isElementInsideWindow(target);
  }

  onClick(e) {
    if (this.isUiElement(e.target)) return;

    const viewMode = this.ctx.seatManager.viewMode;
    const isImmersive = viewMode === "third_person" || viewMode === "first_person";
    const isLocked = document.pointerLockElement === this.ctx.renderer.domElement;

    if (isImmersive && !isLocked) {
      try {
        this.ctx.renderer.domElement.requestPointerLock();
      } catch (_) {
        // Fallback para restrições do navegador
      }
    }
  }

  onPointerDown(e) {
    focusManager.handlePointerDown(e.target);

    if (this.isUiElement(e.target)) return;

    this.ctx.cameraController?.handlePointerDown(e.clientX, e.clientY);

    const isLocked = document.pointerLockElement === this.ctx.renderer.domElement;
    const viewMode = this.ctx.seatManager.viewMode;
    const isImmersive = viewMode === "third_person" || viewMode === "first_person";

    const hitId = this.ctx.interactionManager?.raycastClick(
      e.clientX,
      e.clientY,
      this.ctx.renderer.domElement,
      this.ctx.camera,
      isLocked || isImmersive
    );

    if (hitId) {
      if (document.pointerLockElement) document.exitPointerLock();
      this.handleInteractiveHit(hitId);
      return;
    }

    if (!isLocked && isImmersive) {
      try {
        this.ctx.renderer.domElement.requestPointerLock();
      } catch (_) {}
    }
  }

  handleInteractiveHit(hitId) {
    const sm = this.ctx.seatManager;
    if (hitId === "monitor_screen" || hitId === "workstation_chair") {
      if (!sm.isSeated) sm.sitAtWorkstation();
      else sm.setViewMode(sm.viewMode === "screen_focus" ? "workstation" : "screen_focus");
    } else if (hitId === "war_room_main_panel") {
      sm.openWarRoomDrawer("workflows");
    } else if (hitId === "war_room_table_console") {
      sm.openWarRoomDrawer("projects");
    } else if (hitId === "war_room_user_chair") {
      if (!sm.isSeated) sm.sitAtWarRoom();
      else sm.standUp();
    } else if (hitId === "war_room_claude_station") {
      sm.openAgentDossier("claude");
    } else if (hitId === "war_room_gemini_station") {
      sm.openAgentDossier("gemini");
    } else if (hitId === "war_room_opencode_station") {
      sm.openAgentDossier("opencode");
    } else if (hitId === "war_room_codex_station") {
      sm.openAgentDossier("codex");
    } else if (this.ctx.interactionManager?.interactById?.(hitId)) {
      return;
    }
  }

  onPointerUp() {
    this.ctx.cameraController?.handlePointerUp();
  }

  onPointerLeave() {
    this.ctx.cameraController?.handlePointerLeave();
  }

  onPointerMove(e) {
    if (this.isUiElement(e.target)) {
      this.ctx.cameraController?.handlePointerLeave();
      return;
    }

    const isLocked = document.pointerLockElement === this.ctx.renderer.domElement;
    const viewMode = this.ctx.seatManager.viewMode;
    const isImmersive = viewMode === "third_person" || viewMode === "first_person";

    // Se estiver em modo imersivo mas com cursor liberado (para clicar em menus/drawer):
    // Mantém o cursor visível e não rotaciona a câmera!
    if (isImmersive && !isLocked) {
      this.ctx.renderer.domElement.style.cursor = "default";
      if (this.ctx.crosshair) this.ctx.crosshair.classList.remove("active");
      return;
    }

    this.ctx.cameraController?.handlePointerMove(e.clientX, e.clientY, e.movementX, e.movementY, isLocked);

    const isHovering = this.ctx.interactionManager?.raycastHover(
      e.clientX,
      e.clientY,
      this.ctx.renderer.domElement,
      this.ctx.camera,
      isLocked || isImmersive
    );

    if (this.ctx.crosshair) {
      if (isHovering) this.ctx.crosshair.classList.add("active");
      else this.ctx.crosshair.classList.remove("active");
    }

    if (isImmersive) {
      this.ctx.renderer.domElement.style.cursor = isLocked ? "none" : "default";
    } else {
      this.ctx.renderer.domElement.style.cursor = isHovering ? "pointer" : "default";
    }
  }

  onWheel(e) {
    this.ctx.cameraController?.handleWheel(e.deltaY);
  }
}
