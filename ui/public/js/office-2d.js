// @ts-check
// DAI HQ — Fachada Orquestradora do Motor Isométrico 2.5D (Canvas Nativo)
import { officeState } from "./office-state.js";
import { DEFAULT_GRID_CONFIG, OFFICE_2D_OBJECTS } from "./office2d/map-objects.js";
import { Player2DController } from "./office2d/player-controller.js";
import { IsoSceneRenderer } from "./office2d/iso-scene-renderer.js";
import { createOffice2DActionContext } from "./office2d/action-bridge.js";
import { getOfficeObject } from "./office/office-object-catalog.js";
import { isNavigationBlocked, handleNavigationKey } from "./window-manager/focus-manager.js";
import { windowManager } from "./window-manager/window-manager.js";
import { executeOfficeAction } from "./office/office-action-dispatcher.js";
import { clampPixelRatio } from "./office/scene-preferences.js";
import { FrameLoop } from "./office/frame-loop.js";

export class Office2D {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLElement} tooltipEl
   * @param {Object} [options]
   * @param {Document | any} [options.doc]
   * @param {Window | any} [options.win]
   */
  constructor(canvas, tooltipEl, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.tooltip = tooltipEl;
    this.doc = options.doc ?? (typeof document !== "undefined" ? document : null);
    this.win = options.win ?? (typeof window !== "undefined" ? window : null);
    this.reducedMotion = false;
    this.maxPixelRatio = 2;
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
    this.lastScreenFocus = null;
    this.actionContext = createOffice2DActionContext({
      officeState,
      windowManager,
      onSeat: (seatId) => this.seatPlayer(seatId),
      onScreenFocus: (targetScreen, preset) => {
        this.lastScreenFocus = { targetScreen, preset };
      }
    });
    this.loop = new FrameLoop({
      doc: this.doc,
      onFrame: (time, dt) => {
        this.time = time * 0.001;
        this.update(dt);
        this.render();
      }
    });

    this.onResize = this.onResize.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.toScreen = this.toScreen.bind(this);

    this.win?.addEventListener?.("resize", this.onResize);
    this.win?.addEventListener?.("keydown", this.onKeyDown);
    this.win?.addEventListener?.("keyup", this.onKeyUp);
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
    this.loop.start();
  }

  stop() {
    this.canvas.style.display = "none";
    this.loop.stop();
    if (this.tooltip) this.tooltip.style.display = "none";
  }

  applyPerformanceProfile(profile) {
    this.maxPixelRatio = Number(profile?.maxPixelRatio) || 2;
    this.onResize();
  }

  setReducedMotion(reduced) {
    this.reducedMotion = Boolean(reduced);
  }

  onResize() {
    const width = this.win?.innerWidth || 0;
    const height = this.win?.innerHeight || 0;
    const dpr = clampPixelRatio(this.win?.devicePixelRatio || 1, this.maxPixelRatio);
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);

    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.originX = width / 2;
    this.originY = height / 2 - 80;
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
    if ((k === "e" || k === " ") && this.player.seated) {
      e.preventDefault();
      this.playerController.standUp();
      return;
    }
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
    if (this.player.seated) {
      this.playerController.standUp();
      return;
    }

    if (this.hoveredObject) {
      const result = this.interactWith(this.hoveredObject);
      if (result?.actionType === "seat" || this.player.seated) return;
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
    if (!obj) return null;
    return executeOfficeAction(obj.id, this.actionContext);
  }

  seatPlayer(seatId) {
    const descriptor = getOfficeObject(seatId);
    const spot = descriptor?.position2D;
    if (!spot) return false;
    this.playerController.seatAt(
      seatId,
      spot.gx,
      spot.gy,
      Math.min(this.gridW - 0.6, spot.gx + 0.9),
      Math.min(this.gridH - 0.6, spot.gy + 0.9)
    );
    return true;
  }

  update(dt) {
    this.playerController.update(dt, this.keys, this.objects, this.gridW, this.gridH);
  }

  render() {
    const ctx = this.ctx;
    const w = this.win?.innerWidth || 0;
    const h = this.win?.innerHeight || 0;
    const time = this.reducedMotion ? 0 : this.time;
    ctx.clearRect(0, 0, w, h);

    this.renderer.renderFloor(ctx, this.gridW, this.gridH, this.toScreen);
    this.renderer.renderWalls(ctx, this.gridW, this.gridH, this.toScreen);

    const renderList = [
      ...this.objects.map(o => ({ type: "object", data: o, depth: o.gx + o.gy })),
      { type: "player", data: this.player, depth: this.player.gx + this.player.gy }
    ].sort((a, b) => a.depth - b.depth);

    for (const item of renderList) {
      if (item.type === "object") {
        this.renderer.renderObject(ctx, item.data, this.hoveredObject === item.data, this.toScreen, time);
      } else {
        this.renderer.renderPlayer(ctx, item.data, this.toScreen, time);
      }
    }

    if (this.nearbyObject || this.player.seated) {
      this.renderer.renderInteractionBubble(ctx, this.player, this.nearbyObject, this.toScreen);
    }
  }
}
