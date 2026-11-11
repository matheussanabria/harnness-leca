// @ts-check
// Tela do Mapa em Camadas com protótipo ligado: mostra so a secao da tela do protótipo (somente leitura)
// na largura do modo escolhido em Desktop/Tablet/Mobile, reduzida para caber no painel.
import { esc } from "../../shared/dom.js";
import { state } from "../../shared/state.js";
import { dls } from "../design-layers-store.js";

/** Largura logica do quadro por modo (px) e altura logica comum. */
export const FRAME_WIDTHS = { desktop: 1024, tablet: 768, mobile: 390 };
export const FRAME_HEIGHT = 720;
const MODE_LABELS = { desktop: "Desktop", tablet: "Tablet", mobile: "Mobile" };

/** @param {any} sc */
export function hasPrototypeFrame(sc) {
  return Boolean(sc?.prototype?.id && sc?.prototype?.screen);
}

/** @returns {"desktop" | "tablet" | "mobile"} */
export function frameMode() {
  return dls.activeViewport === "tablet" || dls.activeViewport === "mobile" ? dls.activeViewport : "desktop";
}

/**
 * URL da tela unica do protótipo, ja montada com estilos e sandbox pelo servidor.
 * @param {string} slug
 * @param {{ id: string, screen: string }} prototype
 * @param {string} [part] "content": so a area de conteudo, sem cabecalho e menu
 */
export function prototypeFrameUrl(slug, prototype, part = "") {
  const base = `/api/project/${encodeURIComponent(slug)}/design/prototypes/${encodeURIComponent(prototype.id)}/render/${encodeURIComponent(prototype.screen)}`;
  return part ? `${base}?part=${encodeURIComponent(part)}` : base;
}

/** @param {any} sc */
export function renderPrototypeFrame(sc) {
  const slug = state.P?.name || state.S?.active || "";
  const mode = frameMode();
  const width = FRAME_WIDTHS[mode];
  const url = prototypeFrameUrl(slug, sc.prototype, "content");
  return `<div class="replica-proto-wrap" data-frame-width="${width}" data-frame-height="${FRAME_HEIGHT}">
    <div class="replica-proto-stage">
      <iframe class="replica-proto-frame" style="width:${width}px;height:${FRAME_HEIGHT}px" src="${esc(url)}" sandbox="allow-scripts" loading="lazy" title="Protótipo: ${esc(sc.title || sc.prototype.screen)}"></iframe>
    </div>
    <p class="replica-proto-note"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> ${MODE_LABELS[mode]} (${width} px), secao da tela <code>${esc(sc.prototype.screen)}</code> do protótipo <code>${esc(sc.prototype.id)}</code>, somente leitura. Os campos desta tela estao na lista ao lado.</p>
  </div>`;
}

/**
 * Reduz cada quadro de protótipo para caber na largura do painel (nunca amplia) e ajusta a altura.
 * @param {ParentNode} root
 */
export function fitPrototypeFrames(root = document) {
  root?.querySelectorAll?.(".replica-proto-wrap").forEach((wrap) => {
    const width = Number(wrap.getAttribute("data-frame-width")) || FRAME_WIDTHS.desktop;
    const height = Number(wrap.getAttribute("data-frame-height")) || FRAME_HEIGHT;
    const stage = /** @type {HTMLElement | null} */ (wrap.querySelector(".replica-proto-stage"));
    const frame = /** @type {HTMLElement | null} */ (wrap.querySelector(".replica-proto-frame"));
    if (!stage || !frame) return;
    const apply = () => {
      const scale = Math.min(1, (stage.clientWidth || width) / width);
      frame.style.transform = `scale(${scale})`;
      stage.style.height = `${Math.round(height * scale)}px`;
    };
    apply();
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(apply).observe(stage);
  });
}
