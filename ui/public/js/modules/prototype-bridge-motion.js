// @ts-check
// Motion runtime inside the prototype iframe (ADR-018, EP-24.02). Injected only when the screen has a timeline.
// Reads the motion@1 JSON from <script type="application/json" id="harness-motion">, builds one paused Web Animation
// per track and drives currentTime itself, so seek(ms) is deterministic. Also runs at top level (export, 24.05).
(() => {
  const PX_PROPS = { width: 1, height: 1, "border-radius": 1 };

  /** @param {string} name */
  const camel = (name) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

  /** @param {string} name @param {unknown} value */
  function cssValue(name, value) {
    if (typeof value !== "number") return value;
    if (name === "opacity") return value;
    return PX_PROPS[name] ? `${value}px` : String(value);
  }

  /**
   * Converts a motion@1 track into WAAPI keyframes over the whole timeline.
   * Missing props are carried forward (and back-filled), keys at offset 0 and 1 are added so every frame is defined,
   * and the `ease` of a key (segment that ends at it) moves to the previous keyframe, as WAAPI expects.
   * @param {{ keys: { t: number, props: Record<string, unknown>, ease?: string }[] }} track
   * @param {number} duration
   */
  function toKeyframes(track, duration) {
    const keys = track.keys.slice().sort((a, b) => a.t - b.t);
    const names = [...new Set(keys.flatMap((k) => Object.keys(k.props || {})))];
    /** @type {Record<string, unknown>} */
    const carry = {};
    for (const name of names) carry[name] = keys.find((k) => k.props && name in k.props)?.props[name];
    const frames = keys.map((k) => {
      for (const name of names) if (k.props && name in k.props) carry[name] = k.props[name];
      /** @type {Record<string, unknown>} */
      const frame = { offset: duration > 0 ? Math.min(1, Math.max(0, k.t / duration)) : 0 };
      for (const name of names) frame[camel(name)] = cssValue(name, carry[name]);
      return frame;
    });
    keys.forEach((k, i) => { if (i > 0 && k.ease) frames[i - 1].easing = k.ease; });
    if (frames.length && frames[0].offset > 0) frames.unshift({ ...frames[0], offset: 0, easing: "linear" });
    if (frames.length && frames[frames.length - 1].offset < 1) {
      const last = { ...frames[frames.length - 1], offset: 1 };
      delete last.easing;
      frames.push(last);
    }
    return frames;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { toKeyframes, cssValue };
    return;
  }
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const inFrame = window !== window.top;
  /** @param {string} type @param {object} [payload] */
  const send = (type, payload = {}) => { if (inFrame) window.parent.postMessage({ type, ...payload }, "*"); };
  const nextPaint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined))));

  /** @type {{ doc: any, anims: Animation[], time: number, playing: boolean, base: number, raf: number, lastSent: number }} */
  const state = { doc: null, anims: [], time: 0, playing: false, base: 0, raf: 0, lastSent: -1 };

  /** @param {string} pid */
  function findTarget(pid) {
    const sel = `[data-pid="${typeof CSS !== "undefined" && CSS.escape ? CSS.escape(pid) : pid}"]`;
    return document.querySelector(sel);
  }

  /** @param {number} ms */
  function apply(ms) {
    const duration = state.doc ? state.doc.duration : 0;
    state.time = Math.max(0, Math.min(duration, ms));
    for (const anim of state.anims) anim.currentTime = state.time;
  }

  /** @param {any} doc */
  function load(doc) {
    stop();
    for (const anim of state.anims) anim.cancel();
    state.anims = [];
    state.doc = doc && Array.isArray(doc.tracks) && doc.duration > 0 ? doc : null;
    if (!state.doc) return;
    for (const track of state.doc.tracks) {
      const el = track && typeof track.target === "string" ? findTarget(track.target) : null;
      if (!el || !Array.isArray(track.keys) || !track.keys.length) continue; // orphan or empty track: ignored
      try {
        const anim = el.animate(/** @type {Keyframe[]} */ (toKeyframes(track, state.doc.duration)), { duration: state.doc.duration, fill: "both" });
        anim.pause();
        state.anims.push(anim);
      } catch { /* a value the browser cannot animate skips that track only */ }
    }
    apply(Math.min(state.time, state.doc.duration));
    send("HARNESS_MOTION_READY", { duration: state.doc.duration, fps: state.doc.fps, tracks: state.anims.length });
  }

  function stop() {
    state.playing = false;
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
  }

  /** @param {number} now */
  function tick(now) {
    if (!state.playing || !state.doc) return;
    const { duration, loop } = state.doc;
    let t = now - state.base;
    if (t >= duration) {
      if (loop) {
        t %= duration;
        state.base = now - t;
      } else {
        apply(duration);
        stop();
        send("HARNESS_MOTION_TIME", { ms: duration });
        send("HARNESS_MOTION_ENDED", { ms: duration });
        return;
      }
    }
    apply(t);
    if (Math.round(t) !== state.lastSent) {
      state.lastSent = Math.round(t);
      send("HARNESS_MOTION_TIME", { ms: state.lastSent });
    }
    state.raf = requestAnimationFrame(tick);
  }

  function play() {
    if (!state.doc || state.playing) return;
    if (state.time >= state.doc.duration) apply(0);
    state.playing = true;
    state.base = performance.now() - state.time;
    state.raf = requestAnimationFrame(tick);
  }

  function pause() {
    stop();
    send("HARNESS_MOTION_TIME", { ms: Math.round(state.time) });
  }

  /** @param {number} ms */
  async function seek(ms) {
    stop();
    apply(Number(ms) || 0);
    await nextPaint();
    send("HARNESS_MOTION_SEEKED", { ms: state.time });
    return state.time;
  }

  async function whenReady() {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    await Promise.all(Array.from(document.images, (img) => (img.decode ? img.decode().catch(() => undefined) : undefined)));
    await nextPaint();
  }

  let doc = null;
  try { doc = JSON.parse(document.getElementById("harness-motion")?.textContent || "null"); } catch { doc = null; }
  load(doc);
  const ready = whenReady();

  // @ts-ignore
  window.__harnessMotion = { seek, play, pause, load, ready, time: () => state.time, duration: () => (state.doc ? state.doc.duration : 0) };

  window.addEventListener("message", (e) => {
    if (!inFrame || e.source !== window.parent) return;
    const data = e.data && typeof e.data === "object" ? e.data : null;
    if (!data) return;
    if (data.type === "HARNESS_MOTION_SEEK") seek(data.ms);
    else if (data.type === "HARNESS_MOTION_PLAY") play();
    else if (data.type === "HARNESS_MOTION_PAUSE") pause();
    else if (data.type === "HARNESS_MOTION_LOAD") load(data.doc);
  });
})();
