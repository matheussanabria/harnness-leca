// @ts-check
// Tela do Mapa em Camadas com protótipo ligado: mostra a tela do protótipo (somente leitura) no lugar da replica.
import { esc } from "../../shared/dom.js";
import { state } from "../../shared/state.js";

/** @param {any} sc */
export function hasPrototypeFrame(sc) {
  return Boolean(sc?.prototype?.id && sc?.prototype?.screen);
}

/**
 * URL da tela unica do protótipo, ja montada com estilos e sandbox pelo servidor.
 * @param {string} slug
 * @param {{ id: string, screen: string }} prototype
 */
export function prototypeFrameUrl(slug, prototype) {
  return `/api/project/${encodeURIComponent(slug)}/design/prototypes/${encodeURIComponent(prototype.id)}/render/${encodeURIComponent(prototype.screen)}`;
}

/** @param {any} sc */
export function renderPrototypeFrame(sc) {
  const slug = state.P?.name || state.S?.active || "";
  const url = prototypeFrameUrl(slug, sc.prototype);
  return `<div class="replica-proto-wrap">
    <iframe class="replica-proto-frame" src="${esc(url)}" sandbox="allow-scripts" loading="lazy" title="Protótipo: ${esc(sc.title || sc.prototype.screen)}"></iframe>
    <p class="replica-proto-note"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> Protótipo <code>${esc(sc.prototype.id)}</code>, tela <code>${esc(sc.prototype.screen)}</code> (somente leitura). Os campos desta tela estao na lista ao lado.</p>
  </div>`;
}
