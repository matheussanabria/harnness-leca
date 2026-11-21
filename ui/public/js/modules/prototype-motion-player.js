// @ts-check
// Atelier motion player (EP-24.03, prototype docs/features/motion-player/03-prototype.html): the Motion button and the
// transport bar under the preview. The button only shows when the iframe runtime (EP-24.02) announces a timeline.
// Talks to the runtime with HARNESS_MOTION_* messages; state rules live in prototype-motion-state.js.
import {
  createMotionState, onReady, onTime, onEnded, stepTime, clampTime, formatTime, timeValueText,
} from "./prototype-motion-state.js";
import { readAtelierState, saveAtelierState } from "./prototype-atelier-state.js";

const IFRAME_ID = "atelierIframe";
const BUTTON_ID = "btnAtelierMotion";
const BAR_ID = "atelierMotionBar";

let s = createMotionState();
let installed = false;
let sawReady = false;
let scrubFrame = 0;

const byId = (/** @type {string} */ id) => document.getElementById(id);
const iframe = () => /** @type {HTMLIFrameElement | null} */ (byId(IFRAME_ID));

/** @param {Record<string, unknown>} msg */
function post(msg) {
  iframe()?.contentWindow?.postMessage(msg, "*");
}

function barTemplate() {
  return `
    <div class="proto-motion__transport" role="group" aria-label="Player de motion">
      <button type="button" class="btn-proto-vp" data-motion="start" title="Voltar ao início (Home)" aria-label="Voltar ao início"><i class="fa-solid fa-backward-step"></i></button>
      <button type="button" class="btn-proto-vp" data-motion="play" title="Tocar (Espaço)" aria-label="Tocar"><i class="fa-solid fa-play"></i></button>
      <button type="button" class="btn-proto-vp" data-motion="loop" title="Repetir" aria-label="Repetir" aria-pressed="false"><i class="fa-solid fa-repeat"></i></button>
      <span class="proto-motion__time" data-motion="time"></span>
      <div class="proto-motion__scrub-wrap">
        <div class="proto-motion__ticks" data-motion="ticks" aria-hidden="true"></div>
        <input type="range" class="proto-motion__scrub" data-motion="scrub" min="0" step="1" aria-label="Posição da animação" />
      </div>
      <span class="proto-motion__sep"></span>
      <span class="proto-motion__meta" data-motion="meta"></span>
      <span class="proto-motion__sep"></span>
      <button type="button" class="btn-proto-vp" disabled title="Exportar vídeo (em breve)"><i class="fa-solid fa-file-video"></i> Exportar</button>
    </div>
    <div class="proto-motion__hint"><kbd>Espaço</kbd> toca ou pausa · <kbd>Home</kbd> volta ao início · <kbd>&larr;</kbd> <kbd>&rarr;</kbd> um quadro · as marcas acima da barra são os keyframes</div>
    <div class="proto-motion__empty" data-motion="empty"><i class="fa-solid fa-circle-info"></i> Esta tela não tem animação. Peça no chat, por exemplo: "entrada em cascata dos cards".</div>`;
}

/** @param {HTMLElement} bar @param {string} key */
const part = (bar, key) => /** @type {HTMLElement} */ (bar.querySelector(`[data-motion="${key}"]`));

/** Paints the button and the bar from the state; builds the bar once per render of the Atelier view. */
export function paintMotion() {
  const button = byId(BUTTON_ID);
  if (button) {
    button.hidden = !s.has;
    button.classList.toggle("active", s.open && s.has);
    button.setAttribute("aria-pressed", String(s.open && s.has));
  }
  const bar = byId(BAR_ID);
  if (!bar) return;
  bar.hidden = !s.open;
  if (!s.open) return;
  if (bar.dataset.built !== "1") {
    bar.innerHTML = barTemplate();
    bar.dataset.built = "1";
  }
  bar.classList.toggle("is-empty", !s.has);
  part(bar, "empty").hidden = s.has;
  const play = part(bar, "play");
  play.innerHTML = s.playing ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
  play.setAttribute("aria-label", s.playing ? "Pausar" : "Tocar");
  play.title = s.playing ? "Pausar (Espaço)" : "Tocar (Espaço)";
  const loop = part(bar, "loop");
  loop.classList.toggle("active", s.loop);
  loop.setAttribute("aria-pressed", String(s.loop));
  part(bar, "time").textContent = `${formatTime(s.time)} / ${formatTime(s.duration)}`;
  const scrub = /** @type {HTMLInputElement} */ (part(bar, "scrub"));
  scrub.max = String(s.duration);
  if (document.activeElement !== scrub || s.playing) scrub.value = String(Math.round(s.time));
  scrub.setAttribute("aria-valuetext", timeValueText(s.time, s.duration));
  part(bar, "meta").textContent = `${s.fps} fps · ${s.tracks} ${s.tracks === 1 ? "faixa" : "faixas"}`;
  part(bar, "ticks").innerHTML = s.duration
    ? s.keyTimes.map((t) => `<i style="left:${((t / s.duration) * 100).toFixed(3)}%"></i>`).join("")
    : "";
}

