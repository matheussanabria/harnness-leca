// @ts-check
// DAI HQ — Controlador de Jogador Isométrico 2.5D (WASD, Setas e Click-to-Move)
import { playStepSound } from "../office-audio.js";

export class Player2DController {
  /**
   * @param {Object} [initial]
   */
  constructor(initial = {}) {
    this.player = {
      gx: initial.gx ?? 5.5,
      gy: initial.gy ?? 5.5,
      targetGx: initial.targetGx ?? 5.5,
      targetGy: initial.targetGy ?? 5.5,
      speed: 3.8, // tiles por segundo
      isMoving: false,
      direction: "down", // "down", "up", "left", "right"
      animTimer: 0,
      seated: false,
      seatId: null,
      standTarget: { gx: 5.5, gy: 5.5 },
    };
    this.nearbyObject = null;
  }

  moveToTarget(gx, gy) {
    this.player.targetGx = gx;
    this.player.targetGy = gy;
    playStepSound();
  }

  /**
   * @param {string} seatId
   * @param {number} gx
   * @param {number} gy
   * @param {number} standX
   * @param {number} standY
   */
  seatAt(seatId, gx, gy, standX, standY) {
    const p = this.player;
    p.seated = true;
    p.seatId = seatId;
    p.gx = gx;
    p.gy = gy;
    p.targetGx = gx;
    p.targetGy = gy;
    p.standTarget = { gx: standX, gy: standY };
    p.isMoving = false;
    p.direction = "up";
    this.nearbyObject = null;
  }

  /** @returns {boolean} */
  standUp() {
    const p = this.player;
    if (!p.seated) return false;
    p.seated = false;
    p.seatId = null;
    p.targetGx = p.standTarget.gx;
    p.targetGy = p.standTarget.gy;
    return true;
  }

  update(dt, keys, objects, gridW, gridH) {
    const p = this.player;

    if (p.seated) {
      p.isMoving = false;
      this.nearbyObject = null;
      return;
    }

    // 1. Movimento via Teclado (WASD / Setas)
    let moveX = 0;
    let moveY = 0;

    if (keys["w"] || keys["arrowup"]) { moveX -= 1; moveY -= 1; p.direction = "up"; }
    if (keys["s"] || keys["arrowdown"]) { moveX += 1; moveY += 1; p.direction = "down"; }
    if (keys["a"] || keys["arrowleft"]) { moveX -= 1; moveY += 1; p.direction = "left"; }
    if (keys["d"] || keys["arrowright"]) { moveX += 1; moveY += 1; p.direction = "right"; }

    if (moveX !== 0 || moveY !== 0) {
      const len = Math.sqrt(moveX * moveX + moveY * moveY);
      const step = (p.speed * dt);
      p.gx += (moveX / len) * step;
      p.gy += (moveY / len) * step;
      p.targetGx = p.gx;
      p.targetGy = p.gy;
      p.isMoving = true;
      p.animTimer += dt * 10;
      playStepSound();
    } else {
      // 2. Movimento suave até o targetGx/targetGy (Click-to-Move)
      const dx = p.targetGx - p.gx;
      const dy = p.targetGy - p.gy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0.08) {
        p.isMoving = true;
        const step = Math.min(p.speed * dt, dist);
        p.gx += (dx / dist) * step;
        p.gy += (dy / dist) * step;
        p.animTimer += dt * 10;

        if (Math.abs(dx) > Math.abs(dy)) {
          p.direction = dx > 0 ? "right" : "left";
        } else {
          p.direction = dy > 0 ? "down" : "up";
        }
        playStepSound();
      } else {
        p.isMoving = false;
      }
    }

    // Limites da sala
    p.gx = Math.max(0.6, Math.min(gridW - 0.6, p.gx));
    p.gy = Math.max(0.6, Math.min(gridH - 0.6, p.gy));

    // 3. Proximidade com móveis para balão [E]
    let nearest = null;
    let nearestDist = 2.0;

    for (const obj of objects) {
      const ox = obj.gx + (obj.w / 2);
      const oy = obj.gy + (obj.h / 2);
      const d = Math.sqrt((p.gx - ox) ** 2 + (p.gy - oy) ** 2);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = obj;
      }
    }
    this.nearbyObject = nearest;
  }
}
