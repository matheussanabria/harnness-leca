// @ts-check
import { esc, $ } from "../shared/dom.js";
import { renderPrototypeAtelier } from "./prototype-atelier.js";
import { parkStudioSidebar } from "./prototype-atelier-sidebar.js";
import { bindPrototypeCatalog, buildPrototypeCatalog, renderPrototypeCatalog } from "./prototype-catalog.js";
import { pickAfterDelete } from "./prototype-delete-model.js";
import { deletePrototypeWithConfirm } from "./prototype-delete-dialog.js";

let activeWorkspace = null;
let currentOpenId = "";

export function loadPrototypeInFrame(projectSlug, protoId, title = "") {
  const frame = /** @type {HTMLIFrameElement} */ ($("designPrototypeIframe"));
  const label = $("designPrototypeCurrentLabel");
  if (frame) frame.src = `/api/project/${encodeURIComponent(projectSlug)}/design/prototype/${encodeURIComponent(protoId)}/`;
  if (label) label.textContent = title ? `Visualizando: ${title}` : `Protótipo: ${protoId}`;
}

export async function renderPrototypesWorkspace(container, projectSlug, artifacts = [], components = [], designSystem = {}, initial = null) {
  let editable = [];
  try {
    const response = await fetch(`/api/project/${encodeURIComponent(projectSlug)}/design/prototypes`);
    if (response.ok) editable = (await response.json()).prototypes || [];
  } catch {}

  const catalog = buildPrototypeCatalog(artifacts, editable);
  activeWorkspace = { container, projectSlug, catalog, components, designSystem };
  if (catalog.length === 0) {
    renderEmptyWorkspace(container, projectSlug);
    return;
  }
  const first = (initial && catalog.find((item) => item.id === initial.id && item.kind === initial.kind)) || catalog[0];
  openCatalogItem(first.id, first.kind);
}

function openCatalogItem(protoId, kind) {
  if (!activeWorkspace) return;
  const { container, projectSlug, catalog, components, designSystem } = activeWorkspace;
  const selected = catalog.find((item) => item.id === protoId && item.kind === kind);
  if (!selected) return;
  currentOpenId = protoId;

  if (kind === "atelier") {
    renderPrototypeAtelier(container, projectSlug, protoId, {
      catalog,
      components,
      mcpServer: designSystem?.mcpServer || "",
      onSelect: openCatalogItem,
      onDelete: deleteCatalogItem,
    });
    return;
  }
  renderArtifactWorkspace(container, projectSlug, selected, catalog, components, designSystem);
}

function renderArtifactWorkspace(container, projectSlug, selected, catalog, components, designSystem) {
  parkStudioSidebar(); // o innerHTML abaixo apagaria o chat se ele ainda estivesse no #atelierChatHost
  container.innerHTML = `
    <div class="proto-workspace-root">
      <div id="prototypeCatalog" class="proto-col-catalog proto-static-catalog">
        <div class="proto-panel-header">
          <span class="proto-panel-title"><i class="fa-solid fa-shapes"></i> Catálogo</span>
          <button type="button" id="btnSidebarCreateProto" class="proto-panel-action-btn" title="Novo protótipo no Ateliê"><i class="fa-solid fa-plus"></i></button>
        </div>
        ${renderPrototypeCatalog(catalog, selected.id, components, designSystem?.mcpServer || "")}
      </div>
      <div id="prototypeMainArea" class="proto-col-preview">
        <div class="proto-panel-header">
          <span id="designPrototypeCurrentLabel" class="proto-current-title">Visualizando: ${esc(selected.title || selected.id)}</span>
          <div class="proto-panel-actions">
            <span class="proto-card-badge"><i class="fa-solid fa-lock"></i> Sandbox isolado</span>
            <button type="button" id="btnInspectArtifact" class="btn-proto-vp" title="Abrir uma cópia editável no Ateliê"><i class="fa-solid fa-crosshairs"></i> Inspecionar</button>
          </div>
        </div>
        <div class="proto-canvas-wrap">
          <iframe id="designPrototypeIframe" class="proto-frame-box" style="width:100%" sandbox="allow-scripts" src="/api/project/${encodeURIComponent(projectSlug)}/design/prototype/${encodeURIComponent(selected.id)}/"></iframe>
        </div>
      </div>
    </div>`;

  const catalogElement = $("prototypeCatalog");
  if (catalogElement) bindPrototypeCatalog(catalogElement, openCatalogItem, deleteCatalogItem);
  const createButton = $("btnSidebarCreateProto");
  if (createButton) createButton.onclick = () => createNewPrototypePrompt(container, projectSlug);
  const inspectButton = $("btnInspectArtifact");
  if (inspectButton) inspectButton.onclick = () => inspectArtifact(container, projectSlug, selected.id);
}

