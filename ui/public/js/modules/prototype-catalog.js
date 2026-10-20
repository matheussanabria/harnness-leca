// @ts-check
import { esc } from "../shared/dom.js";

export function buildPrototypeCatalog(artifacts = [], editable = []) {
  return [
    ...artifacts.map((item) => ({ ...item, kind: "artifact" })),
    ...editable.map((item) => ({ ...item, kind: "atelier" })),
  ];
}

export function renderPrototypeCatalog(items, activeId, components = [], mcpServer = "") {
  const prototypesHtml = items.map((item) => {
    const active = item.id === activeId;
    const detail = item.kind === "atelier"
      ? `${item.screens?.length || 1} tela(s) editável(is)`
      : item.file || "Artefato HTML local";
    const icon = item.kind === "atelier" ? "fa-wand-magic-sparkles" : "fa-file-code";
    return `
      <button type="button" class="proto-item-card ${active ? "active" : ""}" data-prototype-id="${esc(item.id)}" data-prototype-kind="${item.kind}">
        <span class="proto-item-heading">
          <strong>${esc(item.title || item.id)}</strong>
          <span class="proto-card-badge">${item.kind === "atelier" ? `v${item.version || 1}` : "HTML"}</span>
        </span>
        <span class="proto-item-detail"><i class="fa-solid ${icon}"></i> ${esc(detail)}</span>
      </button>`;
  }).join("");

  const componentHtml = components.slice(0, 30).map((component) => `
    <div class="proto-component-card" title="${esc(component.dai?.nextAction || "")}">
      <span><i class="fa-solid fa-cube"></i> ${esc(component.name || component.id)}</span>
      <span class="proto-card-badge">${component.checklist?.hasBoilerplate ? "boilerplate" : esc(component.stageLabel || component.stage || "DS")}</span>
    </div>`).join("");

  return `
    <div class="proto-catalog-list">
      <div class="proto-catalog-section-title">Protótipos do projeto (${items.length})</div>
      ${prototypesHtml || '<div class="proto-catalog-empty">Nenhum protótipo no projeto.</div>'}
      ${components.length ? `
        <div class="proto-catalog-section-title proto-components-title">
          Componentes reutilizáveis (${components.length})
        </div>
        ${componentHtml}
        ${mcpServer ? `<div class="proto-mcp-hint"><i class="fa-solid fa-plug"></i> Boilerplates via MCP <code>${esc(mcpServer)}</code></div>` : ""}
      ` : ""}
    </div>`;
}

export function bindPrototypeCatalog(container, onSelect) {
  container.querySelectorAll("[data-prototype-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const element = /** @type {HTMLElement} */ (button);
      onSelect(element.dataset.prototypeId || "", element.dataset.prototypeKind || "artifact");
    });
  });
}
