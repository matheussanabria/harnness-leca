// @ts-check
// DAI HQ — Fachada Orquestradora do Motor Isométrico 2.5D (Canvas Nativo)
import { officeState } from "./office-state.js";
import { DEFAULT_GRID_CONFIG, OFFICE_2D_OBJECTS } from "./office2d/map-objects.js";
import { Player2DController } from "./office2d/player-controller.js";
import { IsoSceneRenderer } from "./office2d/iso-scene-renderer.js";
import { isNavigationBlocked, handleNavigationKey } from "./window-manager/focus-manager.js";
import { windowManager } from "./window-manager/window-manager.js";
import { executeOfficeAction } from "./office/office-action-dispatcher.js";

export class Office2D {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLElement} tooltipEl
   */
  constructor(canvas, tooltipEl) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.tooltip = tooltipEl;
    this.animFrame = null;
    this.time = 0;

    this.gridW = DEFAULT_GRID_CONFIG.gridW;
    this.gridH = DEFAULT_GRID_CONFIG.gridH;
    this.tileW = DEFAULT_GRID_CONFIG.tileW;
    this.tileH = DEFAULT_GRID_CONFIG.tileH;

    this.originX = 0;
    this.originY = 0;

    this.hoveredObject = null;
    this.mousePos = { x: 0, y: 0 };
    this.keys = {};

    this.objects = OFFICE_2D_OBJECTS;
    this.playerController = new Player2DController();
    this.renderer = new IsoSceneRenderer();

    this.onResize = this.onResize.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.toScreen = this.toScreen.bind(this);

    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.canvas.addEventListener("mousemove", this.onMouseMove);
    this.canvas.addEventListener("click", this.onClick);

    this.onResize();
  }

  get player() {
    return this.playerController.player;
  }

  get nearbyObject() {
    return this.playerController.nearbyObject;
  }

  start() {
    this.canvas.style.display = "block";
    if (this.animFrame) return;

    let lastT = performance.now();
    const loop = (t) => {
      const dt = Math.min((t - lastT) * 0.001, 0.1);
      lastT = t;
      this.time = t * 0.001;
      this.update(dt);
      this.render();
      this.animFrame = requestAnimationFrame(loop);
    };
    this.animFrame = requestAnimationFrame(loop);
  }

  stop() {
    this.canvas.style.display = "none";
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    if (this.tooltip) this.tooltip.style.display = "none";
  }

  onResize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.scale(dpr, dpr);
    this.originX = window.innerWidth / 2;
    this.originY = window.innerHeight / 2 - 80;
  }

  toScreen(gx, gy, gz = 0) {
    const sx = this.originX + (gx - gy) * (this.tileW / 2);
    const sy = this.originY + (gx + gy) * (this.tileH / 2) - gz * this.tileH;
    return { x: sx, y: sy };
  }

  toGrid(sx, sy) {
    const relX = (sx - this.originX) / (this.tileW / 2);
    const relY = (sy - this.originY) / (this.tileH / 2);
    const gx = (relX + relY) / 2;
    const gy = (relY - relX) / 2;
    return { gx, gy };
  }

  onKeyDown(e) {
    const keyResult = handleNavigationKey(e, { windowManager });
    if (keyResult.handled) return;

    if (isNavigationBlocked()) {
      this.keys = {};
      return;
    }

    const k = e.key.toLowerCase();
    this.keys[k] = true;
    if ((k === "e" || k === " ") && this.nearbyObject) {
      e.preventDefault();
      this.interactWith(this.nearbyObject);
    }
  }

  onKeyUp(e) {
    if (isNavigationBlocked()) {
      this.keys = {};
      return;
    }
    this.keys[e.key.toLowerCase()] = false;
  }

  onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    let found = null;
    let minDist = 36;

    for (const obj of this.objects) {
      const pos = this.toScreen(obj.gx + obj.w / 2, obj.gy + obj.h / 2, obj.gz);
      const visualCenterY = pos.y - 25;
      const dx = this.mousePos.x - pos.x;
      const dy = this.mousePos.y - visualCenterY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < minDist) {
        minDist = dist;
        found = obj;
      }
    }

    this.hoveredObject = found;
    if (found) {
      this.canvas.style.cursor = "pointer";
      if (this.tooltip) {
        this.tooltip.style.display = "block";
        this.tooltip.style.left = `${e.clientX}px`;
        this.tooltip.style.top = `${e.clientY - 15}px`;
        const iconHtml = (found.icon && found.icon.includes("fa-")) ? `<i class="${found.icon}" style="margin-right:6px"></i>` : `${found.icon || ""} `;
        this.tooltip.innerHTML = `<b>${iconHtml}${found.name}</b><br><span style="font-size:11px;color:var(--office-mute)">Clique para inspecionar</span>`;
      }
    } else {
      this.canvas.style.cursor = "crosshair";
      if (this.tooltip) this.tooltip.style.display = "none";
    }
  }

  onClick() {
    if (this.hoveredObject) {
      this.interactWith(this.hoveredObject);
      this.playerController.moveToTarget(
        Math.max(0.5, this.hoveredObject.gx - 0.5),
        Math.max(0.5, this.hoveredObject.gy + 0.8)
      );
      return;
    }

    const grid = this.toGrid(this.mousePos.x, this.mousePos.y);
    if (grid.gx >= 0 && grid.gx < this.gridW && grid.gy >= 0 && grid.gy < this.gridH) {
      this.playerController.moveToTarget(
        Math.max(0.5, Math.min(this.gridW - 0.5, grid.gx)),
        Math.max(0.5, Math.min(this.gridH - 0.5, grid.gy))
      );
    }
  }

  interactWith(obj) {
    if (!obj) return;
    executeOfficeAction(obj.id, { officeState, windowManager });
  }

  update(dt) {
    this.playerController.update(dt, this.keys, this.objects, this.gridW, this.gridH);
  }

  render() {
    const ctx = this.ctx;
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    this.renderer.renderFloor(ctx, this.gridW, this.gridH, this.toScreen);
    this.renderer.renderWalls(ctx, this.gridW, this.gridH, this.toScreen);

    const renderList = [
      ...this.objects.map(o => ({ type: "object", data: o, depth: o.gx + o.gy })),
      { type: "player", data: this.player, depth: this.player.gx + this.player.gy }
    ].sort((a, b) => a.depth - b.depth);

    for (const item of renderList) {
      if (item.type === "object") {
        this.renderer.renderObject(ctx, item.data, this.hoveredObject === item.data, this.toScreen, this.time);
      } else {
        this.renderer.renderPlayer(ctx, item.data, this.toScreen, this.time);
      }
    }

    if (this.nearbyObject) {
      this.renderer.renderInteractionBubble(ctx, this.player, this.nearbyObject, this.toScreen);
    }
  }
}
