// @ts-check
// DAI HQ — Controlador de Teclado e Movimentação do Avatar com Wall Sliding
import { playStepSound } from "../office-audio.js";
import { isNavigationBlocked, handleNavigationKey } from "../window-manager/focus-manager.js";
import { windowManager } from "../window-manager/window-manager.js";

export class AvatarMovementController {
  /**
   * @param {Object} ctx
   * @param {any} ctx.avatar
   * @param {any} ctx.physics
   * @param {any} ctx.cameraController
   * @param {any} ctx.interactionManager
   * @param {any} ctx.seatManager
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.keys = {};
    this.stepTimer = 0;

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
  }

  attachListeners() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", () => { this.keys = {}; });
  }

  detachListeners() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }

  onKeyDown(e) {
    // 1. Processar atalhos globais prioritários (como Escape)
    const keyResult = handleNavigationKey(e, {
      windowManager,
      isPointerLocked: () => !!document.pointerLockElement,
      exitPointerLock: () => { if (document.pointerLockElement) document.exitPointerLock(); },
      standUp: () => { if (this.ctx.seatManager?.isSeated) this.ctx.seatManager.standUp(); },
      isSeated: this.ctx.seatManager?.isSeated
    });
    if (keyResult.handled) return;

    // 2. Bloquear navegação se o foco estiver em campo de texto ou janela ativa
    if (isNavigationBlocked()) {
      this.keys = {};
      return;
    }

    this.keys[e.code] = true;
    const k = e.key.toLowerCase();

    if (k === "e") {
      if (this.ctx.seatManager.isSeated) this.ctx.seatManager.standUp();
      else this.ctx.interactionManager?.triggerCurrent();
    } else if (k === "c") {
      if (!this.ctx.seatManager.isSeated && this.ctx.seatManager.viewMode !== "orbit") {
        const next = this.ctx.seatManager.viewMode === "third_person" ? "first_person" : "third_person";
        this.ctx.seatManager.setViewMode(next);
      }
    } else if (k === "h") {
      window.dispatchEvent(new CustomEvent("dai:toggleHud"));
    }
  }

  onKeyUp(e) {
    if (isNavigationBlocked()) {
      this.keys = {};
      return;
    }
    this.keys[e.code] = false;
  }

  update(dt) {
    const avatar = this.ctx.avatar;
    const seatManager = this.ctx.seatManager;
    if (!avatar) return;

    if (seatManager.isSeated) {
      avatar.update(dt);
      return;
    }

    const isShift = !!(this.keys.ShiftLeft || this.keys.ShiftRight);
    const moveSpeed = isShift ? 5.2 : 3.0;

    const yaw = this.ctx.cameraController?.camYaw || 0;
    const forwardX = Math.sin(yaw);
    const forwardZ = Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    let inputX = 0;
    let inputZ = 0;

    if (this.keys.KeyW) { inputX += forwardX; inputZ += forwardZ; }
    if (this.keys.KeyS) { inputX -= forwardX; inputZ -= forwardZ; }
    if (this.keys.KeyD) { inputX -= rightX; inputZ -= rightZ; }
    if (this.keys.KeyA) { inputX += rightX; inputZ += rightZ; }

    const moveLen = Math.hypot(inputX, inputZ);
    if (moveLen > 0.001) {
      inputX /= moveLen;
      inputZ /= moveLen;

      const deltaX = inputX * moveSpeed * dt;
      const deltaZ = inputZ * moveSpeed * dt;

      avatar.targetRotation = Math.atan2(inputX, inputZ);
      avatar.setState(isShift ? "run" : "walk");

      this.stepTimer += dt * (isShift ? 3.5 : 2.5);
      if (this.stepTimer > 1.0) {
        playStepSound();
        this.stepTimer = 0;
      }

      // Teste de colisão com Wall Sliding
      const nextX = avatar.position.x + deltaX;
      const nextZ = avatar.position.z + deltaZ;

      if (!this.ctx.physics.checkCollision(nextX, avatar.position.z, seatManager.isSeated, seatManager.seatedType)) {
        avatar.position.x = nextX;
      }
      if (!this.ctx.physics.checkCollision(avatar.position.x, nextZ, seatManager.isSeated, seatManager.seatedType)) {
        avatar.position.z = nextZ;
      }
    } else {
      avatar.setState("idle");
      this.stepTimer = 0;
      if (seatManager.viewMode === "third_person" || seatManager.viewMode === "first_person") {
        avatar.targetRotation = yaw;
      }
    }

    avatar.update(dt);
    this.ctx.interactionManager?.updateProximity(avatar.position);
  }
}
