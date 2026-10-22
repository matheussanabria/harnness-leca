// @ts-check
import { esc } from "../shared/dom.js";
import { renderPrototypeCatalog } from "./prototype-catalog.js";

export function renderScreenOptions(screens, activeScreen) {
  return screens
    .map((screen) => `<option value="${esc(screen.id)}" ${screen.id === activeScreen ? "selected" : ""}>${esc(screen.title || screen.id)}</option>`)
    .join("");
}

export function renderAtelierHtml(model) {
  const screens = model.prototype.screens || [{ id: "home", title: "Início" }];
  const screenOptions = renderScreenOptions(screens, model.activeScreen);
  const catalog = renderPrototypeCatalog(model.catalog, model.prototypeId, model.components, model.mcpServer);
  const versions = renderVersions(model.versions, model.prototype.version);

  return `
    <div id="protoWorkspaceRoot" class="proto-workspace-root">
      <div class="proto-col-catalog">
        <div class="proto-panel-normal">
          <div class="proto-panel-header">
            <span class="proto-panel-title"><i class="fa-solid fa-shapes"></i> Catálogo</span>
            <div class="proto-panel-actions">
              <button type="button" class="proto-panel-action-btn" id="btnAtelierCreateProto" title="Novo protótipo"><i class="fa-solid fa-plus"></i></button>
              <button type="button" class="proto-panel-action-btn btn-collapse-panel" data-panel="catalog" title="Recolher catálogo"><i class="fa-solid fa-chevron-left"></i></button>
            </div>
          </div>
          ${catalog}
        </div>
        ${panelRail("catalog", "fa-shapes", "Protótipos", "fa-chevron-right")}
      </div>

      <div class="proto-resizer" data-target="catalog" data-dir="left"></div>
      <div class="proto-col-chat">
        <div class="proto-panel-normal">
          <div class="proto-panel-header">
            <span class="proto-panel-title"><i class="fa-solid fa-comments"></i> Chat com IA</span>
            <div class="proto-panel-actions">
              <button type="button" class="proto-panel-action-btn" onclick="minimizeCurrentChat('atelier')" title="Minimizar"><i class="fa-solid fa-window-minimize"></i></button>
              <button type="button" class="proto-panel-action-btn btn-collapse-panel" data-panel="chat" title="Recolher"><i class="fa-solid fa-chevron-left"></i></button>
            </div>
          </div>
          <div id="atelierChatHost" class="proto-chat-host"></div>
        </div>
        ${panelRail("chat", "fa-comments", "Chat IA", "fa-comments")}
      </div>

      <div class="proto-resizer" data-target="chat" data-dir="left"></div>
      <div class="proto-col-preview">
        <div class="proto-panel-header proto-preview-header">
          <div class="proto-preview-heading">
            <span class="proto-preview-title"><i class="fa-solid fa-compass-drafting"></i> ${esc(model.prototype.title || model.prototypeId)}</span>
            <span class="proto-card-badge" id="atelierProtoVersionBadge">v${model.prototype.version || 1}</span>
            <label class="proto-screen-picker">Tela:
              <select id="atelierScreenSelect">${screenOptions}</select>
            </label>
          </div>
          <div class="proto-panel-actions">
            ${viewportButton(1280, "fa-desktop", model.viewportWidth)}
            ${viewportButton(768, "fa-tablet-screen-button", model.viewportWidth)}
            ${viewportButton(390, "fa-mobile-screen-button", model.viewportWidth)}
            <button type="button" id="btnAtelierInspector" class="btn-proto-vp active" title="Ligar ou desligar o inspetor" aria-pressed="true"><i class="fa-solid fa-crosshairs"></i> <span>Inspetor</span></button>
            <button type="button" id="btnAtelierModeCanvas" class="btn-proto-vp" title="Alternar entre tela única e canvas"><i class="fa-solid fa-object-group"></i> Canvas</button>
            <button type="button" id="btnAtelierPlay" class="btn-proto-vp" title="Iniciar a navegação (cada tela vira um quadro do canvas)"><i class="fa-solid fa-play"></i> Iniciar</button>
            <button type="button" id="btnReloadProtoFrame" class="btn-proto-vp" title="Recarregar tela"><i class="fa-solid fa-rotate"></i></button>
          </div>
        </div>
        <div class="proto-canvas-wrap">
          <div id="atelierFrameContainer" class="proto-frame-box" style="width:${model.viewportWidth}px">
            <iframe id="atelierIframe" src="/api/project/${encodeURIComponent(model.slug)}/design/prototypes/${encodeURIComponent(model.prototypeId)}/render/${encodeURIComponent(model.activeScreen)}" sandbox="allow-scripts"></iframe>
          </div>
        </div>
        <div id="atelierCanvasHost" class="proto-canvas-host" hidden></div>
        <div class="proto-versions-bar">
          <span><i class="fa-solid fa-clock-rotate-left"></i> Versões:</span>
          <div id="atelierVersionsList">${versions}</div>
        </div>
      </div>

      <div class="proto-resizer" data-target="inspector" data-dir="right"></div>
      <div class="proto-col-inspector">
        <div class="proto-panel-normal">
          <div class="proto-panel-header">
            <span class="proto-panel-title"><i class="fa-solid fa-layer-group"></i> Estrutura & Inspetor</span>
            <button type="button" class="proto-panel-action-btn btn-collapse-panel" data-panel="inspector" title="Recolher"><i class="fa-solid fa-chevron-right"></i></button>
          </div>
          <div class="inspector-tabs-bar" id="inspectorTabsBar">
            <button type="button" class="inspector-tab-btn active" data-tab="split"><i class="fa-solid fa-table-columns"></i> Ambos</button>
            <button type="button" class="inspector-tab-btn" data-tab="layers"><i class="fa-solid fa-bars-staggered"></i> Camadas</button>
            <button type="button" class="inspector-tab-btn" data-tab="props"><i class="fa-solid fa-sliders"></i> Propriedades</button>
          </div>
          <div id="inspectorContentArea" class="proto-inspector-content">
            <div id="inspectorLayersSection" class="proto-inspector-layers">
              <div id="atelierLayerTreeContainer" class="proto-layer-tree-host"><div class="proto-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando camadas...</div></div>
            </div>
            <div id="inspectorPropsSection" class="proto-inspector-props">
              <div id="atelierNodeDetails"><i class="fa-solid fa-arrow-pointer"></i> Selecione uma camada ou um elemento no preview.</div>
              <div id="atelierElementMap" class="atelier-element-map"><span><i class="fa-solid fa-diagram-project"></i> Selecione um elemento para mapear arquivo e componente.</span></div>
            </div>
          </div>
        </div>
        ${panelRail("inspector", "fa-sliders", "Camadas & Inspetor", "fa-sliders")}
      </div>
    </div>`;
}

function viewportButton(width, icon, activeWidth) {
  return `<button type="button" class="btn-proto-vp btn-viewport ${activeWidth === width ? "active" : ""}" data-w="${width}"><i class="fa-solid ${icon}"></i> ${width}</button>`;
}

function panelRail(panel, icon, title, buttonIcon) {
  return `<div class="proto-panel-rail"><button type="button" class="proto-panel-action-btn btn-expand-panel" data-panel="${panel}" title="Expandir"><i class="fa-solid ${buttonIcon}"></i></button><span class="rail-title-vertical"><i class="fa-solid ${icon}"></i> ${title}</span></div>`;
}

export function renderVersions(versions, currentVersion) {
  if (!versions.length) return '<span class="proto-version-initial">v1 (Inicial)</span>';
  return versions.map((version) => `
    <button type="button" class="btn-restore-version btn-proto-vp" data-ver="${version.version}" title="${esc(version.message || "")} (${esc(version.createdAt || "")})">
      v${version.version} ${version.version === currentVersion ? '<i class="fa-solid fa-star"></i>' : ""}
    </button>`).join("");
}