/** @param {Partial<import("./prototype-motion-state.js").MotionState>} patch */
function update(patch) {
  s = { ...s, ...patch };
  paintMotion();
}

function play() {
  if (!s.has) return;
  if (s.time >= s.duration) post({ type: "HARNESS_MOTION_SEEK", ms: 0 });
  post({ type: "HARNESS_MOTION_PLAY" });
  update({ playing: true });
}

function pause() {
  post({ type: "HARNESS_MOTION_PAUSE" });
  update({ playing: false });
}

/** @param {number} ms */
function seek(ms) {
  const time = clampTime(s, ms);
  if (s.playing) post({ type: "HARNESS_MOTION_PAUSE" });
  post({ type: "HARNESS_MOTION_SEEK", ms: time });
  update({ time, playing: false });
}

/** @param {boolean} open */
function setOpen(open) {
  if (!open && s.playing) pause();
  update({ open });
  void saveAtelierState({ motionOpen: open });
}

/** @param {string} action */
function runAction(action) {
  if (action === "toggle") setOpen(!s.open);
  else if (action === "play") (s.playing ? pause() : play());
  else if (action === "start") seek(0);
  else if (action === "loop") {
    update({ loop: !s.loop });
    post({ type: "HARNESS_MOTION_LOOP", loop: s.loop });
  }
}

/** @param {MessageEvent} event @returns {boolean} true when the message was a motion message */
export function handleMotionMessage(event) {
  const data = event.data;
  if (!data || typeof data !== "object" || typeof data.type !== "string" || !data.type.startsWith("HARNESS_MOTION_")) return false;
  const frame = iframe();
  if (!frame || event.source !== frame.contentWindow) return true;
  if (data.type === "HARNESS_MOTION_READY") {
    sawReady = true;
    s = onReady(s, data);
    if (s.loop) post({ type: "HARNESS_MOTION_LOOP", loop: true });
    if (s.time > 0) post({ type: "HARNESS_MOTION_SEEK", ms: s.time });
    paintMotion();
  } else if (data.type === "HARNESS_MOTION_TIME" || data.type === "HARNESS_MOTION_SEEKED") {
    s = onTime(s, data.ms);
    paintMotion();
  } else if (data.type === "HARNESS_MOTION_ENDED") {
    s = onEnded(s);
    paintMotion();
  }
  return true;
}

/** Iframe finished loading: no READY since the last load means this screen has no timeline. */
function onFrameLoad() {
  if (!sawReady) update({ has: false, playing: false, duration: 0, tracks: 0, keyTimes: [], time: 0 });
  sawReady = false;
}

/** @param {KeyboardEvent} e */
function onKey(e) {
  const frame = iframe();
  if (!s.open || !s.has || !frame || !frame.isConnected || frame.offsetParent === null) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const target = /** @type {HTMLElement} */ (e.target);
  const onScrub = target?.dataset?.motion === "scrub";
  if (!onScrub && (target?.isContentEditable || /^(input|textarea|select)$/i.test(target?.tagName || ""))) return;
  // A focused button already activates on Space; handling it here too would toggle twice.
  if (e.key === " " && target?.tagName === "BUTTON") return;
  if (e.key === " ") { e.preventDefault(); runAction("play"); }
  else if (e.key === "Home") { e.preventDefault(); seek(0); }
  else if (!onScrub && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
    e.preventDefault();
    seek(stepTime(s, e.key === "ArrowRight" ? 1 : -1));
  }
}

/** Installs the listeners once; restores the saved open state. Safe to call on every Atelier render. */
export function setupMotionPlayer() {
  paintMotion();
  if (installed) return;
  installed = true;
  window.addEventListener("message", (e) => { handleMotionMessage(e); });
  document.addEventListener("load", (e) => { if (/** @type {HTMLElement} */ (e.target)?.id === IFRAME_ID) onFrameLoad(); }, true);
  document.addEventListener("keydown", onKey);
  document.addEventListener("click", (e) => {
    const el = /** @type {HTMLElement} */ (e.target)?.closest?.(`#${BUTTON_ID}, #${BAR_ID} [data-motion]`);
    if (!el) return;
    runAction(el.id === BUTTON_ID ? "toggle" : /** @type {HTMLElement} */ (el).dataset.motion || "");
  });
  document.addEventListener("input", (e) => {
    const el = /** @type {HTMLInputElement} */ (e.target);
    if (el?.dataset?.motion !== "scrub") return;
    if (s.playing) pause();
    cancelAnimationFrame(scrubFrame);
    scrubFrame = requestAnimationFrame(() => seek(Number(el.value)));
  });
  void readAtelierState().then((saved) => { if (saved.motionOpen === true) update({ open: true }); });
}

/** Test hook: current state and a reset. */
export const motionPlayerTest = { state: () => s, reset: () => { s = createMotionState(); sawReady = false; }, runAction, onFrameLoad };
