// @ts-check
// Tela do Mapa em Camadas com protótipo ligado: mostra so a secao da tela do protótipo, interativa (modo play),
// na largura do modo escolhido em Desktop/Tablet/Mobile, reduzida para caber no painel.
// O campo escolhido na lista destaca no protótipo o trecho ligado a ele pelo seletor do _prototipos.json.
import { esc } from "../../shared/dom.js";
import { state } from "../../shared/state.js";
import { dls } from "../design-layers-store.js";
import { buildMarkers, markersMessage, activeMarkerMessage, bindFieldClicks } from "./layers-screen-replica-markers.js";

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
  const selectors = JSON.stringify(sc.prototype.selectors || {});
  const markers = JSON.stringify(buildMarkers(sc));
  return `<div class="replica-proto-wrap" data-frame-width="${width}" data-frame-height="${FRAME_HEIGHT}" data-selectors="${esc(selectors)}" data-markers="${esc(markers)}">
    <div class="replica-proto-stage">
      <iframe class="replica-proto-frame" style="width:${width}px;height:${FRAME_HEIGHT}px" src="${esc(url)}" sandbox="allow-scripts" loading="lazy" title="Protótipo: ${esc(sc.title || sc.prototype.screen)}"></iframe>
    </div>
    <p class="replica-proto-note"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> ${MODE_LABELS[mode]} (${width} px), secao da tela <code>${esc(sc.prototype.screen)}</code> do protótipo <code>${esc(sc.prototype.id)}</code>. Interativo; o campo escolhido ao lado fica destacado.</p>
  </div>`;
}

/**
 * Ordem enviada ao protótipo: destacar o trecho do campo, ou limpar quando o campo nao tem seletor.
 * @param {Record<string, string>} selectors seletor CSS por id de campo
 * @param {string | null | undefined} fieldId
 */
export function highlightMessage(selectors, fieldId) {
  const selector = fieldId ? selectors?.[fieldId] : "";
  return selector ? { type: "HARNESS_PROTO_HIGHLIGHT_SELECTOR", selector } : { type: "HARNESS_PROTO_CLEAR_HIGHLIGHT" };
}

/** @param {Element} wrap */
function selectorsOf(wrap) {
  try {
    return JSON.parse(wrap.getAttribute("data-selectors") || "{}");
  } catch {
    return {};
  }
}

/**
 * Aplica o campo em foco a todos os quadros de protótipo abertos, sem recarregar nada.
 * @param {ParentNode} root
 */
export function highlightFocusedField(root = document) {
  root?.querySelectorAll?.(".replica-proto-wrap").forEach((wrap) => {
    const frame = /** @type {HTMLIFrameElement | null} */ (wrap.querySelector(".replica-proto-frame"));
    frame?.contentWindow?.postMessage(highlightMessage(selectorsOf(wrap), dls.focusedFieldId), "*");
    frame?.contentWindow?.postMessage(activeMarkerMessage(dls.focusedFieldId), "*");
  });
}

/** @param {Element} wrap */
function markersOf(wrap) {
  try {
    return JSON.parse(wrap.getAttribute("data-markers") || "[]");
  } catch {
    return [];
  }
}

/**
 * Reduz cada quadro para caber na largura do painel (nunca amplia) e ajusta a altura.
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

/**
 * Prepara os quadros recem desenhados: escala, modo play (o protótipo funciona de verdade) e destaque do campo em foco.
 * @param {ParentNode} root
 */
export function mountPrototypeFrames(root = document) {
  fitPrototypeFrames(root);
  root?.querySelectorAll?.(".replica-proto-wrap").forEach((wrap) => {
    const frame = /** @type {HTMLIFrameElement | null} */ (wrap.querySelector(".replica-proto-frame"));
    frame?.addEventListener("load", () => {
      frame.contentWindow?.postMessage({ type: "HARNESS_PROTO_MODE", mode: "play" }, "*");
      frame.contentWindow?.postMessage(markersMessage(markersOf(wrap), dls.focusedFieldId), "*");
      frame.contentWindow?.postMessage(highlightMessage(selectorsOf(wrap), dls.focusedFieldId), "*");
    });
  });
  bindFieldClicks();
}
