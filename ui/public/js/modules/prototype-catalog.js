// @ts-check
import { esc } from "../shared/dom.js";
import { renderComponentSection } from "./prototype-component-catalog.js";

export function buildPrototypeCatalog(artifacts = [], editable = []) {
  // Um protótipo do Ateliê registrado no design.json aparece nas duas listas; mostra só a versão editável,
  // senão a lista duplica o item e excluir um deles parece apagar dois.
  const editableIds = new Set(editable.map((item) => item.id));
  const inspectedArtifactIds = new Set(editable.map((item) => item.metadata?.sourceArtifact).filter(Boolean));
  return [
    ...artifacts.filter((item) => !editableIds.has(item.id) && !inspectedArtifactIds.has(item.id)).map((item) => ({ ...item, kind: "artifact" })),
    ...editable.map((item) => ({ ...item, kind: "atelier" })),
  ];
}

/**
 * @param {any[]} items
 * @param {string} activeId
 * @param {any} componentsOrProto  componentes do protótipo (`{ components: [...] }`, do Ateliê) ou a lista do DS (array, tela de design)
 * @param {string} [mcpServer]
 */
export function renderPrototypeCatalog(items, activeId, componentsOrProto = null, mcpServer = "") {
  const prototypesHtml = items.map((item) => {
    const active = item.id === activeId;
    const detail = item.kind === "atelier"
      ? `${item.screens?.length || 1} tela(s) editável(is)`
      : item.file || "Artefato HTML local";
    const icon = item.kind === "atelier" ? "fa-wand-magic-sparkles" : "fa-file-code";
    return `
      <div class="proto-item-wrap">
        <button type="button" class="proto-item-card ${active ? "active" : ""}" data-prototype-id="${esc(item.id)}" data-prototype-kind="${item.kind}">
          <span class="proto-item-heading">
            <strong>${esc(item.title || item.id)}</strong>
            <span class="proto-card-badge">${item.kind === "atelier" ? `v${item.version || 1}` : "HTML"}</span>
          </span>
          <span class="proto-item-detail"><i class="fa-solid ${icon}"></i> ${esc(detail)}</span>
        </button>
        <button type="button" class="proto-item-delete" data-prototype-delete="${esc(item.id)}" data-prototype-kind="${item.kind}" title="Excluir protótipo" aria-label="Excluir ${esc(item.title || item.id)}"><i class="fa-solid fa-trash-can"></i></button>
      </div>`;
  }).join("");

  const componentsHtml = Array.isArray(componentsOrProto)
    ? renderDsComponents(componentsOrProto, mcpServer)
    : (componentsOrProto ? renderComponentSection(componentsOrProto, mcpServer) : "");

  return `
    <div class="proto-catalog-list">
      <div class="proto-catalog-section-title">Protótipos do projeto (${items.length})</div>
      ${prototypesHtml || '<div class="proto-catalog-empty">Nenhum protótipo no projeto.</div>'}
      ${componentsHtml}
    </div>`;
}

/** Lista do Design System inteiro (usada na tela de design; o Ateliê mostra os componentes do protótipo). */
function renderDsComponents(components, mcpServer) {
  if (!components.length) return "";
  const componentHtml = components.slice(0, 30).map((component) => `
    <div class="proto-component-card" title="${esc(component.dai?.nextAction || "")}">
      <span><i class="fa-solid fa-cube"></i> ${esc(component.name || component.id)}</span>
      <span class="proto-card-badge">${component.checklist?.hasBoilerplate ? "boilerplate" : esc(component.stageLabel || component.stage || "DS")}</span>
    </div>`).join("");
  return `
    <div class="proto-catalog-section-title proto-components-title">
      Componentes reutilizáveis (${components.length})
    </div>
    ${componentHtml}
    ${mcpServer ? `<div class="proto-mcp-hint"><i class="fa-solid fa-plug"></i> Boilerplates via MCP <code>${esc(mcpServer)}</code></div>` : ""}`;
}

export function bindPrototypeCatalog(container, onSelect, onDelete) {
  container.querySelectorAll("[data-prototype-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const element = /** @type {HTMLElement} */ (button);
      onSelect(element.dataset.prototypeId || "", element.dataset.prototypeKind || "artifact");
    });
  });
  container.querySelectorAll("[data-prototype-delete]").forEach((button) => {
    const element = /** @type {HTMLElement} */ (button);
    if (!onDelete) { element.hidden = true; return; }
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      onDelete(element.dataset.prototypeDelete || "", element.dataset.prototypeKind || "artifact");
    });
  });
}
