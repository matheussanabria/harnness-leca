// @ts-check
import { $, showToast } from "../shared/dom.js";
import { createCanvasMode } from "./prototype-canvas-mode.js";
import { isInspectorOn } from "./prototype-inspector-toggle.js";

/** Cola entre o controlador do Ateliê e o modo canvas (liga botões e roteia mensagens). */
let canvas = null;
let canvasWanted = false;

export function isCanvasActive() {
  return !!canvas;
}

function setVisible(on) {
  const wrap = document.querySelector(".proto-canvas-wrap");
  const host = $("atelierCanvasHost");
  if (wrap) /** @type {HTMLElement} */ (wrap).hidden = on;
  if (host) host.hidden = !on;
  document.querySelectorAll(".btn-viewport").forEach((b) => /** @type {HTMLElement} */ (b).hidden = on);
  $("btnAtelierModeCanvas")?.classList.toggle("active", on);
}

/** Liga os botões do cabeçalho. `ctx` traz dados do protótipo e callbacks do Ateliê. */
export function bindCanvasMode(ctx) {
  canvas?.destroy();
  canvas = null;
  $("btnAtelierModeCanvas")?.addEventListener("click", () => toggle(ctx));
  $("btnAtelierPlay")?.addEventListener("click", () => {
    if (!canvas) mount(ctx);
    canvas?.startPlay(ctx.getScreen());
  });
  if (canvasWanted) mount(ctx);
}

function toggle(ctx) {
  if (canvas) unmount();
  else mount(ctx);
}

function mount(ctx) {
  const host = $("atelierCanvasHost");
  if (!host || canvas) return;
  canvasWanted = true;
  setVisible(true);
  canvas = createCanvasMode({
    host,
    slug: ctx.slug,
    protoId: ctx.protoId,
    screens: ctx.screens(),
    viewportWidth: ctx.viewportWidth(),
    notify: showToast,
    inspector: isInspectorOn(),
    onFrameSelect: (screen) => ctx.onScreen(screen),
  });
}

function unmount() {
  canvas?.destroy();
  canvas = null;
  canvasWanted = false;
  setVisible(false);
}

/** Mensagens da ponte: true = já tratada pelo canvas. */
export function canvasHandleMessage(event) {
  return canvas ? canvas.handleMessage(event) : false;
}

export function canvasPost(message) {
  if (!canvas) return false;
  canvas.postToSelected(message);
  return true;
}

/** Aplica o inspetor (ligado/desligado) a todos os quadros; false quando o canvas não está ativo. */
export function canvasSetInspector(on) {
  if (!canvas) return false;
  canvas.setInspector(on);
  return true;
}

export function canvasReload() {
  return canvas ? canvas.reloadSelected() : false;
}
