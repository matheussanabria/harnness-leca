// @ts-check
/**
 * DAI HQ — Laço de animação único por motor, com pausa por visibilidade (EP-03.09).
 * Centraliza requestAnimationFrame para evitar loops duplicados e trabalho em aba oculta.
 */
export class FrameLoop {
  /**
   * @param {Object} options
   * @param {Document | any} [options.doc]
   * @param {(time: number, dt: number) => void} options.onFrame
   * @param {() => number} [options.now]
   * @param {(callback: FrameRequestCallback) => number} [options.request]
   * @param {(id: number) => void} [options.cancel]
   */
  constructor(options) {
    this.doc = options.doc ?? (typeof document !== "undefined" ? document : null);
    this.onFrame = options.onFrame;
    this.now = options.now || (() => performance.now());
    this.request = options.request || ((callback) => requestAnimationFrame(callback));
    this.cancel = options.cancel || ((id) => cancelAnimationFrame(id));

    this.active = false;
    this.paused = false;
    this.rafId = null;
    this.lastTime = 0;

    this.onVisibilityChange = this.onVisibilityChange.bind(this);
    this.doc?.addEventListener?.("visibilitychange", this.onVisibilityChange);
  }

  get isRunning() {
    return this.active && !this.paused;
  }

  start() {
    this.active = true;
    this.resume();
  }

  stop() {
    this.active = false;
    this.pause();
  }

  pause() {
    this.paused = true;
    this.cancelFrame();
  }

  resume() {
    this.paused = false;
    this.schedule();
  }

  onVisibilityChange() {
    if (this.doc?.hidden) this.pause();
    else this.resume();
  }

  schedule() {
    if (this.rafId || !this.active || this.paused || this.doc?.hidden) return;
    this.lastTime = this.now();
    const tick = (time) => {
      if (!this.active || this.paused || this.doc?.hidden) {
        this.rafId = null;
        return;
      }
      const dt = Math.min((time - this.lastTime) * 0.001, 0.1);
      this.lastTime = time;
      this.onFrame(time, dt);
      this.rafId = this.request(tick);
    };
    this.rafId = this.request(tick);
  }

  cancelFrame() {
    if (!this.rafId) return;
    this.cancel(this.rafId);
    this.rafId = null;
  }

  dispose() {
    this.stop();
    this.doc?.removeEventListener?.("visibilitychange", this.onVisibilityChange);
  }
}
