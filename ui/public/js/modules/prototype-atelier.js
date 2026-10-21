// @ts-check
import { $, showToast } from "../shared/dom.js";
import { state } from "../shared/state.js";
import { renderNodeEditForm } from "./prototype-edit-panel.js";
import { updatePropsMetrics } from "./prototype-props-panel.js";
import { applyEdit } from "./prototype-edit-api.js";
import { setAtelierChatContext } from "./prototype-chat-bridge.js";
import { initWorkspaceLayout } from "./prototype-workspace-layout.js";
import { initLayerTree, selectLayerNode } from "./prototype-layer-tree.js";
import { bindPrototypeCatalog, buildPrototypeCatalog } from "./prototype-catalog.js";
import { renderAtelierHtml } from "./prototype-atelier-view.js";
import { renderElementMapping } from "./prototype-element-map.js";
import { bindCanvasMode, canvasHandleMessage, canvasPost, canvasReload, canvasSetInspector } from "./prototype-atelier-canvas.js";
import { bindInspectorToggle, isInspectorOn, singleScreenMode } from "./prototype-inspector-toggle.js";

let currentSlug = "";
let currentProtoId = "";
let currentActiveScreen = "home";
let currentProtoData = null;
let currentVersions = [];
let selectedNode = null;
let activeViewportWidth = 1280;
let allPrototypesList = [];
let atelierOptions = { components: [], mcpServer: "", onSelect: null };
let bridgeListenerInstalled = false;
let pendingSelectPid = "";

export function attachStudioSidebarToAtelier() {
  const host = $("atelierChatHost");
  const sidebar = $("studioSidebar");
  if (!host || !sidebar) return;
  host.appendChild(sidebar);
  state.isStudioMode = true;
  if (window.syncStudioControls) window.syncStudioControls();
  if (window.renderChatHistory) window.renderChatHistory();
  if (window.updateEngineAuthBadge) window.updateEngineAuthBadge();
}

export function detachStudioSidebarFromAtelier() {
  const sidebar = $("studioSidebar");
  const workspace = $("studioWorkspace");
  if (sidebar && workspace && sidebar.parentElement !== workspace) workspace.prepend(sidebar);
}

export async function renderPrototypeAtelier(container, slug, protoId, options = {}) {
  currentSlug = slug;
  currentProtoId = protoId;
  const legacyList = Array.isArray(options) ? options : [];
  allPrototypesList = Array.isArray(options.catalog) ? options.catalog : legacyList;
  atelierOptions = {
    components: options.components || [],
    mcpServer: options.mcpServer || "",
    onSelect: typeof options.onSelect === "function" ? options.onSelect : null,
  };
  container.innerHTML = '<div class="proto-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando Ateliê...</div>';

  try {
    const [prototypeResponse, versionsResponse, listResponse] = await Promise.all([
      fetch(`/api/project/${encodeURIComponent(slug)}/design/prototypes/${encodeURIComponent(protoId)}`),
      fetch(`/api/project/${encodeURIComponent(slug)}/design/prototypes/${encodeURIComponent(protoId)}/versions`),
      allPrototypesList.length ? Promise.resolve(null) : fetch(`/api/project/${encodeURIComponent(slug)}/design/prototypes`),
    ]);
    if (!prototypeResponse.ok) {
      container.innerHTML = '<div class="proto-error"><i class="fa-solid fa-triangle-exclamation"></i> Protótipo não encontrado.</div>';
      return;
    }
    currentProtoData = (await prototypeResponse.json()).prototype || {};
    currentActiveScreen = currentProtoData.activeScreen || "home";
    if (versionsResponse.ok) currentVersions = (await versionsResponse.json()).versions || [];
    if (listResponse?.ok) allPrototypesList = buildPrototypeCatalog([], (await listResponse.json()).prototypes || []);
    renderAtelierLayout(container);
    setupBridgeListener();
  } catch {
    container.innerHTML = '<div class="proto-error"><i class="fa-solid fa-triangle-exclamation"></i> Erro ao carregar protótipo.</div>';
  }
}

