// @ts-check
import { esc } from "../shared/dom.js";

/**
 * Seção "Componentes do protótipo" do catálogo: os componentes do DS que as telas deste protótipo usam.
 * Cada item leva à primeira instância (na tela atual, se houver; senão navega até a tela dela).
 */

/** @param {any} data  resposta de GET .../prototypes/:id/components */
export function renderComponentSection(data, mcpServer = "") {
  const list = data?.components || [];
  if (!list.length) {
    return `<div id="protoComponentsSection" class="proto-components-section">
      <div class="proto-catalog-section-title proto-components-title">Componentes do protótipo (0)</div>
      <div class="proto-catalog-empty">Nenhum componente do Design System nas telas.</div>
    </div>`;
  }
  return `<div id="protoComponentsSection" class="proto-components-section">
    <div class="proto-catalog-section-title proto-components-title">Componentes do protótipo (${list.length})</div>
    ${list.map(componentCard).join("")}
    ${mcpServer ? `<div class="proto-mcp-hint"><i class="fa-solid fa-plug"></i> Boilerplates via MCP <code>${esc(mcpServer)}</code></div>` : ""}
  </div>`;
}

/** @param {any} c */
function componentCard(c) {
  const where = c.screens.map((s) => `${esc(s.title)} (${s.count})`).join(" · ");
  return `
    <div class="proto-component-card proto-component-item" data-proto-comp="${esc(c.id)}">
      <button type="button" class="proto-comp-main" data-comp-locate="${esc(c.id)}" title="Localizar no protótipo">
        <span><i class="fa-solid fa-cube"></i> ${esc(c.name)}</span>
        <span class="proto-card-badge">${c.instances}×</span>
      </button>
      <div class="proto-comp-foot">
        <span class="proto-comp-screens" title="${esc(where)}">${where}</span>
        <button type="button" class="proto-comp-preview" data-comp-preview="${esc(c.id)}" title="Ver preview e código-fonte" aria-label="Ver preview e código-fonte de ${esc(c.name)}"><i class="fa-solid fa-code"></i></button>
      </div>
    </div>`;
}

/**
 * Liga os cliques da seção (uma vez, por delegação no catálogo).
 * @param {HTMLElement} root
 * @param {{ onLocate: (id: string) => void, onPreview: (id: string) => void }} handlers
 */
export function bindComponentCatalog(root, handlers) {
  root.addEventListener("click", (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    const locate = target.closest?.("[data-comp-locate]");
    if (locate) return handlers.onLocate(/** @type {HTMLElement} */ (locate).dataset.compLocate || "");
    const preview = target.closest?.("[data-comp-preview]");
    if (preview) handlers.onPreview(/** @type {HTMLElement} */ (preview).dataset.compPreview || "");
  });
}
