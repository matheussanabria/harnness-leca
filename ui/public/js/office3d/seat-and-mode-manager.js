// @ts-check
// DAI HQ — Gerenciador de Modos de Câmera, Assentos e Transições
import { playClickSound } from "../office-audio.js";

export class SeatAndModeManager {
  /**
   * @param {Object} ctx
   * @param {any} ctx.cameraController
   * @param {any} ctx.avatar
   * @param {any} ctx.orbitControls
   * @param {any} ctx.interactionManager
   * @param {any} ctx.cssRenderer
   * @param {HTMLElement} [ctx.crosshair]
   * @param {Object} ctx.positions
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.isSeated = false;
    this.seatedType = "none"; // "workstation" | "war_room" | "none"
  }

  get viewMode() {
    return this.ctx.cameraController?.viewMode || "third_person";
  }

  setViewMode(mode) {
    if (this.ctx.cameraController) this.ctx.cameraController.setMode(mode);

    const isImmersive = mode === "third_person" || mode === "first_person";
    if (isImmersive) {
      document.body.classList.add("immersive-mode");
      if (this.ctx.crosshair) this.ctx.crosshair.style.display = "block";
      if (document.pointerLockElement !== this.ctx.renderer?.domElement) {
        try { this.ctx.renderer?.domElement?.requestPointerLock(); } catch (_) {}
      }
    } else {
      document.body.classList.remove("immersive-mode");
      if (this.ctx.crosshair) this.ctx.crosshair.style.display = "none";
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      if (this.ctx.renderer?.domElement) {
        this.ctx.renderer.domElement.style.cursor = "default";
      }
    }

    const avatar = this.ctx.avatar;
    const orbitControls = this.ctx.orbitControls;

    if (mode === "first_person") {
      avatar?.setVisible(false);
      avatar?.setFirstPersonMode(true);
      if (orbitControls) orbitControls.enabled = false;
    } else if (mode === "third_person") {
      avatar?.setVisible(true);
      avatar?.setFirstPersonMode(false);
      if (orbitControls) orbitControls.enabled = false;
    } else if (mode === "orbit") {
      avatar?.setVisible(true);
      avatar?.setFirstPersonMode(false);
      if (orbitControls) {
        orbitControls.enabled = true;
        orbitControls.target.set(0, 1.25, 0.5);
      }
    }
    this.updateActiveButton();
  }

  updateActiveButton() {
    const btn3rd = document.getElementById("btnMode3rdPerson");
    const btn1st = document.getElementById("btnMode1stPerson");
    const btnWorkstation = document.getElementById("btnModeWorkstation");
    const btnWarRoom = document.getElementById("btnModeWarRoom");
    const btnOrbit = document.getElementById("btnModeOrbit");

    btn3rd?.classList.remove("active");
    btn1st?.classList.remove("active");
    btnWorkstation?.classList.remove("active");
    btnWarRoom?.classList.remove("active");
    btnOrbit?.classList.remove("active");

    if (this.viewMode === "third_person") btn3rd?.classList.add("active");
    else if (this.viewMode === "first_person") btn1st?.classList.add("active");
    else if (this.viewMode === "workstation" || this.viewMode === "screen_focus") btnWorkstation?.classList.add("active");
    else if (this.viewMode === "war_room_seated") btnWarRoom?.classList.add("active");
    else if (this.viewMode === "orbit") btnOrbit?.classList.add("active");
  }

  sitAtWorkstation() {
    this.isSeated = true;
    this.seatedType = "workstation";
    this.setViewMode("workstation");
    playClickSound();

    const avatar = this.ctx.avatar;
    if (avatar) {
      avatar.setVisible(true);
      avatar.setFirstPersonMode(false);
      avatar.position.set(0, 0, 0.72);
      avatar.rotation = 0;
      avatar.targetRotation = 0;
      avatar.setState("typing");
    }

    if (this.ctx.cssRenderer) this.ctx.cssRenderer.domElement.style.pointerEvents = "auto";
    this.ctx.interactionManager?.showPrompt("Utilizando computador · [E] ou [Esc] Levantar");
    this.updateActiveButton();
  }

  sitAtWarRoom() {
    this.isSeated = true;
    this.seatedType = "war_room";
    this.setViewMode("war_room_seated");
    playClickSound();

    const avatar = this.ctx.avatar;
    if (avatar) {
      avatar.setVisible(true);
      avatar.setFirstPersonMode(false);
      avatar.position.set(this.ctx.positions.warChairPos.x, this.ctx.positions.warChairPos.y, this.ctx.positions.warChairPos.z);
      avatar.rotation = 0;
      avatar.targetRotation = 0;
      avatar.setState("sit");
    }

    this.ctx.interactionManager?.showPrompt("Em reunião na Sala de Guerra · [E] ou [Esc] Levantar");
    this.updateActiveButton();
  }

  standUp() {
    if (!this.isSeated) return;
    playClickSound();

    const avatar = this.ctx.avatar;
    if (avatar) {
      if (this.seatedType === "war_room") {
        avatar.position.set(this.ctx.positions.warStandUpPos.x, this.ctx.positions.warStandUpPos.y, this.ctx.positions.warStandUpPos.z);
        avatar.rotation = 0;
        avatar.targetRotation = 0;
      } else {
        avatar.position.set(this.ctx.positions.standUpPos.x, this.ctx.positions.standUpPos.y, this.ctx.positions.standUpPos.z);
        avatar.rotation = Math.PI;
        avatar.targetRotation = Math.PI;
      }
      avatar.setState("idle");
      avatar.setFirstPersonMode(false);
    }

    this.isSeated = false;
    this.seatedType = "none";
    this.setViewMode("third_person");

    if (this.ctx.cssRenderer) this.ctx.cssRenderer.domElement.style.pointerEvents = "none";
    this.ctx.interactionManager?.hidePrompt();
    this.updateActiveButton();
  }

  openWarRoomDrawer(tab = "workflows") {
    playClickSound();
    window.dispatchEvent(new CustomEvent("dai:openWarRoom", { detail: { tab } }));
  }

  openAgentDossier(agentKey) {
    playClickSound();
    window.dispatchEvent(new CustomEvent("dai:openAgentDossier", { detail: { agentKey } }));
  }
}