function renderAtelierLayout(container) {
  container.innerHTML = renderAtelierHtml({
    slug: currentSlug,
    prototypeId: currentProtoId,
    prototype: currentProtoData,
    activeScreen: currentActiveScreen,
    viewportWidth: activeViewportWidth,
    versions: currentVersions,
    catalog: allPrototypesList,
    components: atelierOptions.components,
    mcpServer: atelierOptions.mcpServer,
  });
  const root = $("protoWorkspaceRoot");
  if (root) initWorkspaceLayout(root);
  const catalog = document.querySelector(".proto-col-catalog");
  if (catalog) bindPrototypeCatalog(catalog, navigateCatalog);
  attachStudioSidebarToAtelier();
  setAtelierChatContext({
    slug: currentSlug,
    protoId: currentProtoId,
    getScreen: () => currentActiveScreen,
    reload: () => renderPrototypeAtelier(container, currentSlug, currentProtoId, {
      catalog: allPrototypesList,
      ...atelierOptions,
    }),
    mcpServer: atelierOptions.mcpServer,
  });
  bindAtelierEvents(container);
}

function navigateCatalog(id, kind) {
  if (atelierOptions.onSelect) atelierOptions.onSelect(id, kind);
}

function bindAtelierEvents(container) {
  const screenSelect = /** @type {HTMLSelectElement} */ ($("atelierScreenSelect"));
  if (screenSelect) screenSelect.onchange = () => {
    currentActiveScreen = screenSelect.value;
    reloadIframe();
  };
  document.querySelectorAll(".btn-viewport").forEach((button) => {
    button.addEventListener("click", () => selectViewport(/** @type {HTMLElement} */ (button)));
  });
  const reloadButton = $("btnReloadProtoFrame");
  if (reloadButton) reloadButton.onclick = reloadIframe;
  const createButton = $("btnAtelierCreateProto");
  if (createButton) createButton.onclick = () => window.promptCreateNewPrototype?.(container, currentSlug);
  bindInspectorTabs();
  bindVersionRestore();
  bindInspectorToggle(applyInspector);
  bindCanvasMode({
    slug: currentSlug,
    protoId: currentProtoId,
    screens: () => currentProtoData.screens || [{ id: "home", title: "Início" }],
    viewportWidth: () => activeViewportWidth,
    getScreen: () => currentActiveScreen,
    onScreen: selectCanvasScreen,
  });
}

function applyInspector(on) {
  if (canvasSetInspector(on)) return;
  const iframe = /** @type {HTMLIFrameElement} */ ($("atelierIframe"));
  iframe?.contentWindow?.postMessage({ type: "HARNESS_PROTO_MODE", mode: singleScreenMode() }, "*");
}

function selectCanvasScreen(screen) {
  if (screen !== currentActiveScreen) {
    currentActiveScreen = screen;
    const select = /** @type {HTMLSelectElement} */ ($("atelierScreenSelect"));
    if (select) select.value = screen;
  }
  setTimeout(() => postToPrototype({ type: "HARNESS_PROTO_REQUEST_TREE" }), 0);
}

function selectViewport(button) {
  document.querySelectorAll(".btn-viewport").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  activeViewportWidth = Number.parseInt(button.dataset.w || "1280", 10);
  const frame = $("atelierFrameContainer");
  if (frame) frame.style.width = `${activeViewportWidth}px`;
}

function bindInspectorTabs() {
  document.querySelectorAll(".inspector-tab-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".inspector-tab-btn").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      const tab = /** @type {HTMLElement} */ (button).dataset.tab;
      const layers = $("inspectorLayersSection");
      const properties = $("inspectorPropsSection");
      if (!layers || !properties) return;
      layers.style.display = tab === "props" ? "none" : "flex";
      properties.style.display = tab === "layers" ? "none" : "block";
      layers.style.flex = "1";
      properties.style.flex = "1";
    });
  });
}

function bindVersionRestore() {
  document.querySelectorAll(".btn-restore-version").forEach((button) => {
    button.addEventListener("click", async () => {
      const version = /** @type {HTMLElement} */ (button).dataset.ver;
      if (!confirm(`Deseja restaurar a versão v${version}?`)) return;
      try {
        const response = await fetch(`/api/project/${encodeURIComponent(currentSlug)}/design/prototypes/${encodeURIComponent(currentProtoId)}/versions/${version}/restore`, { method: "POST", headers: { "Content-Type": "application/json" } });
        showToast(response.ok ? `Versão v${version} restaurada.` : "Erro ao restaurar versão.");
        if (response.ok) reloadIframe();
      } catch {
        showToast("Falha na requisição de restauração.");
      }
    });
  });
}

