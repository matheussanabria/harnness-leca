// @ts-check
// "Telas ligadas" strip of a Layers map screen: where the user comes from and goes to (navegacao) and which
// screens it calls or is called by (chamada), from `screen.links` (ui/server/services/screen-links.js).
// A click opens the linked screen; for "Vem de" the field that leads here is focused on the source screen.
import { esc } from "../../shared/dom.js";

const GROUPS = [
  { key: "vemDe", label: "Vem de", icon: "fa-arrow-right-to-bracket", focusSource: true },
  { key: "vaiPara", label: "Vai para", icon: "fa-arrow-right-from-bracket", focusSource: false },
  { key: "chama", label: "Chama", icon: "fa-plug", focusSource: false },
  { key: "chamadaPor", label: "É chamada por", icon: "fa-plug-circle-check", focusSource: true },
];
const VIA_LABELS = { http: "HTTP", servico: "serviço" };

/** @param {any} link */
function tooltip(link) {
  return [link.como, link.evidencia ? `Evidência: ${link.evidencia}` : ""].filter(Boolean).join("\n");
}

/** @param {any} link @param {{ focusSource: boolean }} group */
function linkButton(link, group) {
  const via = link.via ? ` <small class="screen-link-via">${esc(VIA_LABELS[link.via] || link.via)}</small>` : "";
  const campo = link.campo ? ` <small>${group.focusSource ? "por" : "pelo campo"} ${esc(link.campo)}</small>` : "";
  if (link.broken || !link.id) {
    return `<span class="doc-chip doc-chip-missing" title="${esc(`A tela "${link.para || link.title}" não existe no mapa`)}"><i class="fa-solid fa-link-slash"></i> ${esc(link.title)}</span>`;
  }
  const field = group.focusSource ? link.campo || "" : "";
  return `<button type="button" class="doc-chip screen-link" data-screen-link="${esc(link.id)}" data-screen-field="${esc(field)}" title="${esc(tooltip(link))}">${esc(link.title)}${campo}${via}</button>`;
}

/**
 * @param {any} sc current screen
 * @returns {string} empty when the screen declares and receives no link
 */
export function renderScreenLinks(sc) {
  const links = sc?.links;
  if (!links) return "";
  const groups = GROUPS.filter((g) => (links[g.key] || []).length).map((g) =>
    `<div class="docs-strip-group"><span class="docs-strip-label"><i class="fa-solid ${g.icon}"></i> ${g.label}</span>${links[g.key].map((l) => linkButton(l, g)).join("")}</div>`);
  if (!groups.length) return "";
  return `<div class="docs-strip screen-links-strip" aria-label="Telas ligadas"><span class="docs-strip-title"><i class="fa-solid fa-route"></i> Telas ligadas</span>${groups.join("")}</div>`;
}

// Same pattern as the doc chips: a capture listener, so the click never reaches an inline handler underneath.
if (typeof document !== "undefined") {
  document.addEventListener("click", (e) => {
    const el = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest?.("[data-screen-link]"));
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    // @ts-ignore global of design-layers-workspace.js
    if (typeof window.openLayersTarget === "function") window.openLayersTarget(el.dataset.screenLink, el.dataset.screenField || null);
  }, true);
}