/** Exclui (com confirmação) e reabre o próximo item do catálogo. */
async function deleteCatalogItem(protoId, kind) {
  if (!activeWorkspace) return;
  const { container, projectSlug, catalog, components, designSystem } = activeWorkspace;
  const item = catalog.find((entry) => entry.id === protoId && entry.kind === kind);
  if (!item) return;
  try {
    if (!(await deletePrototypeWithConfirm(projectSlug, item))) return;
    const next = pickAfterDelete(catalog, protoId, currentOpenId);
    const artifacts = catalog.filter((entry) => entry.kind === "artifact" && entry.id !== protoId);
    await renderPrototypesWorkspace(container, projectSlug, artifacts, components, designSystem, next);
  } catch (error) {
    alert(error.message || "Falha ao excluir o protótipo.");
  }
}

async function inspectArtifact(container, projectSlug, artifactId) {
  try {
    const response = await fetch(`/api/project/${encodeURIComponent(projectSlug)}/design/prototypes/import-artifact/${encodeURIComponent(artifactId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível preparar a inspeção.");
    await renderPrototypesWorkspace(container, projectSlug, activeWorkspace?.catalog.filter((item) => item.kind === "artifact") || [], activeWorkspace?.components || [], activeWorkspace?.designSystem || {});
    openCatalogItem(data.protoId, "atelier");
  } catch (error) {
    alert(error.message || "Falha ao abrir a inspeção.");
  }
}

function renderEmptyWorkspace(container, projectSlug) {
  parkStudioSidebar(); // o innerHTML abaixo apagaria o chat se ele ainda estivesse no #atelierChatHost
  container.innerHTML = `
    <div class="proto-empty-state">
      <i class="fa-solid fa-compass-drafting"></i>
      <strong>Nenhum protótipo neste projeto</strong>
      <p>Cadastre artefatos em design/design.json ou crie um protótipo modular no Ateliê.</p>
      <button type="button" id="btnEmptyCreateProto"><i class="fa-solid fa-plus"></i> Novo protótipo</button>
    </div>`;
  const button = $("btnEmptyCreateProto");
  if (button) button.onclick = () => createNewPrototypePrompt(container, projectSlug);
}

export async function createNewPrototypePrompt(container, projectSlug) {
  const title = prompt("Título do novo protótipo:", "Fluxo de Exemplo");
  if (!title) return;
  const id = title.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  try {
    const response = await fetch(`/api/project/${encodeURIComponent(projectSlug)}/design/prototypes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, title }),
    });
    if (!response.ok) {
      const error = await response.json();
      alert("Erro ao criar: " + (error.error || "Acesso negado"));
      return;
    }
    const artifacts = activeWorkspace?.catalog.filter((item) => item.kind === "artifact") || [];
    await renderPrototypesWorkspace(container, projectSlug, artifacts, activeWorkspace?.components || [], activeWorkspace?.designSystem || {});
    openCatalogItem(id, "atelier");
  } catch {
    alert("Falha na criação do protótipo.");
  }
}

if (typeof window !== "undefined") {
  // @ts-ignore
  window.selectDesignPrototype = (protoId) => openCatalogItem(protoId, "artifact");
  // @ts-ignore
  window.openAtelierPrototype = (protoId) => openCatalogItem(protoId, "atelier");
  // @ts-ignore
  window.promptCreateNewPrototype = (container, projectSlug) => createNewPrototypePrompt(container, projectSlug);
}