function setupBridgeListener() {
  if (bridgeListenerInstalled) return;
  bridgeListenerInstalled = true;
  window.addEventListener("message", handleBridgeMessage);
}

function handleBridgeMessage(event) {
  const data = event.data;
  if (!data || typeof data !== "object") return;
  if (canvasHandleMessage(event)) return;
  if (data.type === "HARNESS_PROTO_SELECT") {
    selectedNode = data;
    renderSelectedNodeDetails();
    void renderElementMapping({ slug: currentSlug, protoId: currentProtoId, screenId: currentActiveScreen, node: data });
    const tree = $("atelierLayerTreeContainer");
    if (tree && data.pid) selectLayerNode(data.pid, tree);
  } else if (data.type === "HARNESS_PROTO_METRICS") {
    updatePropsMetrics(data);
  } else if (data.type === "HARNESS_PROTO_REORDER") {
    void moveElement(data.pid, data.targetPid, data.position);
  } else if (data.type === "HARNESS_PROTO_TREE") {
    renderLayerTree(data.tree);
  } else if (data.type === "HARNESS_PROTO_READY") {
    if (!isInspectorOn()) postToPrototype({ type: "HARNESS_PROTO_MODE", mode: singleScreenMode() });
    postToPrototype({ type: "HARNESS_PROTO_REQUEST_TREE" });
    if (pendingSelectPid) {
      const pid = pendingSelectPid;
      pendingSelectPid = "";
      setTimeout(() => postToPrototype({ type: "HARNESS_PROTO_SELECT_BY_PID", pid }), 120);
    }
  } else if (data.type === "HARNESS_PROTO_GOTO" && data.screen) {
    currentActiveScreen = data.screen;
    const select = /** @type {HTMLSelectElement} */ ($("atelierScreenSelect"));
    if (select) select.value = data.screen;
    reloadIframe();
  }
}

function renderLayerTree(treeData) {
  const container = $("atelierLayerTreeContainer");
  if (!container || !treeData) return;
  initLayerTree(
    treeData,
    container,
    (pid) => postToPrototype({ type: "HARNESS_PROTO_SELECT_BY_PID", pid }),
    (pid) => postToPrototype({ type: "HARNESS_PROTO_TOGGLE_VISIBILITY", pid }),
    (pid) => postToPrototype({ type: "HARNESS_PROTO_TOGGLE_LOCK", pid }),
    (pid, targetPid, position) => void moveElement(pid, targetPid, position),
  );
}

/** Reordena um elemento (arrastar no canvas ou na árvore): grava no HTML e recarrega mantendo a seleção. */
async function moveElement(pid, targetPid, position) {
  const res = await applyEdit({ slug: currentSlug, protoId: currentProtoId, screenId: currentActiveScreen, pid, op: { type: "moveTo", targetPid, position } });
  if (!res.ok) { showToast(`Não foi possível mover: ${res.error}`); return; }
  pendingSelectPid = pid;
  reloadIframe();
}

function postToPrototype(message) {
  if (canvasPost(message)) return;
  const iframe = /** @type {HTMLIFrameElement} */ ($("atelierIframe"));
  iframe?.contentWindow?.postMessage(message, "*");
}

function reloadIframe() {
  if (canvasReload()) return;
  const iframe = /** @type {HTMLIFrameElement} */ ($("atelierIframe"));
  if (iframe) iframe.src = `/api/project/${encodeURIComponent(currentSlug)}/design/prototypes/${encodeURIComponent(currentProtoId)}/render/${encodeURIComponent(currentActiveScreen)}`;
}

function renderSelectedNodeDetails() {
  const panel = $("atelierNodeDetails");
  if (panel && selectedNode) renderNodeEditForm(panel, currentSlug, currentProtoId, currentActiveScreen, selectedNode, reloadIframe, { post: postToPrototype, getScreen: () => currentActiveScreen });
}
